// ============================================================
// 自我恒星 + 日冕微粒画布（原型 6.html L1060-1067 + renderLoop 中 corona 段）
// 26 个微粒绕 90,90 中心旋转；颜色取第一个被选中情绪的主色
// ============================================================
import { useEffect, useRef } from 'react'

export default function SelfStar({ emotions, needCondensed }) {
  const coronaRef = useRef(null)
  const moteRgbRef = useRef('242, 140, 56')
  const condensedRef = useRef(needCondensed)

  const active = emotions.filter((e) => e.selected)
  const palette = active.length > 0 ? active : [{ color: '#f28c38', rgb: '242, 140, 56' }]
  const primary = palette[0]
  const secondary = palette[1] || primary
  const tertiary = palette[2] || secondary

  // 星光晕扩散系数（原型 syncS2StarAura）
  const spreadScale = needCondensed
    ? 0.92 + Math.min(active.length, 4) * 0.04
    : 1.0 + Math.min(active.length, 5) * 0.09

  // 动态光环尺寸（原型 syncS2StarAura 的 ringsContainer）
  const rings = palette.map((em, idx) => {
    const baseSize = needCondensed ? 96 + idx * 16 : 108 + idx * 22
    const opacity = Math.max(0.16, 0.42 - idx * 0.07)
    return { rgb: em.rgb, baseSize, opacity }
  })

  // 日冕微粒颜色跟随第一个选中情绪
  moteRgbRef.current = active.length > 0 ? active[0].rgb : '242, 140, 56'
  condensedRef.current = needCondensed

  useEffect(() => {
    const canvas = coronaRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 与原型一致的 26 个微粒初始化（随机半径 / 速度 / 大小 / 透明度）
    const motes = Array.from({ length: 26 }, (_, idx) => ({
      angle: (idx / 26) * Math.PI * 2,
      radius: 36 + Math.random() * 26,
      speed: (0.004 + Math.random() * 0.006) * (idx % 2 === 0 ? 1 : -0.6),
      size: Math.random() * 1.6 + 0.6,
      alpha: Math.random() * 0.6 + 0.25,
    }))

    let raf = 0
    function loop() {
      ctx.clearRect(0, 0, 180, 180)
      const rgb = moteRgbRef.current
      const condensed = condensedRef.current
      for (const m of motes) {
        m.angle += m.speed
        const rDynamic = condensed ? m.radius * 0.86 : m.radius
        ctx.beginPath()
        ctx.arc(90 + Math.cos(m.angle) * rDynamic, 90 + Math.sin(m.angle) * rDynamic, m.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${rgb}, ${m.alpha})`
        ctx.fill()
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="orbit-swap-transition flex flex-col sm:flex-row items-center gap-6 sm:gap-8 md:pl-8 pt-2">
      <div className="relative w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center shrink-0">
        {/* 外层星云 */}
        <div
          className="absolute inset-[-22px] rounded-full blur-2xl transition-all duration-1000 ease-out"
          style={{
            transform: `scale(${spreadScale})`,
            background: `radial-gradient(circle, rgba(${primary.rgb}, 0.36) 0%, rgba(${secondary.rgb}, 0.24) 46%, rgba(${tertiary.rgb}, 0.12) 68%, rgba(5, 9, 18, 0) 80%)`,
          }}
        />

        {/* 动态光环 */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {rings.map((r, idx) => (
            <span
              key={`${r.rgb}-${idx}`}
              className="absolute rounded-full transition-all duration-1000 ease-out pointer-events-none"
              style={{
                width: r.baseSize,
                height: r.baseSize,
                border: `1px solid rgba(${r.rgb},${r.opacity})`,
                boxShadow: `0 0 18px rgba(${r.rgb},${r.opacity * 0.65})`,
              }}
            />
          ))}
        </div>

        {/* 真实需求内环：编辑后收缩并提亮 */}
        <div
          className="absolute w-24 h-24 sm:w-28 sm:h-28 rounded-full border border-amber-200/35 shadow-[0_0_24px_rgba(251,191,36,0.3),inset_0_0_14px_rgba(251,191,36,0.2)] transition-all duration-1000 ease-out"
          style={
            needCondensed
              ? { transform: 'scale(0.84)', opacity: 1, borderColor: 'rgba(251, 191, 36, 0.78)' }
              : { transform: 'scale(1)', opacity: 0.75 }
          }
        />

        {/* 日冕微粒 */}
        <canvas
          ref={coronaRef}
          width="180"
          height="180"
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* 恒星核心 */}
        <div
          className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full transition-all duration-1000 ease-out"
          style={{
            background:
              'radial-gradient(circle at 35% 32%, #FFFBEB 0%, #FBBF24 38%, #f28c38 72%, #B45309 100%)',
            boxShadow: `0 0 36px rgba(${primary.rgb}, 0.85), 0 0 75px rgba(${secondary.rgb}, 0.42)`,
          }}
        />
      </div>

      <div className="text-center sm:text-left space-y-2 max-w-md">
        <div className="inline-flex items-center gap-2 text-[11px] tracking-[0.2em] text-amber-300/85 uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-[#f28c38]" />
          <span>自我恒星 · Self Orbit</span>
        </div>
        <h1 className="font-serif-sc text-2xl sm:text-[26px] font-light text-slate-100 leading-snug">
          回想这件事，你当时最明显的感受是什么？
        </h1>
        <p className="text-xs text-slate-400/90 font-light">点选情绪微光，看看它们如何在心底交织</p>
      </div>
    </div>
  )
}
