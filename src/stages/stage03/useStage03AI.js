// ============================================================
// 阶段 03 的 AI 生成逻辑（角色互换纯对话）
//
// 规则见 docs/复刻差异清单.md 3.7 / docs/设计规范.md 7.4：
//   - 只有纯对话，禁止旁白、动作、心理描写
//   - 左气泡 = 原来的你，右气泡 = 朋友（她）
//   - AI 判断 done 即收尾
//
// 触发时机：
//   - 首次进入（还没有任何轮次，也没有 current）→ 生成第 1 轮
//   - 用户以「朋友（她）」的身份回应完（current 变 null）→ 生成下一轮
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react'

import { generate } from '../../ai/client.js'
import { fallbackRoundAt } from '../../ai/stage03Fallback.js'
import { useApp } from '../../state/AppProvider.jsx'
import { fragmentsOf, stage01Signature } from '../../state/store.js'

export function useStage03AI(toast) {
  const { state, actions } = useApp()
  const [regenerating, setRegenerating] = useState(false)
  const inFlight = useRef(false)

  const stateRef = useRef(state)
  stateRef.current = state
  const actionsRef = useRef(actions)
  actionsRef.current = actions
  const toastRef = useRef(toast)
  toastRef.current = toast

  // 请求一轮。fallback 为 true 时直接使用兜底内容，不请求网络
  const requestRound = useCallback(async ({ fallback = false } = {}) => {
    if (inFlight.current) return

    const snap = stateRef.current
    const s3 = snap.stage03
    // 已有未回答的一轮，不重复请求
    if (s3.current) return
    // 已经收尾
    if (s3.done) return

    // 没有记录：不请求网络，直接用兜底对话让用户还能体验
    // sticky: false —— 用户之后补上记录，仍然要尝试真实 AI
    const hasMaterial = fragmentsOf(snap.stage01).length > 0
    if (!hasMaterial) {
      actionsRef.current.s3AiSuccess({
        ...fallbackRoundAt(s3.rounds.length),
        fallback: true,
        sticky: false,
        error: '还没有记录任何片段，当前是示例对话',
      })
      setRegenerating(false)
      return
    }

    // 本阶段此前已降级 → 后续轮次直接走兜底，不再逐轮等待超时
    const useFallback = fallback || s3.useFallback

    inFlight.current = true

    if (useFallback) {
      actionsRef.current.s3AiSuccess({ ...fallbackRoundAt(s3.rounds.length), fallback: true })
      inFlight.current = false
      setRegenerating(false)
      return
    }

    actionsRef.current.s3AiStart()

    try {
      const res = await generate('explore', {
        fragments: fragmentsOf(snap.stage01),
        facts: snap.stage02.facts,
        emotions: snap.stage02.emotions.filter((e) => e.selected).map((e) => e.label),
        coreNeed: snap.stage02.coreNeed,
        // 已完成的轮次传给模型，避免重复上一轮的话
        history: s3.rounds.map((r) => ({ chat: r.chat, reply: r.reply, replyKey: r.replyKey })),
      })

      if (res.ok && res.data) {
        actionsRef.current.s3AiSuccess(res.data)
      } else {
        const msg = res.message || 'AI 暂时不可用'
        toastRef.current?.(`${msg}，已使用示例对话`)
        actionsRef.current.s3AiSuccess({ ...fallbackRoundAt(s3.rounds.length), fallback: true })
        actionsRef.current.s3AiFail(msg)
      }
    } catch {
      toastRef.current?.('AI 调用异常，已使用示例对话')
      actionsRef.current.s3AiSuccess({ ...fallbackRoundAt(s3.rounds.length), fallback: true })
      actionsRef.current.s3AiFail('AI 调用异常')
    } finally {
      inFlight.current = false
      setRegenerating(false)
    }
  }, [])

  // 触发条件：
  // - 没有 current、未收尾、且不是正在生成 → 请求下一轮
  // - 阶段 01 内容变了（指纹不同）→ 重置后重新生成
  //
  // 防死循环：无材料时不自动请求（页面显示空态），
  // 用 attemptedRef 记住「这一轮已经试过」，失败后不自动重试，等用户点「重试」。
  const attemptedRef = useRef('')
  // 手动重试计数器：重置后即使状态字段没变，也要重新触发 effect
  const [tick, setTick] = useState(0)

  const requestRoundRef = useRef(requestRound)
  requestRoundRef.current = requestRound

  useEffect(() => {
    const snap = stateRef.current
    const st = snap.stage03
    if (st.aiStatus === 'loading') return
    if (st.done) return
    if (st.current) return

    const currentSig = stage01Signature(snap.stage01)
    const contentChanged = st.rounds.length > 0 && st.aiSourceSignature !== currentSig

    if (contentChanged) {
      actionsRef.current.s3Reset()
      return
    }

    // 同一轮失败过就不再自动重试，避免无限循环
    const attemptKey = `${st.rounds.length}:${currentSig}`
    if (attemptedRef.current === attemptKey) return
    attemptedRef.current = attemptKey

    requestRoundRef.current()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.stage03.current,
    state.stage03.done,
    state.stage03.aiStatus,
    state.stage03.rounds.length,
    tick,
  ])

  const regenerate = useCallback(() => {
    setRegenerating(true)
    attemptedRef.current = ''
    actionsRef.current.s3Reset()
    setTick((n) => n + 1)
  }, [])

  // ---- 后台预取：为当前这一轮的 4 个草稿分别算出下一轮 ----
  // 不阻塞用户；失败也不提示，用户点草稿时退回真实请求。
  // 触发时机：current 变了且本轮不是收尾轮、且还没有预取结果。
  const prefetchRef = useRef('')
  const branchInFlight = useRef(false)

  useEffect(() => {
    const snap = stateRef.current
    const st = snap.stage03
    const cur = st.current

    // 只在「有一轮待回应、非收尾、未降级」时预取
    if (!cur || st.done || cur.done) return
    if (st.useFallback || st.aiStatus !== 'ai') return
    if (Object.keys(st.branches || {}).length > 0) return
    if (branchInFlight.current) return

    const options = Array.isArray(cur.options) ? cur.options : []
    if (options.length === 0) return

    // 同一轮只预取一次，避免 effect 抖动导致重复请求
    const sig = `${st.rounds.length}:${cur.question}`
    if (prefetchRef.current === sig) return
    prefetchRef.current = sig

    branchInFlight.current = true
    actionsRef.current.s3BranchStart?.()

    const runPrefetch = async () => {
      try {
        const res = await generate('exploreBranch', {
          fragments: fragmentsOf(snap.stage01),
          facts: snap.stage02.facts,
          emotions: snap.stage02.emotions.filter((e) => e.selected).map((e) => e.label),
          coreNeed: snap.stage02.coreNeed,
          history: st.rounds.map((r) => ({ chat: r.chat, reply: r.reply, replyKey: r.replyKey })),
          current: {
            chat: cur.chat,
            question: cur.question,
            options: cur.options.map((o) => ({ key: o.key, text: o.text })),
          },
        })

        if (res.ok && Array.isArray(res.data?.branches) && res.data.branches.length > 0) {
          actionsRef.current.s3BranchSuccess(res.data.branches)
        } else {
          actionsRef.current.s3BranchFail()
        }
      } catch {
        actionsRef.current.s3BranchFail()
      } finally {
        branchInFlight.current = false
      }
    }

    runPrefetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.stage03.current, state.stage03.done])

  return {
    status: state.stage03.aiStatus,
    error: state.stage03.aiError,
    regenerating,
    regenerate,
    hasFragments: fragmentsOf(state.stage01).length > 0,
    // 预取是否就绪：就绪时点草稿零等待
    branchReady: Object.keys(state.stage03.branches || {}).length > 0,
    branchLoading: Boolean(state.stage03.branchLoading),
  }
}
