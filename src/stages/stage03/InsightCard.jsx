// ============================================================
// 阶段 03 · 换位觉察卡
//
// 角色互换模式下，这张卡是「回到你自己的位置」回看的地方：
// 气泡里你演的是朋友，这里回到「你」自己的视角。
//
// 2026-11-16 用户指定（docs/复刻差异清单.md 3.7）：
//   - 人称只用「你」与「朋友」，不出现「她」
//   - 不再出现「这一部分切回你自己的视角：你 = 你自己，她 = 朋友（她）」的说明小字
//   - 引导语与 4 个觉察项由 AI 按本次对话生成；AI 没给时回落到本地兜底
// ============================================================
import { S3_INSIGHTS, S3_INSIGHT_HINT } from '../../data/stage03.js'

export default function InsightCard({
  hint,
  items,
  selected,
  note,
  onToggle,
  onNote,
  onNext,
}) {
  const hintText = (hint || '').trim() || S3_INSIGHT_HINT
  const list = Array.isArray(items) && items.length ? items : S3_INSIGHTS

  return (
    <div className="w-full max-w-4xl mx-auto pt-3 animate-reveal">
      <div className="glass-other rounded-[24px] p-6 sm:p-7 space-y-5 relative overflow-hidden">
        <div className="flex items-center">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-[#5da9e9] breathe-blue-calm" />
            <h2 className="font-serif-sc text-base sm:text-lg text-sky-100 font-normal">换位后的新发现</h2>
          </div>
        </div>

        <p className="text-sm sm:text-[15px] text-slate-100/95 leading-relaxed">{hintText}</p>

        <div className="flex flex-wrap gap-2.5">
          {list.map((text) => (
            <button
              key={text}
              type="button"
              onClick={() => onToggle(text)}
              className={`insight-chip px-4 py-2 rounded-full text-xs bg-white/[0.04] text-slate-300 border border-white/[0.1] ${
                selected.includes(text) ? 'active' : ''
              }`}
            >
              {text}
            </button>
          ))}
        </div>

        <div className="pt-1">
          <input
            type="text"
            value={note}
            onChange={(e) => onNote(e.target.value)}
            placeholder="可选：写下一句你在此刻注意到的细节或真实感受……"
            className="w-full bg-slate-950/45 border border-white/[0.08] rounded-2xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#5da9e9]/40"
          />
        </div>

        <div className="pt-3 border-t border-white/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-xs text-slate-400/90">✦ 不必认同对方，这只是你在换位时的真实感受。</p>
          <button
            type="button"
            onClick={onNext}
            className="cta-warm text-white text-xs sm:text-sm font-medium tracking-wider px-6 py-2.5 rounded-full flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            <span>完成换位体验 · 对照视角</span>
            <span>→</span>
          </button>
        </div>
      </div>
    </div>
  )
}