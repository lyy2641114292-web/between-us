// ============================================================
// 阶段 02：理解自己 · UNDERSTAND ME（原型 6.html L1040-1167 + L2007-2265）
//
// 与原型的对应关系：
// - 情绪胶囊选中 → 联动恒星外层星云、动态光环层数与核心光晕
// - 点击真实需求条 → 原地编辑；保存后内环收缩（needCondensed）
// - 客观事实可原地编辑、可新增
// - 感受与判断可展开、搁置为未知、补充其他可能性
// - 点击对方伴星 → 触发 02 ⇄ 03 双星互换（第 6 步实现过渡，本步先切阶段）
// ============================================================
import { useApp } from '../state/AppProvider.jsx'

import SelfStar from './stage02/SelfStar.jsx'
import EmotionPills from './stage02/EmotionPills.jsx'
import CoreNeed from './stage02/CoreNeed.jsx'
import FactsList from './stage02/FactsList.jsx'
import InterpretationsList from './stage02/InterpretationsList.jsx'
import AiStatusBar from './stage02/AiStatusBar.jsx'
import { useStage02AI } from './stage02/useStage02AI.js'

export default function Stage02Understand({ onNext, onPrev, toast, onExploreOther, onAskStillpoint: askStillpoint, swapping = false }) {
  const { state, actions } = useApp()
  const s2 = state.stage02

  // 点某条「感受与判断」→ 打开静观并预填这条内容
  const onAskStillpoint = (item) => {
    const seed = {
      text: `我想聊聊这一条：${item.statement}${item.aiPrompt ? `\n\n（提示：${item.aiPrompt}）` : ''}`,
      source: 'stage02',
      statement: item.statement,
    }
    askStillpoint?.(seed)
  }

  // 进入本阶段时自动调用 AI，根据阶段 01 的内容生成事实与判断
  const ai = useStage02AI(toast)

  // 互换前 480ms：原型让自我恒星缩小远退、伴星放大前移（triggerS2ToS3Swap）
  const selfStarStyle = swapping
    ? { transform: 'translate3d(120px, -22px, 0) scale(0.72)', opacity: 0.2 }
    : undefined
  const otherStarStyle = swapping
    ? { transform: 'translate3d(-140px, 24px, 0) scale(1.32)', opacity: 0.95 }
    : undefined

  const handleSaveNeed = (text) => {
    actions.setCoreNeed(text)
    toast('真实需求已更新，恒星光晕向内核收敛')
  }

  const handleConfirmAddFact = () => {
    const t = s2.newFactDraft.trim()
    if (t) {
      actions.addFactText(t)
      toast('已补充一条客观事实')
    } else {
      actions.setAddingFact(false)
    }
  }

  return (
    <section className="flex-col gap-8 w-full flex">
      {/* 一、核心视觉焦点：动态双星系统 + 情绪光谱联动 + 真实需求收敛环 */}
      <div aria-label="双星情感引力场" className="relative pt-1 pb-2">
        <svg
          className="absolute inset-x-0 top-0 w-full h-64 pointer-events-none overflow-visible"
          viewBox="0 0 1000 240"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="s2BinaryLink" x1="25%" y1="60%" x2="82%" y2="25%">
              <stop offset="0%" stopColor="#f28c38" stopOpacity="0.55" />
              <stop offset="50%" stopColor="#FDE68A" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#5da9e9" stopOpacity="0.32" />
            </linearGradient>
          </defs>
          <ellipse
            cx="510"
            cy="115"
            rx="370"
            ry="78"
            transform="rotate(-7 510 115)"
            stroke="rgba(255,255,255,0.055)"
            strokeWidth="1"
            fill="none"
          />
          <path d="M 270 135 Q 520 75 810 56" stroke="url(#s2BinaryLink)" strokeWidth="1.2" strokeDasharray="3 6" fill="none" />
        </svg>

        {/* 双星空间分布层 */}
        <div className="relative flex flex-col md:flex-row items-center md:items-start justify-between gap-6 px-2 sm:px-8">
          <div style={selfStarStyle} className="orbit-swap-transition">
            <SelfStar emotions={s2.emotions} needCondensed={s2.needCondensed} />
          </div>

          {/* 右上方远景处：对方伴星 */}
          <div
            style={otherStarStyle}
            className="group orbit-swap-transition flex items-center gap-3.5 self-end md:self-start md:pt-2 md:pr-6 opacity-85 hover:opacity-100 cursor-pointer"
            onClick={onExploreOther}
          >
            <div className="text-right opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-400">
              <span className="text-xs tracking-[0.16em] text-sky-300/90">对方伴星 · 点击切换</span>
            </div>
            <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
              <span className="absolute inset-0 rounded-full bg-[#5da9e9]/20 blur-xl group-hover:bg-[#5da9e9]/35 transition-colors" />
              <span className="absolute inset-2 rounded-full border border-sky-300/25 border-dashed" />
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-100 via-[#5da9e9]/85 to-blue-950 shadow-[0_0_26px_rgba(93,169,233,0.55)] group-hover:scale-110 transition-transform" />
            </div>
          </div>
        </div>

        {/* 悬浮情绪气泡胶囊组 + 真实需求核心条 */}
        <div className="mt-5 sm:mt-4 max-w-4xl mx-auto space-y-4">
          <EmotionPills emotions={s2.emotions} onToggle={actions.toggleEmotion} />
          <CoreNeed
            value={s2.coreNeed}
            onSave={handleSaveNeed}
            onEnterEdit={actions.condenseNeed}
          />
        </div>
      </div>

      {/* 二、AI 状态提示 */}
      <div className="px-1">
        <AiStatusBar
          status={ai.status}
          error={ai.error}
          regenerating={ai.regenerating}
          onRegenerate={ai.regenerate}
          hasFragments={ai.hasFragments}
        />
      </div>

      {/* 三、客观事实 / 感受与判断 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 lg:gap-9 items-start pt-1">
        {/* 左：客观事实 */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between min-h-[28px] px-2">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-sky-300 shadow-[0_0_10px_rgba(125,211,252,0.75)]" />
              <h2 className="font-serif-sc text-lg text-slate-100 font-normal">客观事实 · Actual Facts</h2>
            </div>
          </div>

          <FactsList
            facts={s2.facts}
            addingFact={s2.addingFact}
            newFactDraft={s2.newFactDraft}
            onEditFact={actions.editFact}
            onOpenAdd={() => actions.setAddingFact(true)}
            onCloseAdd={() => actions.setAddingFact(false)}
            onDraftChange={actions.setNewFactDraft}
            onConfirmAdd={handleConfirmAddFact}
          />
        </div>

        {/* 右：感受与判断 */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between gap-2 min-h-[28px] px-2">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#f28c38] shadow-[0_0_12px_#f28c38]" />
              <h2 className="font-serif-sc text-lg text-slate-100 font-normal">感受与判断 · Interpretations</h2>
            </div>
            <span className="text-[11px] text-slate-400/75 font-light hidden sm:inline">有想不通的，可以问问静观</span>
          </div>

          <InterpretationsList items={s2.interpretations} onOpenStillpoint={onAskStillpoint} />

          <div className="pt-4 flex items-center justify-between px-1">
            <button
              type="button"
              onClick={onPrev}
              className="text-xs text-slatefrost/75 hover:text-mistwhite transition-colors cursor-pointer"
            >
              ← 返回补充事件
            </button>
            <button
              type="button"
              onClick={onExploreOther}
              className="cta-warm text-white text-xs sm:text-sm font-medium tracking-wider px-6 py-2.5 rounded-full flex items-center gap-2 cursor-pointer"
            >
              <span>切换位置 · 探索对方</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
