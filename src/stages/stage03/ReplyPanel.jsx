// ============================================================
// 阶段 03 · 角色互换的回应区
//
// 用户此刻扮演「朋友（她）」，所以这里产出的都是「她」会说的话：
//   - 四个情绪角度草稿（key 为 2~4 字关键词，正文 1~2 行）
//   - 自由输入：用户自己写
// 见 docs/复刻差异清单.md 3.7
// ============================================================

export default function ReplyPanel({ round, draft, hasDraft, onPick, onSetDraft, onSubmit }) {
  const options = Array.isArray(round.options) ? round.options : []

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 pt-1">
      <div className="flex items-center justify-between px-2">
        <span className="text-xs sm:text-sm text-slate-300/90">{round.question}</span>
        <span className="text-[11px] text-[#5da9e9]/85 tracking-wider">以朋友的身份</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {options.map((opt, i) => {
          const key = opt?.key || String.fromCharCode(65 + i)
          const text = opt?.text
          if (!text) return null
          return (
            <button
              key={`${key}-${i}`}
              type="button"
              onClick={() => onPick(text, key)}
              className="reaction-pill glass-panel rounded-[22px] p-4 sm:p-5 text-left space-y-1.5"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[#5da9e9]/35 text-[10px] text-[#5da9e9]">
                  {i + 1}
                </span>
                <span className="text-xs font-medium text-[#5da9e9] tracking-wider">{key}</span>
              </div>
              <p className="text-xs sm:text-[13px] text-slate-300/90 leading-relaxed">{text}</p>
            </button>
          )
        })}
      </div>

      <div className="glass-panel rounded-full p-1.5 pl-5 flex items-center gap-3 focus-within:border-[#5da9e9]/45 focus-within:shadow-[0_0_24px_rgba(93,169,233,0.16)]">
        <input
          type="text"
          value={draft}
          onChange={(e) => onSetDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSubmit()
          }}
          placeholder="或者，用朋友的口吻写下你会怎么回应…"
          className="flex-1 bg-transparent text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={onSubmit}
          className={`px-4 sm:px-5 py-2 rounded-full text-xs border transition-all duration-300 shrink-0 cursor-pointer ${
            hasDraft
              ? 'bg-[#5da9e9]/25 hover:bg-[#5da9e9]/35 text-sky-100 border-[#5da9e9]/45 shadow-[0_0_18px_rgba(93,169,233,0.28)]'
              : 'bg-white/[0.05] text-slate-400 border-white/[0.08]'
          }`}
        >
          以朋友的位置回应 ↑
        </button>
      </div>
    </div>
  )
}