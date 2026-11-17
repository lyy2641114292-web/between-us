// ============================================================
// 阶段 02 的 AI 生成逻辑
// - 进入阶段时自动触发一次（若已有 AI 结果则跳过）
// - 失败降级到模板内容
// - 支持手动「重新生成」
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react'

import { generate } from '../../ai/client.js'
import { useApp } from '../../state/AppProvider.jsx'
import { fragmentsOf, stage01Signature } from '../../state/store.js'

export function useStage02AI(toast) {
  const { state, actions } = useApp()
  const [regenerating, setRegenerating] = useState(false)
  const inFlight = useRef(false)

  // 用 ref 持有最新 state，避免 useCallback 闭包读到旧值
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
      actionsRef.current.s2AiFail('还没有记录任何片段，无法生成分析')
      return
    }

    inFlight.current = true
    if (manual) setRegenerating(true)
    actionsRef.current.s2AiStart()

    try {
      const res = await generate('analyze', { fragments: fragmentsOf(snap.stage01) })

      if (res.ok && res.data) {
        actionsRef.current.s2AiSuccess(res.data)
        toastRef.current?.('已根据你的记录生成分析')
      } else {
        const msg = res.message || 'AI 暂时不可用'
        actionsRef.current.s2AiFail(msg)
        toastRef.current?.(`${msg}，已使用示例内容`)
      }
    } catch {
      actionsRef.current.s2AiFail('AI 调用异常')
      toastRef.current?.('AI 调用异常，已使用示例内容')
    } finally {
      inFlight.current = false
      setRegenerating(false)
    }
  }, [])

  // 进入阶段时自动生成一次（已有结果或正在加载则跳过）
  useEffect(() => {
    const st = stateRef.current.stage02
    if (st.aiStatus === 'loading') return

    // 首次进入，或阶段 01 的内容变过了 → 需要（重新）生成
    const currentSig = stage01Signature(stateRef.current.stage01)
    const contentChanged = st.aiStatus !== 'idle' && st.aiSourceSignature !== currentSig

    if (st.aiStatus === 'idle' || contentChanged) {
      run()
    }
  }, [run])

  return {
    status: state.stage02.aiStatus,
    error: state.stage02.aiError,
    regenerating,
    regenerate: () => run({ manual: true }),
    hasFragments: fragmentsOf(state.stage01).length > 0,
  }
}
