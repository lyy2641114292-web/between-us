// ============================================================
// 层 5：纸张纤维 SVG 滤镜（原型 6.html L645-660）
// 供 .paper-lens / .paper-grain-overlay 通过 filter: url(#tactile-paper-grain) 引用
// ============================================================
export default function PaperGrainDefs() {
  return (
    <svg className="hidden" width="0" height="0" aria-hidden="true">
      <defs>
        <filter id="tactile-paper-grain" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" seed="11" result="noise" />
          <feColorMatrix
            type="matrix"
            values="
          1 0 0 0 0.85
          0 1 0 0 0.88
          0 0 1 0 0.94
          0 0 0 0.14 0"
            in="noise"
            result="coloredNoise"
          />
          <feComposite in="coloredNoise" in2="SourceGraphic" operator="in" />
        </filter>
      </defs>
    </svg>
  )
}
