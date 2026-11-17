// ============================================================
// 02 ⇄ 03 双星位置互换过渡幕布（原型 6.html L1672-1681 + L2394-2503）
//
// 原型用 3 个裸 setTimeout（0 / 480 / 920ms）驱动，快速连点会错位。
// 此处改为状态机 + ref 守卫：
//   idle → leaping(遮罩显现+双星飞跃) → switching(480ms 切阶段) → fading(920ms 淡出) → idle
// 卸载时清理全部定时器，快速连点直接忽略。
// ============================================================
import { useEffect, useRef, useState } from 'react'

const LEAP_MS = 480
const FADE_MS = 920

export default function BinaryVeil({ direction, phase, onSwitched }) {
  // direction: 'toOther' | 'toSelf' | null
  const warmClass =
    direction === 'toOther'
      ? 'anim-leap-warm-to-left'
      : direction === 'toSelf'
        ? 'anim-leap-warm-to-right'
        : ''

  const blueClass =
    direction === 'toOther'
      ? 'anim-leap-blue-to-right'
      : direction === 'toSelf'
        ? 'anim-leap-blue-to-left'
        : ''

  return (
    <div
      className={`fixed inset-0 z-50 pointer-events-none flex items-center justify-center bg-[#050911]/72 backdrop-blur-md transition-opacity duration-[420ms] ${
        phase === 'visible' ? 'opacity-100' : 'opacity-0'
      }`}
      id="binary-transition-veil"
    >
      <div className="relative w-[340px] h-[200px] flex items-center justify-center">
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 340 200" fill="none">
          <ellipse
            cx="170"
            cy="100"
            rx="125"
            ry="52"
            transform="rotate(-10 170 100)"
            stroke="rgba(242, 140, 56, 0.28)"
            strokeWidth="1"
            strokeDasharray="3 6"
          />
          <ellipse
            cx="170"
            cy="100"
            rx="125"
            ry="52"
            transform="rotate(10 170 100)"
            stroke="rgba(93, 169, 233, 0.28)"
            strokeWidth="1"
          />
        </svg>
        <div
          className={`absolute right-[72px] top-[86px] w-9 h-9 rounded-full bg-gradient-to-br from-amber-100 via-[#f28c38] to-orange-900 shadow-[0_0_28px_#f28c38] ${warmClass}`}
        />
        <div
          className={`absolute left-[72px] top-[86px] w-9 h-9 rounded-full bg-gradient-to-br from-white via-[#5da9e9] to-blue-900 shadow-[0_0_28px_#5da9e9] ${blueClass}`}
        />
      </div>
    </div>
  )
}

// 互换控制器：返回 { start, phase, direction, busy }
export function useBinarySwap({ onSwitch }) {
  const [phase, setPhase] = useState('idle') // idle | visible
  const [direction, setDirection] = useState(null)
  const busy = useRef(false)
  const t1 = useRef(null)
  const t2 = useRef(null)

  const clear = () => {
    clearTimeout(t1.current)
    clearTimeout(t2.current)
  }

  useEffect(() => clear, [])

  const start = (dir) => {
    if (busy.current) return
    busy.current = true
    setDirection(dir)
    setPhase('visible')

    t1.current = setTimeout(() => {
      onSwitch()
    }, LEAP_MS)

    t2.current = setTimeout(() => {
      setPhase('idle')
      busy.current = false
    }, FADE_MS)
  }

  return { start, phase, direction, busy: busy.current }
}
