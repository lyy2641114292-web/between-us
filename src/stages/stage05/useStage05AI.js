// ============================================================
// 阶段 05 的 AI 生成逻辑
// 根据前四个阶段的内容生成表达草稿与五条反思
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react'

import { generate } from '../../ai/client.js'
import { useApp } from '../../state/AppProvider.jsx'
import { fragmentsOf, stage01Signature } from '../../state/store.js'

// 「还没有材料」这个状态的固定标记（只要片段仍为空，签名就不变）
const EMPTY_SIG = '__no_fragments__'

export function useStage05AI(toast) {
  const { state, actions } = useApp()
  const [regenerating, setRegenerating] = useState(false)
  const inFlight = useRef(false)
  // 「阶段 01 还没有任何片段」的本地去重标记，避免反复派发 action 造成渲染循环
  const emptySigRef = useRef(null)

  const stateRef = useRef(state)
  stateRef.current = state
  const actionsRef = useRef(actions)
  actionsRef.current = actions
  const toastRef = useRef(toast)
  toastRef.current = toast

  const run = useCallback(async ({ manual = false } = {}) => {
    if (inFlight.current) return

    const snap = stateRef.current
    if (fragmentsOf(snap.stage01).length === 0) {
      // 没有材料：同一个签名下只提示一次。
      // 这里不能每次都派发 action —— effect 依赖 state，反复派发会形成
      // 「派发 → state 变 → effect 再跑 → 再派发」的无限循环（2026-11-17 实测踩到）。
      // 记一个本地签名：材料为空且内容没变时直接返回，不再触发任何状态更新。
      if (emptySigRef.current === EMPTY_SIG) return
      emptySigRef.current = EMPTY_SIG
      actionsRef.current.s5AiFail('还没有记录任何片段')
      return
    }
    // 有材料了，清掉「空材料」标记，允许后续正常请求
    emptySigRef.current = null

    inFlight.current = true
    if (manual) setRegenerating(true)
    actionsRef.current.s5AiStart()

    try {
      const res = await generate('draft', {
        fragments: fragmentsOf(snap.stage01),
        facts: snap.stage02.facts,
        interpretations: snap.stage02.interpretations,
        coreNeed: snap.stage02.coreNeed,
        insights: snap.stage03.insights,
        note: snap.stage03.note,
        intent: snap.stage05.intent,
      })

      if (res.ok && res.data) {
        actionsRef.current.s5AiSuccess(res.data)
        toastRef.current?.('已根据你的情境生成表达草稿')
      } else {
        const msg = res.message || 'AI 暂时不可用'
        actionsRef.current.s5AiFail(msg)
        toastRef.current?.(`${msg}，已使用示例草稿`)
      }
    } catch {
      actionsRef.current.s5AiFail('AI 调用异常')
      toastRef.current?.('AI 调用异常，已使用示例草稿')
    } finally {
      inFlight.current = false
      setRegenerating(false)
    }
  }, [])

  useEffect(() => {
    const st = stateRef.current.stage05
    if (st.aiStatus === 'loading') return

    // 只有 express / explain 会显示草稿面板
    const isDraftType = st.intent === 'express' || st.intent === 'explain'
    if (!isDraftType) return

    // 阶段 01 内容变过 → 之前的结果作废，允许重新请求
    const currentSig = stage01Signature(stateRef.current.stage01)
    const contentChanged = Boolean(st.aiSourceSignature) && st.aiSourceSignature !== currentSig

    // 这一方向已有缓存：
    //   · 内容没变 → 直接用，不再请求（切换方向不重复生成）
    //   · 内容变了 → 作废缓存，重新请求
    const hasCache = Boolean(st.aiDraftsByIntent?.[st.intent])
    if (hasCache && !contentChanged) return

    // 这一方向已试过（成功或失败都算）且内容没变 → 不再自动重试，等用户点「重新生成」
    const tried = Boolean(st.aiTriedIntent?.[st.intent])
    if (tried && !contentChanged) return

    run()
  }, [run, state])

  return {
    status: state.stage05.aiStatus,
    error: state.stage05.aiError,
    regenerating,
    // 「重新生成」只清空当前方向，另一方向的草稿保持不动
    regenerate: () => {
      actionsRef.current.s5ClearCurrentIntentCache()
      setRegenerating(true)
      // 等 reducer 落地后再发起请求
      setTimeout(() => run({ manual: true }), 0)
    },
    hasFragments: fragmentsOf(state.stage01).length > 0,
  }
}
