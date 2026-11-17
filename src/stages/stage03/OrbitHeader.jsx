// ============================================================
// 阶段 03 · 轨道头图（原型 6.html 的星轨与能量光点）
//
// 保留原型视觉：两条椭圆轨、虚线弧、沿路径飞行的能量光点（SMIL）。
// 角色标签按角色互换模式改写为「原来的你 / 朋友（她）」。
// ============================================================

export default function OrbitHeader({ dotRef, animRef, onReset }) {
  return (
    <div className="relative w-full pt-1 pb-3">
      <div className="relative z-20 flex items-center justify-between gap-2 pb-3 px-2 sm:px-6">
        <div className="flex items-center gap-2 text-xs text-sky-200/90 tracking-[0.14em]">
          <span className="text-[#5da9e9]">⇄</span>
          <span>立场交换体验</span>
        </div>

        <button
          type="button"
          onClick={onReset}
          className="px-3 py-1 rounded-full text-[11px] bg-white/[0.03] hover:bg-white/[0.08] text-slate-400 hover:text-slate-200 border border-white/[0.06] transition-all cursor-pointer"
        >
          重置推演
        </button>
      </div>

      <div className="relative h-36 sm:h-40 flex items-center justify-between px-2 sm:px-8">
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
          viewBox="0 0 900 160"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="s3OrbitalBridge" x1="18%" y1="30%" x2="82%" y2="70%">
              <stop offset="0%" stopColor="#f28c38" stopOpacity="0.35" />
              <stop offset="50%" stopColor="#93c5fd" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#5da9e9" stopOpacity="0.72" />
            </linearGradient>
          </defs>
          <ellipse cx="450" cy="84" rx="350" ry="56" stroke="rgba(255,255,255,0.06)" strokeWidth="1" fill="none" />
          <ellipse
            cx="450"
            cy="84"
            rx="245"
            ry="36"
            stroke="rgba(93,169,233,0.14)"
            strokeWidth="1"
            strokeDasharray="3 6"
            fill="none"
          />
          <path
            id="s3-pulse-arc"
            d="M 185 52 Q 450 122 705 84"
            stroke="url(#s3OrbitalBridge)"
            strokeWidth="1.3"
            strokeDasharray="4 6"
            fill="none"
          />
          <circle ref={dotRef} r="4" fill="#bae6fd" opacity="0">
            <animateMotion
              ref={animRef}
              dur="1.15s"
              begin="indefinite"
              fill="freeze"
              keySplines="0.22 1 0.36 1"
              calcMode="spline"
            >
              <mpath href="#s3-pulse-arc" />
            </animateMotion>
          </circle>
        </svg>

        {/* 远景星体：原来的你 */}
        <div className="orb-loop-left relative z-10 flex items-center gap-3.5">
          <div className="relative w-12 h-12 flex items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-[#f28c38]/18 blur-md" />
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-200 via-[#f28c38] to-orange-950 breathe-warm-calm" />
          </div>
          <div className="space-y-0.5">
            <span className="text-[11px] text-[#f28c38]/85 tracking-widest">对面轨道 · 原来的你</span>
            <p className="text-xs text-slate-400">正在向你吐露感受</p>
          </div>
        </div>

        {/* 前景焦点星体：朋友（她） */}
        <div className="orb-loop-right relative z-10 flex items-center gap-5">
          <div className="text-right space-y-1">
            <div className="inline-flex items-center justify-end gap-1.5 text-[11px] text-[#5da9e9] tracking-[0.18em]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#5da9e9]" /> 此刻你站的位置 · 朋友（她）
            </div>
            <h1 className="font-serif-sc text-xl sm:text-[24px] text-slate-100 font-light">
              站在她的星轨上倾听与回应
            </h1>
          </div>
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center shrink-0">
            <span className="absolute inset-[-12px] rounded-full bg-[#5da9e9]/22 blur-2xl breathe-blue-calm" />
            <span className="absolute inset-1.5 rounded-full border border-[#5da9e9]/35" />
            <span className="absolute inset-4 rounded-full border border-sky-200/20 border-dashed" />
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-white via-[#5da9e9] to-blue-950 shadow-[0_0_38px_rgba(93,169,233,0.8)]" />
          </div>
        </div>
      </div>
    </div>
  )
}
