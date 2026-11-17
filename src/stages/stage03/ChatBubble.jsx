// ============================================================
// 阶段 03 · 一个纯对话气泡
//
// role 决定左右与配色（docs/设计规范.md 7.3 双色语义）：
//   left  = 原来的你（暖橙）
//   right = 朋友（她）（天青）
//
// 角色互换模式下没有动作/旁白气泡，所以这里只有一种形态。
// ============================================================

export default function ChatBubble({ role, text, you = false, tag }) {
  if (role === 'left') {
    return (
      <div className="animate-reveal">
        <div className="glass-warm-solid max-w-3xl rounded-[22px] p-5 sm:p-6">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="breathe-warm-calm h-2 w-2 rounded-full bg-[#f28c38]" />
              <span className="text-xs tracking-wider text-orange-200/90">原来的你 · 你说的</span>
            </div>
          </div>
          <p className="font-serif-sc text-base font-light leading-relaxed text-slate-100 sm:text-lg">「{text}」</p>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-reveal flex justify-end">
      <div className="glass-other w-full max-w-2xl space-y-2 rounded-[22px] p-5 sm:w-auto">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-[11px] tracking-wider text-[#5da9e9]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#5da9e9]" />
            朋友（她）· 她说的
          </span>
          {you && (
            <span className="rounded-full border border-[#5da9e9]/30 bg-[#5da9e9]/15 px-2.5 py-0.5 text-[10px] text-sky-200">
              你替她回应 · {tag}
            </span>
          )}
        </div>
        <p className="text-sm leading-relaxed text-sky-50 sm:text-[15px]">「{text}」</p>
      </div>
    </div>
  )
}
