// ============================================================
// 首页视界（原型 6.html L823-912）
// 双轨道、纸张圆镜、光标公转暖橙光点、主标题与「开始探索」
// 结构与 class 与原型逐项一致
// ============================================================
import { useEffect, useRef } from 'react'
import { VISUAL_TUNING } from '../atmosphere/TidalCanvas.jsx'

export default function Home({ onEnter, hidden = false }) {
  const roamerRef = useRef(null)

  // 纸张圆镜内部暖橙光点缓慢公转（原型 renderLoop 中 orbitAngle 段）
  useEffect(() => {
    const el = roamerRef.current
    if (!el) return
    let orbitAngle = 0
    let raf = 0
    function loop() {
      orbitAngle += 0.008 * VISUAL_TUNING.coreSpeed
      const trackRadius = VISUAL_TUNING.lensSize * 0.28
      el.style.transform = `translate3d(${(Math.cos(orbitAngle) * trackRadius).toFixed(
        2,
      )}px, ${(Math.sin(orbitAngle) * trackRadius).toFixed(2)}px, 0)`
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div
      id="home-portal"
      className={`fixed inset-0 z-20 w-full h-full flex flex-col items-center justify-center px-6 overflow-hidden ${
        hidden ? 'is-hidden' : ''
      }`}
    >
      <div className="orbit-stage reveal-layer-1 absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-[92vw] h-[64vh] sm:w-[86vw] sm:h-[78vh] max-w-[1160px] max-h-[820px] flex items-center justify-center">
          {/* 左侧巨型轨道：暖琥珀橙 */}
          <div className="orbit-ring-left absolute left-[2%] sm:left-[6%] w-[56vw] h-[56vw] sm:w-[54vh] sm:h-[54vh] md:w-[62vh] md:h-[62vh] max-w-[600px] max-h-[600px] rounded-full">
            <svg
              className="absolute -inset-[2px] w-[calc(100%+4px)] h-[calc(100%+4px)] pointer-events-none"
              viewBox="0 0 200 200"
              fill="none"
            >
              <defs>
                <linearGradient id="warmArcFlare" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fde68a" stopOpacity="0.92" />
                  <stop offset="40%" stopColor="#f28c38" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#f28c38" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M 35 35 A 98 98 0 0 1 168 38" stroke="url(#warmArcFlare)" strokeWidth="2.2" strokeLinecap="round" />
              <path
                d="M 28 162 A 98 98 0 0 0 130 193"
                stroke="url(#warmArcFlare)"
                strokeWidth="1.6"
                strokeLinecap="round"
                opacity="0.65"
              />
            </svg>
            <div className="absolute -inset-5 rounded-full border border-dashed border-[#f28c38]/[0.24]" />
            <div className="absolute inset-8 rounded-full border border-amber-300/[0.20]" />
            <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-amber-200 shadow-[0_0_16px_4px_rgba(242,140,56,0.9)]" />
            <span className="absolute top-[18%] left-[12%] w-6 h-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f28c38]/35 blur-sm" />
            <span className="absolute bottom-[14%] left-[13%] w-2 h-2 rounded-full bg-[#f28c38] shadow-[0_0_12px_2px_rgba(242,140,56,0.75)]" />
            <span className="absolute top-1/2 -left-2.5 w-5 h-[1.5px] bg-amber-200/75 shadow-[0_0_8px_#f28c38]" />
            <span className="absolute top-1/2 -right-2.5 w-5 h-[1.5px] bg-[#f28c38]/75" />
          </div>

          {/* 右侧巨型轨道：天青雾蓝 */}
          <div className="orbit-ring-right absolute right-[2%] sm:right-[6%] w-[56vw] h-[56vw] sm:w-[54vh] sm:h-[54vh] md:w-[62vh] md:h-[62vh] max-w-[600px] max-h-[600px] rounded-full">
            <svg
              className="absolute -inset-[2px] w-[calc(100%+4px)] h-[calc(100%+4px)] pointer-events-none"
              viewBox="0 0 200 200"
              fill="none"
            >
              <defs>
                <linearGradient id="coolArcFlare" x1="100%" y1="100%" x2="0%" y2="0%">
                  <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.92" />
                  <stop offset="42%" stopColor="#5da9e9" stopOpacity="0.48" />
                  <stop offset="100%" stopColor="#5da9e9" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M 166 165 A 98 98 0 0 1 34 162" stroke="url(#coolArcFlare)" strokeWidth="2.2" strokeLinecap="round" />
              <path
                d="M 172 40 A 98 98 0 0 0 74 7"
                stroke="url(#coolArcFlare)"
                strokeWidth="1.6"
                strokeLinecap="round"
                opacity="0.65"
              />
            </svg>
            <div className="absolute -inset-6 rounded-full border border-dashed border-[#5da9e9]/[0.24]" />
            <div className="absolute inset-10 rounded-full border border-sky-200/[0.20]" />
            <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-sky-100 shadow-[0_0_16px_4px_rgba(93,169,233,0.92)]" />
            <span className="absolute bottom-[18%] right-[12%] w-6 h-6 translate-x-1/2 translate-y-1/2 rounded-full bg-[#5da9e9]/35 blur-sm" />
            <span className="absolute top-[16%] right-[13%] w-2.5 h-2.5 rounded-full bg-[#5da9e9] shadow-[0_0_14px_3px_rgba(93,169,233,0.8)]" />
            <span className="absolute -top-2.5 left-1/2 w-[1.5px] h-5 bg-sky-200/75 shadow-[0_0_8px_#5da9e9]" />
            <span className="absolute -bottom-2.5 left-1/2 w-[1.5px] h-5 bg-[#5da9e9]/75" />
          </div>

          {/* 中心交汇区：悬浮半透明纸张肌理圆镜 */}
          <div
            className="paper-lens pointer-events-auto relative z-20 rounded-full border border-mistwhite/[0.24] flex items-center justify-center cursor-pointer"
            onClick={onEnter}
            title="点击进入探索"
          >
            <div
              className="absolute inset-0 rounded-full opacity-55 pointer-events-none"
              style={{ filter: 'url(#tactile-paper-grain)' }}
            />
            <div className="absolute inset-3 rounded-full border border-slatefrost/[0.18] pointer-events-none" />
            <div className="absolute inset-[22%] rounded-full border border-dashed border-[#f28c38]/[0.32] pointer-events-none" />
            <div className="absolute w-full h-[1px] bg-gradient-to-r from-transparent via-slatefrost/[0.18] to-transparent pointer-events-none" />
            <div className="absolute h-full w-[1px] bg-gradient-to-b from-transparent via-slatefrost/[0.18] to-transparent pointer-events-none" />
            <div className="w-1 h-1 rounded-full bg-mistwhite/30 pointer-events-none" />

            <div ref={roamerRef} className="absolute left-1/2 top-1/2 z-30 pointer-events-none" style={{ willChange: 'transform' }}>
              <div className="absolute -left-5 -top-5 w-10 h-10 rounded-full bg-[#f28c38]/28 blur-sm pointer-events-none" />
              <div className="coral-pulse relative -left-[6px] -top-[6px] w-3 h-3 rounded-full bg-[#f28c38] pointer-events-none">
                <span className="absolute inset-[2.5px] rounded-full bg-white/85" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 中央核心文案与主按钮 */}
      <div className="relative z-20 flex flex-col items-center text-center max-w-3xl mx-auto mt-48 sm:mt-56 px-4 pointer-events-none">
        <h1 className="reveal-layer-2 font-serif text-3xl sm:text-5xl md:text-[54px] font-normal tracking-[0.04em] leading-[1.18] text-mistwhite drop-shadow-[0_4px_24px_rgba(5,9,17,0.85)]">
          Explore the space between perspectives.
        </h1>

        <p className="reveal-layer-3 mt-4 sm:mt-5 font-serif text-base sm:text-xl tracking-[0.22em] text-slatefrost/85 font-light">
          有些关系，值得重新看一看。
        </p>

        <div className="reveal-layer-4 mt-8 sm:mt-10 pointer-events-auto">
          <button
            type="button"
            onClick={onEnter}
            className="cta-explore group inline-flex items-center gap-3.5 px-8 py-3.5 rounded-full border border-slatefrost/25 bg-abyss/60 backdrop-blur-md text-xs sm:text-sm tracking-[0.26em] text-mistwhite font-light cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-[#f28c38] shadow-[0_0_10px_#f28c38] transition-transform duration-300 group-hover:scale-125" />
            <span>开始探索</span>
          </button>
        </div>
      </div>
    </div>
  )
}
