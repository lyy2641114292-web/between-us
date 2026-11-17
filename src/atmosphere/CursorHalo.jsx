// ============================================================
// 层 4：跟随鼠标的银白色探索光晕（原型 6.html L674 + renderLoop 中 0.14 缓动段）
// 与原型一致：writer 每帧以 0.14 系数平滑逼近鼠标位置，产生柔和拖尾。
// ============================================================
import { useEffect, useRef } from 'react'

export default function CursorHalo() {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let mouseX = window.innerWidth / 2
    let mouseY = window.innerHeight / 2
    let whiteHaloX = mouseX
    let whiteHaloY = mouseY

    const onMove = (e) => {
      mouseX = e.clientX
      mouseY = e.clientY
    }
    const onTouch = (e) => {
      if (e.touches && e.touches[0]) {
        mouseX = e.touches[0].clientX
        mouseY = e.touches[0].clientY
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('touchmove', onTouch, { passive: true })

    let raf = 0
    function loop() {
      whiteHaloX += (mouseX - whiteHaloX) * 0.14
      whiteHaloY += (mouseY - whiteHaloY) * 0.14
      el.style.transform = `translate3d(${whiteHaloX.toFixed(1)}px, ${whiteHaloY.toFixed(1)}px, 0)`
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('touchmove', onTouch)
    }
  }, [])

  return <div ref={ref} className="cursor-white-halo" aria-hidden="true" />
}
