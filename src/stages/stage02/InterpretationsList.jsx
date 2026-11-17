// ============================================================
// 感受与判断列表
//
// 用户需求（2026-11-15）：
// - 去掉「点击展开」「保留为未知」「+ 补充其他可能性」
// - 每条改为卡片常显全部内容
// - 每条右侧加静观入口，点击打开静观并把这条内容预填进输入框
// ============================================================
function InterpretationCard({ item, onOpenStillpoint }) {
  return (
    <div className="interp-item s2-abyss-glass s2-abyss-warm rounded-[22px] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <p className="text-[15px] sm:text-base text-slate-100 font-normal leading-relaxed">{item.statement}</p>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#f28c38]/15 px-2.5 py-0.5 text-[11px] text-orange-200/90">
          <span>✦</span>
          <span>{item.filterTag}</span>
        </span>
      </div>

      <div className="mt-4 space-y-3 border-t border-white/[0.06] pt-4">
        {/* AI 提问 */}
        {item.aiPrompt && (
          <div className="flex items-start gap-3 rounded-2xl bg-white/[0.03] px-4 py-3">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#f28c38] coral-pulse" />
            <p className="text-xs sm:text-[13px] leading-relaxed text-slate-300/95 font-light">{item.aiPrompt}</p>
          </div>
        )}

        {/* 其他可能性 */}
        {item.alternatives?.length > 0 && (
          <div className="space-y-1.5">
            {item.alternatives.map((a, i) => (
              <div
                key={`${i}-${a.slice(0, 6)}`}
                className="flex items-start gap-2 rounded-xl bg-amber-400/[0.06] px-3.5 py-2 text-xs text-amber-100/90"
              >
                <span className="mt-0.5 text-amber-300">✦</span>
                <span>{a}</span>
              </div>
            ))}
          </div>
        )}

        {/* 静观入口 */}
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={() => onOpenStillpoint(item)}
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-400/15 px-3.5 py-1.5 text-[11px] text-amber-100 transition-all hover:bg-amber-400/25 cursor-pointer"
            title="就这条和静观聊聊"
          >
            <span className="coral-pulse h-1.5 w-1.5 rounded-full bg-[#f28c38]" />
            <span>就这条问问静观</span>
            <span>→</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default function InterpretationsList({ items, onOpenStillpoint }) {
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <InterpretationCard key={item.id} item={item} onOpenStillpoint={onOpenStillpoint} />
      ))}
    </div>
  )
}
