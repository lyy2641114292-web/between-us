// ============================================================
// 状态容器：Provider + useApp
// 持久化策略见 docs/设计规范.md 第 2 节：状态变化后防抖 400ms 写入
// ============================================================
import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { INITIAL_STATE, reducer } from './store.js'
import { clearState, loadState, saveState } from './persist.js'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  // 初始状态只读一次，避免每次渲染都碰 localStorage
  const bootRef = useRef(null)
  if (bootRef.current === null) bootRef.current = loadState()

  const [state, dispatch] = useReducer(reducer, bootRef.current.state)
  const [savedAt, setSavedAt] = useState(null)
  const timer = useRef(null)

  // 防抖写入
  useEffect(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      if (saveState(state)) setSavedAt(Date.now())
    }, 400)
    return () => clearTimeout(timer.current)
  }, [state])

  const actions = useMemo(
    () => ({
      setDraft: (v) => dispatch({ type: 's1/setDraft', payload: v }),
      // ---- 阶段 01：动态追问 ----
      s1ProbeStart: () => dispatch({ type: 's1/probeStart' }),
      s1ProbeSuccess: (d) => dispatch({ type: 's1/probeSuccess', payload: d }),
      s1ProbeFail: (m) => dispatch({ type: 's1/probeFail', payload: m }),
      // 后台预取：把每个标签的下一问填进当前这一轮
      s1BranchSuccess: (payload) => dispatch({ type: 's1/branchSuccess', payload }),
      s1BranchFail: () => dispatch({ type: 's1/branchFail' }),
      s1Answer: (v) => dispatch({ type: 's1/answer', payload: v }),
      s1PickChip: (chip) => dispatch({ type: 's1/pickChip', payload: chip }),
      // 多选合并提交：回答用合并文字，下一问用第一个标签的预取结果
      s1ChipMulti: (chip, answerText) => dispatch({ type: 's1/chipMulti', payload: { chip, answerText } }),
      s1EditAnswer: (id, answer) => dispatch({ type: 's1/editAnswer', payload: { id, answer } }),
      s1DeleteRound: (id) => dispatch({ type: 's1/deleteRound', payload: id }),
      // 回到上一题：清空最后一轮已答的回答，把问题留在原地让用户重答
      s1Revert: () => dispatch({ type: 's1/revert' }),
      s1SummaryStart: () => dispatch({ type: 's1/summaryStart' }),
      s1SummarySuccess: (d) => dispatch({ type: 's1/summarySuccess', payload: d }),
      s1SummaryFail: () => dispatch({ type: 's1/summaryFail' }),
      s1SetEnough: (v) => dispatch({ type: 's1/setEnough', payload: v }),
      resetStage01: () => dispatch({ type: 's1/reset' }),
      setStep: (v) => dispatch({ type: 's1/setStep', payload: v }),
      appendDraft: (v) => dispatch({ type: 's1/appendDraft', payload: v }),
      appendDraftNewline: (v) => dispatch({ type: 's1/appendDraftNewline', payload: v }),
      // ---- 阶段 02 ----
      toggleEmotion: (id) => dispatch({ type: 's2/toggleEmotion', payload: id }),
      setCoreNeed: (v) => dispatch({ type: 's2/setCoreNeed', payload: v }),
      condenseNeed: () => dispatch({ type: 's2/condenseNeed' }),
      editFact: (id, text) => dispatch({ type: 's2/editFact', payload: { id, text } }),
      setAddingFact: (open) => dispatch({ type: 's2/setAddingFact', payload: { open } }),
      setNewFactDraft: (v) => dispatch({ type: 's2/setNewFactDraft', payload: v }),
      addFact: () => dispatch({ type: 's2/addFact', payload: '' }),
      addFactText: (t) => dispatch({ type: 's2/addFact', payload: t }),
      toggleInterpExpand: (id) => dispatch({ type: 's2/toggleInterpExpand', payload: id }),
      toggleShelve: (id) => dispatch({ type: 's2/toggleShelve', payload: id }),
      toggleAltEditor: (id) => dispatch({ type: 's2/toggleAltEditor', payload: id }),
      addAlternative: (id, text) => dispatch({ type: 's2/addAlternative', payload: { id, text } }),
      s2AiStart: () => dispatch({ type: 's2/aiStart' }),
      s2AiSuccess: (data) => dispatch({ type: 's2/aiSuccess', payload: data }),
      s2AiFail: (msg) => dispatch({ type: 's2/aiFail', payload: msg }),
      // ---- 阶段 03 ----
      s3Answer: (text, key) => dispatch({ type: 's3/answer', payload: { text, key } }),
      s3Reset: () => dispatch({ type: 's3/reset' }),
      s3SetDraft: (v) => dispatch({ type: 's3/setDraft', payload: v }),
      s3ToggleInsight: (v) => dispatch({ type: 's3/toggleInsight', payload: v }),
      s3SetNote: (v) => dispatch({ type: 's3/setNote', payload: v }),
      // 后台预取：4 条分支各自的下一轮
      s3BranchStart: () => dispatch({ type: 's3/branchStart' }),
      s3BranchSuccess: (branches) => dispatch({ type: 's3/branchSuccess', payload: { branches } }),
      s3BranchFail: () => dispatch({ type: 's3/branchFail' }),
      // 命中预取分支时的零等待推进；未命中返回 false，由页面走真实请求
      s3AnswerFromBranch: (text, key) =>
        dispatch({ type: 's3/answerFromBranch', payload: { text, key } }),
      s3AiStart: () => dispatch({ type: 's3/aiStart' }),
      s3AiSuccess: (data) => dispatch({ type: 's3/aiSuccess', payload: data }),
      s3AiFail: (msg) => dispatch({ type: 's3/aiFail', payload: msg }),
      // ---- 阶段 04 ----
      s4SelectSelf: (id) => dispatch({ type: 's4/selectSelf', payload: id }),
      s4SelectOther: (id) => dispatch({ type: 's4/selectOther', payload: id }),
      s4SelectUnknown: (id) => dispatch({ type: 's4/selectUnknown', payload: id }),
      s4ToggleDrawer: () => dispatch({ type: 's4/toggleDrawer' }),
      s4AiStart: () => dispatch({ type: 's4/aiStart' }),
      s4AiSuccess: (d) => dispatch({ type: 's4/aiSuccess', payload: d }),
      s4AiFail: (m) => dispatch({ type: 's4/aiFail', payload: m }),
      // ---- 阶段 05 ----
      s5SelectIntent: (v) => dispatch({ type: 's5/selectIntent', payload: v }),
      s5SwitchTone: (v) => dispatch({ type: 's5/switchTone', payload: v }),
      s5SetDraft: (v) => dispatch({ type: 's5/setDraft', payload: v }),
      s5SetReflection: (key, text) => dispatch({ type: 's5/setReflection', payload: { key, text } }),
      s5ToggleSheet: () => dispatch({ type: 's5/toggleSheet' }),
      s5SyncCare: (v) => dispatch({ type: 's5/syncCare', payload: v }),
      s5AiStart: () => dispatch({ type: 's5/aiStart' }),
      s5AiSuccess: (d) => dispatch({ type: 's5/aiSuccess', payload: d }),
      s5AiFail: (m) => dispatch({ type: 's5/aiFail', payload: m }),
      s5ClearIntentSignature: () => dispatch({ type: 's5/clearIntentSignature' }),
      // 「重新生成」只清当前方向的缓存
      s5ClearCurrentIntentCache: () => dispatch({ type: 's5/clearCurrentIntentCache' }),
      // ---- 静观 ----
      spToggleOpen: () => dispatch({ type: 'sp/toggleOpen' }),
      spSetOpen: (v) => dispatch({ type: 'sp/setOpen', payload: v }),
      spOpenWithSeed: (seed) => dispatch({ type: 'sp/openWithSeed', payload: seed }),
      spClearSeed: () => dispatch({ type: 'sp/clearSeed' }),
      spInit: (opening, questions, signature) =>
        dispatch({ type: 'sp/init', payload: { opening, questions, signature } }),
      spAddUser: (text) => dispatch({ type: 'sp/addUserMessage', payload: text }),
      spAddAi: (reply, questions) => dispatch({ type: 'sp/addAiMessage', payload: { reply, questions } }),
      spSetQuestions: (q) => dispatch({ type: 'sp/setQuestions', payload: q }),
      spSetDraft: (v) => dispatch({ type: 'sp/setDraft', payload: v }),
      spBumpReroll: () => dispatch({ type: 'sp/bumpReroll' }),
      resetAll: () => {
        clearState()
        dispatch({ type: 'state/replace', payload: INITIAL_STATE })
      },
    }),
    [],
  )

  const value = useMemo(
    () => ({
      state,
      actions,
      savedAt,
      restored: bootRef.current.restored,
      corrupted: bootRef.current.corrupted,
    }),
    [state, actions, savedAt],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp 必须在 AppProvider 内使用')
  return ctx
}
