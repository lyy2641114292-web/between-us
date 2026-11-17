// ============================================================
// 阶段 04 的 AI 生成逻辑
// 根据前三个阶段的内容生成双视角对照
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react'

import { generate } from '../../ai/client.js'
import { useApp } from '../../state/AppProvider.jsx'
import { fragmentsOf, stage01Signature } from '../../state/store.js'

export function useStage04AI(toast) {
  const { state, actions } = useApp()
  const [regenerating, setRegenerating] = useState(false)
  const inFlight = useRef(false)

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
      actionsRef.current.s4AiFail('还没有记录任何片段')
      return
    }

    inFlight.current = true
    if (manual) setRegenerating(true)
    actionsRef.current.s4AiStart()

    try {
      const res = await generate('compare', {
        fragments: fragmentsOf(snap.stage01),
        facts: snap.stage02.facts,
        interpretations: snap.stage02.interpretations,
        emotions: snap.stage02.emotions.filter((e) => e.selected).map((e) => e.label),
        coreNeed: snap.stage02.coreNeed,
        insights: snap.stage03.insights,
        note: snap.stage03.note,
        // 角色互换对话的完整记录（只给答完的轮次，避免把「待回应」当成材料）
        exchange: snap.stage03.rounds.map((r) => ({
          chat: r.chat,
          reply: r.reply,
          replyKey: r.replyKey,
        })),
      })

      if (res.ok && res.data) {
        actionsRef.current.s4AiSuccess(res.data)
        toastRef.current?.('已根据你的情境生成双视角对照')
      } else {
        const msg = res.message || 'AI 暂时不可用'
        actionsRef.current.s4AiFail(msg)
        toastRef.current?.(`${msg}，已使用示例内容`)
      }
    } catch {
      actionsRef.current.s4AiFail('AI 调用异常')
      toastRef.current?.('AI 调用异常，已使用示例内容')
    } finally {
      inFlight.current = false
      setRegenerating(false)
    }
  }, [])

  useEffect(() => {
    const st = stateRef.current.stage04
    if (st.aiStatus === 'loading') return

    // 首次进入，或阶段 01 的内容变过了 → 需要（重新）生成
    const currentSig = stage01Signature(stateRef.current.stage01)
    const contentChanged = st.aiStatus !== 'idle' && st.aiSourceSignature !== currentSig

    if (st.aiStatus === 'idle' || contentChanged) {
      run()
    }
  }, [run])

  return {
    status: state.stage04.aiStatus,
    error: state.stage04.aiError,
    regenerating,
    regenerate: () => run({ manual: true }),
    hasFragments: fragmentsOf(state.stage01).length > 0,
  }
}
