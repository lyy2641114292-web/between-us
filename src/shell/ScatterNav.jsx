// ============================================================
// 底部散落呼吸光点导航（原型 6.html L762-811）
// 5 个阶段坐标，位置、延迟、闪烁参数与原型逐项一致
// ============================================================

const SCATTER_NODES = [
  { idx: 0, label: '01 记录冲突', wrap: 'scatter-drift-a', pos: 'left-[8%] sm:left-[10%] bottom-[18%]', delay: '-1s', dur: '4.8s', tdelay: '0.2s' },
  { idx: 1, label: '02 理解自己', wrap: 'scatter-drift-b', pos: 'left-[27%] sm:left-[29%] bottom-[52%]', delay: '-3.5s', dur: '5.6s', tdelay: '1.4s' },
  { idx: 2, label: '03 探索对方', wrap: 'scatter-drift-a', pos: 'left-[47%] sm:left-[48%] bottom-[24%]', delay: '-5.2s', dur: '4.3s', tdelay: '2.7s' },
  { idx: 3, label: '04 对照视角', wrap: 'scatter-drift-b', pos: 'left-[67%] sm:left-[68%] bottom-[58%]', delay: '-2.1s', dur: '6.1s', tdelay: '0.9s' },
  { idx: 4, label: '05 决定下一步', wrap: 'scatter-drift-a', pos: 'right-[6%] sm:right-[9%] bottom-[32%]', delay: '-4.4s', dur: '5.1s', tdelay: '3.3s' },
]

export default function ScatterNav({ activeIndex, onSelect }) {
  return (
    <nav
      aria-label="探索阶段坐标"
      className="reveal-layer-4 fixed bottom-4 sm:bottom-7 inset-x-0 z-30 h-20 sm:h-24 pointer-events-none"
    >
      <div className="relative w-full max-w-4xl h-full mx-auto px-8 sm:px-14">
        {SCATTER_NODES.map((n) => (
          <div key={n.idx} className={`${n.wrap} absolute ${n.pos}`} style={{ animationDelay: n.delay }}>
            <button
              type="button"
              onClick={() => onSelect(n.idx)}
              className={`scatter-node group pointer-events-auto relative flex flex-col items-center p-3 focus:outline-none cursor-pointer ${
                activeIndex === n.idx ? 'is-active' : ''
              }`}
            >
              <span className="mb-2.5 px-2.5 py-0.5 rounded-full bg-abyss/85 border border-slatefrost/15 text-[11px] tracking-[0.18em] text-mistwhite/90 whitespace-nowrap opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 group-[.is-active]:opacity-100 group-[.is-active]:translate-y-0 group-[.is-active]:border-[#f28c38]/50 transition-all duration-300">
                {n.label}
              </span>
              <span
                className="scatter-dot block w-2.5 h-2.5 rounded-full bg-[#f28c38]"
                style={{ '--twinkle-dur': n.dur, '--twinkle-delay': n.tdelay }}
              />
            </button>
          </div>
        ))}
      </div>
    </nav>
  )
}
