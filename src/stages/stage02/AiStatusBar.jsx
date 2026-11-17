// ============================================================
// AI 生成状态条
// - loading：骨架加载态
// - template：降级提示 + 重新生成
// - ai：显示「已根据你的记录生成」+ 重新生成
//
// loadingText / doneText 可由各阶段覆盖文案（阶段 03 是对话，不是「梳理事实」）
// ============================================================
export default function AiStatusBar({
  status,
  error,
  regenerating,
  onRegenerate,
  hasFragments,
  loadingText = '正在根据你的记录梳理事实与判断…',
  doneText = '已根据你在「记录冲突」中写下的内容生成。所有内容都可以直接点击修改。',
}) {
  if (!hasFragments) {
    return (
      <div className="rounded-2xl border border-amber-300/20 bg-amber-400/[0.05] px-4 py-3">
        <p className="text-xs leading-relaxed text-amber-100/85">
          你还没有在「记录冲突」里写下任何片段。这里目前显示的是示例内容，回到上一步记录后会自动生成贴合你情境的分析。
        </p>
      </div>
    )
  }

  if (status === 'loading' || regenerating) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#f28c38] opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#f28c38]" />
        </span>
        <span className="text-xs text-slate-300/90">{loadingText}</span>
        <span className="ml-auto text-[10px] text-slate-500">约需 10–25 秒</span>
      </div>
    )
  }

  if (status === 'template') {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-300/25 bg-amber-400/[0.06] px-4 py-3">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-300 shrink-0" />
        <span className="text-xs leading-relaxed text-amber-100/90">
          AI 暂时不可用{error ? `（${error}）` : ''}，当前显示的是示例内容，可能与你的实际情况不符。
        </span>
        <button
          type="button"
          onClick={onRegenerate}
          className="ml-auto shrink-0 rounded-full border border-amber-300/35 bg-amber-400/15 px-3 py-1 text-[11px] text-amber-100 hover:bg-amber-400/25 transition-colors cursor-pointer"
        >
          ↻ 重试
        </button>
      </div>
    )
  }

  if (status === 'ai') {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] px-4 py-3">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 shrink-0" />
        <span className="text-xs leading-relaxed text-emerald-100/85">{doneText}</span>
        <button
          type="button"
          onClick={onRegenerate}
          className="ml-auto shrink-0 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-[11px] text-emerald-100 hover:bg-emerald-400/20 transition-colors cursor-pointer"
        >
          ↻ 重新生成
        </button>
      </div>
    )
  }

  return null
}
