// ============================================================
// 阶段 03：探索对方 · 角色互换纯对话
//
// 2026-11-16 用户指定（见 docs/复刻差异清单.md 3.7）：
//   - 用户扮演「朋友（她）」，AI 扮演「原来的你」
//   - 左侧气泡固定 = 原来的你，右侧气泡固定 = 朋友（她）
//   - 只有纯对话，不出现任何旁白、动作、心理描写
//   - 每轮：对话 + 提问 + A/B 两个草稿（也可自由输入）
//   - AI 判断对话够了（done）即收尾，显示换位觉察卡
//
// 视觉沿用原型：轨道头图、能量光点 SMIL 动画、玻璃气泡、觉察卡。
// ============================================================
import { useEffect, useRef } from 'react'

import { useApp } from '../state/AppProvider.jsx'
import AiStatusBar from './stage02/AiStatusBar.jsx'
import ChatBubble from './stage03/ChatBubble.jsx'
import InsightCard from './stage03/InsightCard.jsx'
import OrbitHeader from './stage03/OrbitHeader.jsx'
import ReplyPanel from './stage03/ReplyPanel.jsx'
import { useStage03AI } from './stage03/useStage03AI.js'

export default function Stage03Explore({ onNext, onPrev, toast }) {
  const { state, actions } = useApp()
  const s3 = state.stage03

  const ai = useStage03AI(toast)

  const dotRef = useRef(null)
  const animRef = useRef(null)
  const pulseTimer = useRef(null)

  // 能量光点脉冲（原型 triggerS3Pulse）
  const triggerPulse = () => {
    const dot = dotRef.current
    const anim = animRef.current
    if (!dot || !anim) return
    dot.setAttribute('opacity', '0.95')
    try {
      anim.beginElement()
    } catch {
      /* 部分浏览器不支持 beginElement，忽略 */
    }
    clearTimeout(pulseTimer.current)
    pulseTimer.current = setTimeout(() => dot.setAttribute('opacity', '0'), 1150)
  }

  useEffect(() => () => clearTimeout(pulseTimer.current), [])

  // 以「朋友（她）」的身份回应当前这一轮
  // 优先命中后台预取的分支（0 秒）；未命中才走真实请求
  const answer = (text, key) => {
    const raw = (text || '').trim()
    if (!raw) return

    const hasBranch = key && s3.branches && s3.branches[key]
    if (hasBranch) {
      actions.s3AnswerFromBranch(raw, key)
    } else {
      actions.s3Answer(raw, key)
    }

    triggerPulse()
    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
    }, 260)
  }

  const submitCustom = () => answer(s3.draft, '自由输入')

  const resetDialogue = () => {
    actions.s3Reset()
    toast('已重置推演，回到第 1 轮初始状态')
  }

  const current = s3.current
  const isEmpty = s3.rounds.length === 0 && !current

  return (
    <section className="flex-col gap-6 w-full max-w-5xl mx-auto flex">
      <OrbitHeader dotRef={dotRef} animRef={animRef} onReset={resetDialogue} />

      {/* AI 生成状态 */}
      <div className="w-full max-w-4xl mx-auto">
        <AiStatusBar
          status={ai.status}
          error={ai.error}
          regenerating={ai.regenerating}
          onRegenerate={ai.regenerate}
          hasFragments={ai.hasFragments}
          loadingText="正在准备下一轮换位对话…"
          doneText="当前是示例对话（AI 不可用时的兜底）。记录补充后重新进入会重新生成。"
        />
      </div>

      {/* 对话流 */}
      <div className="w-full max-w-4xl mx-auto space-y-5">
        {isEmpty && (
          <div className="glass-panel rounded-2xl p-6 text-center">
            <p className="text-xs leading-relaxed text-slate-400/80">
              {ai.status === 'loading' ? '正在准备换位对话…' : '还没有可推演的内容'}
            </p>
          </div>
        )}

        {/* 已完成轮次：对话 + 你替她说的那句 */}
        {s3.rounds.map((round, ri) => (
          <div key={`r-${ri}`} className="space-y-5 pb-2">
            <div className="flex items-center gap-2 px-1">
              <span className="text-[10px] tracking-widest text-slate-500">第 {ri + 1} 轮</span>
              <span className="h-px flex-1 bg-white/[0.05]" />
            </div>

            {round.chat.map((line, li) => (
              <ChatBubble key={`c-${ri}-${li}`} role={line.role} text={line.text} />
            ))}

            <ChatBubble role="right" text={round.reply} you tag={round.replyKey || '自由输入'} />
          </div>
        ))}

        {/* 当前轮：等用户以「朋友（她）」的身份回应 */}
        {current && !s3.done && (
          <>
            <div className="flex items-center gap-2 px-1">
              <span className="text-[10px] tracking-widest text-slate-500">第 {s3.rounds.length + 1} 轮</span>
              <span className="h-px flex-1 bg-white/[0.05]" />
            </div>

            {current.chat.map((line, li) => (
              <ChatBubble key={`cur-${li}`} role={line.role} text={line.text} />
            ))}

            <ReplyPanel
              round={current}
              draft={s3.draft}
              hasDraft={s3.draft.trim().length > 0}
              onPick={answer}
              onSetDraft={actions.s3SetDraft}
              onSubmit={submitCustom}
            />
          </>
        )}

        {/* AI 判定够了：等用户答完最后一轮 */}
        {s3.done && s3.rounds.length > 0 && (
          <div className="glass-panel rounded-full px-5 py-2.5 text-center">
            <p className="text-[11px] leading-relaxed text-slate-400/85">
              这段换位对话已经走到可以停下的地方。
            </p>
          </div>
        )}
      </div>

      {s3.done && (
        <InsightCard
          hint={s3.insightHint}
          items={s3.insightItems}
          selected={s3.insights}
          note={s3.note}
          onToggle={actions.s3ToggleInsight}
          onNote={actions.s3SetNote}
          onNext={onNext}
        />
      )}

      {/* 底部导航 */}
      <div className="w-full max-w-4xl mx-auto flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onPrev}
          className="text-xs text-slatefrost/75 hover:text-mistwhite cursor-pointer"
        >
          ← 返回理解自己
        </button>
        <button
          type="button"
          onClick={onNext}
          className="text-xs text-sky-200/85 hover:text-sky-100 transition-colors cursor-pointer"
        >
          直接前往对照视角 →
        </button>
      </div>
    </section>
  )
}
