// ============================================================
// 阶段 01 的 AI 追问逻辑
// - 进入阶段时自动生成第一个问题
// - 每次提交回答后，基于全部问答生成下一个问题
// - 点「进入理解自己」时生成核心主题摘要
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react'

import { generate } from '../../ai/client.js'
import { useApp } from '../../state/AppProvider.jsx'

export function useStage01Probe(toast) {
  const { state, actions } = useApp()
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)

  const stateRef = useRef(state)
  stateRef.current = state
  const actionsRef = useRef(actions)
  actionsRef.current = actions
  const toastRef = useRef(toast)
  toastRef.current = toast

  // 只用已作答的轮次作为上下文
  const answeredQA = (s1) => s1.qa.filter((q) => q.answer && q.answer.trim())

  // overrideQA：调用方已把最新回答合并进去时传入，避免读到旧 state
  const askNext = useCallback(async (overrideQA) => {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    actionsRef.current.s1ProbeStart()

    const s1 = stateRef.current.stage01
    const qa = overrideQA || answeredQA(s1).map((q) => ({ question: q.question, answer: q.answer }))
    try {
      const res = await generate('probe', {
        qa,
        summary: s1.coreSummary,
      })

      if (res.ok && res.data?.question) {
        actionsRef.current.s1ProbeSuccess(res.data)
        // 问题已经显示给用户了，立刻在后台预取下一条分支，不阻塞界面
        prefetchBranches(res.data, qa)
      } else {
        actionsRef.current.s1ProbeFail(res.message || '生成问题失败')
        toastRef.current?.(res.message || '暂时无法生成下一个问题')
      }
    } catch {
      actionsRef.current.s1ProbeFail('网络异常')
      toastRef.current?.('暂时无法生成下一个问题，请稍后重试')
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }, [])

  // 后台预取：为当前这批标签分别算出「点了它会问什么」。
  // 不阻塞用户，失败也不提示——用户点标签时会退回真实请求。
  //
  // 注意：不能用 stateRef 读 roundId。s1ProbeSuccess 刚 dispatch，React 还没提交，
  // 读到的可能是上一轮。这里让 reducer 直接作用于「最后一轮」，不依赖 id。
  const prefetchBranches = useCallback(async (probeData, qaForPrompt) => {
    const chips = (Array.isArray(probeData?.chips) ? probeData.chips : [])
      .map((c) => (typeof c === 'string' ? c.trim() : c && typeof c.label === 'string' ? c.label.trim() : ''))
      .filter(Boolean)
    if (chips.length === 0) {
      actionsRef.current.s1BranchFail()
      return
    }

    try {
      const res = await generate('probeBranch', {
        qa: Array.isArray(qaForPrompt) ? qaForPrompt : [],
        question: probeData.question || '',
        chips,
      })

      if (res.ok && Array.isArray(res.data?.branches) && res.data.branches.length > 0) {
        actionsRef.current.s1BranchSuccess({ branches: res.data.branches })
        return
      }
      actionsRef.current.s1BranchFail()
    } catch {
      actionsRef.current.s1BranchFail()
    }
  }, [])

  // 进入阶段时：没有问题就生成第一个
  //
  // 注意 !loading 守卫会带来一个死锁风险：如果 loading 是上次会话残留的 true
  // （请求途中刷新/关页），这里会直接跳过，而 loading 又没有任何路径能自己变回 false，
  // 界面就会永久停在「正在准备第一个问题…」。
  // persist.js 已经会在读取存档时复位这些标记；这里再加一道：
  // 挂载时若发现 qa 为空且「没有真实请求在飞」（inFlight 为 false），强制发起一次。
  useEffect(() => {
    const s1 = stateRef.current.stage01
    if (s1.qa.length === 0 && !inFlight.current) {
      askNext()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 点标签：命中后台预取的分支 → 零等待进入下一问
  // 未命中（后台还没算完 / 预取失败）→ 走正常提交 + 请求下一问
  // 文本恰好等于某个标签时同样走预取分支，避免无谓的一次完整往返
  const pickChip = async (chip) => {
    const s1 = stateRef.current.stage01
    const last = s1.qa[s1.qa.length - 1]
    if (!last) return

    const target = (chip || '').trim()
    if (!target) return

    const matched = (last.chips || []).find((c) => c.label === target)
    if (matched && matched.nextQuestion) {
      actionsRef.current.s1PickChip(matched)
      return
    }
    await submitAnswer(target)
  }

  // 多选合并提交：优先用第一个选中标签的预取分支，避免必然走网络
  const pickMulti = async (firstLabel, mergedText) => {
    const s1 = stateRef.current.stage01
    const last = s1.qa[s1.qa.length - 1]
    if (!last) return

    const matched = (last.chips || []).find((c) => c.label === firstLabel)
    if (matched && matched.nextQuestion) {
      // 记录合并后的完整文本作为回答，但下一问沿用第一条标签的预取结果
      actionsRef.current.s1ChipMulti(matched, mergedText)
      return
    }
    await submitAnswer(mergedText)
  }

  // 提交回答后自动追问下一个
  const submitAnswer = async (text) => {
    const t = (text || '').trim()
    if (!t) {
      toastRef.current?.('可以写下具体发生了什么，或者点一个标签')
      return
    }

    // 先把这次回答合进上下文，再请求下一问，
    // 避免依赖 React 提交时序（之前会读到旧 state 导致答案错位）
    const s1 = stateRef.current.stage01
    const qa = [...s1.qa]
    const idx = [...qa].reverse().findIndex((q) => !q.answer)
    if (idx >= 0) {
      const realIdx = qa.length - 1 - idx
      qa[realIdx] = { ...qa[realIdx], answer: t }
    }
    const mergedQA = qa
      .filter((q) => q.answer && q.answer.trim())
      .map((q) => ({ question: q.question, answer: q.answer }))

    actionsRef.current.s1Answer(t)
    await askNext(mergedQA)
  }

  // 生成核心主题摘要，返回是否成功
  const buildSummary = useCallback(async () => {
    const s1 = stateRef.current.stage01
    const qa = answeredQA(s1).map((q) => ({ question: q.question, answer: q.answer }))
    if (qa.length === 0) return false

    actionsRef.current.s1SummaryStart()
    try {
      const res = await generate('summarize', { qa })
      if (res.ok && res.data) {
        actionsRef.current.s1SummarySuccess(res.data)
        return true
      }
      actionsRef.current.s1SummaryFail()
      return false
    } catch {
      actionsRef.current.s1SummaryFail()
      return false
    }
  }, [])

  const answeredCount = answeredQA(state.stage01).length

  return {
    busy: busy || state.stage01.loading,
    error: state.stage01.error,
    enough: state.stage01.enough,
    answeredCount,
    // 已完成 ≥2 轮 或 AI 判断够了，才能进入下一阶段
    canProceed: answeredCount >= 2 || state.stage01.enough,
    askNext,
    submitAnswer,
    pickChip,
    pickMulti,
    buildSummary,
    summaryLoading: state.stage01.summaryLoading,
    branchLoading: Boolean(state.stage01.branchLoading),
  }
}
