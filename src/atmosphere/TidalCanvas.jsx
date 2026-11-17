// ============================================================
// 深海粒子潮汐波浪画布（移植自原型 6.html L3072-3217 的 renderLoop 中潮汐段）
// 28 行波浪 × 动态列数，原生 Canvas 2D，不使用任何粒子库。
// ============================================================
import { useEffect, useRef } from 'react'

// 与原型 window.VISUAL_TUNING 一致
export const VISUAL_TUNING = {
  orbitOffsetY: -10,
  lensSize: 154,
  coreSpeed: 1.0,
  tidalAlphaBoost: 0.1,
}

export default function TidalCanvas({ opacity = 1 }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 0
    let height = 0
    let dpr = 1
    let t = 0

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    window.addEventListener('resize', resize)
    resize()

    let raf = 0
    function renderLoop() {
      ctx.clearRect(0, 0, width, height)
      t += 0.011
      const alphaBoost = VISUAL_TUNING.tidalAlphaBoost
      const rows = 28
      const cols = Math.max(54, Math.floor(width / 22))

      for (let r = 0; r < rows; r++) {
        const depthRatio = r / (rows - 1)
        const baseY = height * (0.6 + depthRatio * 0.4)
        ctx.beginPath()
        const lineAlpha = Math.max(0, Math.min(0.65, 0.04 + depthRatio * 0.12 + alphaBoost))
        ctx.strokeStyle = `rgba(139, 166, 188, ${lineAlpha.toFixed(3)})`
        ctx.lineWidth = 0.65

        for (let c = 0; c < cols; c++) {
          const u = c / (cols - 1)
          const x = u * width
          const swell =
            Math.sin(u * 6.8 + t + r * 0.24) * (12 + depthRatio * 22) +
            Math.cos(u * 3.4 - t * 0.65 + r * 0.12) * (9 + depthRatio * 14)
          const y = baseY + swell

          if (c === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)

          const edgeFade = 1 - Math.pow(Math.abs(u - 0.5) * 1.85, 2.0)
          const particleAlpha = Math.max(
            0,
            Math.min(0.95, (0.1 + depthRatio * 0.34) * Math.max(0.15, edgeFade) + alphaBoost),
          )
          const isWarmSpark =
            (r === 10 && c === Math.floor(cols * 0.36)) || (r === 18 && c === Math.floor(cols * 0.68))
          ctx.fillStyle = isWarmSpark
            ? `rgba(242, 140, 56, ${Math.min(1, particleAlpha + 0.28).toFixed(3)})`
            : `rgba(165, 194, 218, ${particleAlpha.toFixed(3)})`
          const radius = isWarmSpark ? 2.1 : 0.85 + depthRatio * 0.85
          ctx.fillRect(x - radius * 0.5, y - radius * 0.5, radius * 1.4, radius * 1.4)
        }
        ctx.stroke()
      }

      raf = requestAnimationFrame(renderLoop)
    }
    raf = requestAnimationFrame(renderLoop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={ref}
      style={{ opacity }}
      className="fixed inset-0 h-full w-full pointer-events-none z-[2] transition-opacity duration-700"
    />
  )
}
