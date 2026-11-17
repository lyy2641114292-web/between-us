// ============================================================
// 轻提示 Toast（原型 6.html L1289-1292 + showToast 逻辑 L1778-1786）
// 行为一致：显示 2500ms 后自动隐藏
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react'

export function useToast() {
  const [message, setMessage] = useState('')
  const [visible, setVisible] = useState(false)
  const timer = useRef(null)

  const show = useCallback((msg) => {
    setMessage(msg)
    setVisible(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setVisible(false), 2500)
  }, [])

  useEffect(() => () => clearTimeout(timer.current), [])

  return { message, visible, show }
}

export default function Toast({ message, visible }) {
  return (
    <div
      className={`toast-banner fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full bg-deepsea/95 border border-[#f28c38]/40 text-xs tracking-[0.14em] text-mistwhite shadow-[0_12px_32px_rgba(0,0,0,0.7)] ${
        visible ? 'show' : ''
      }`}
    >
      {message || '提示信息'}
    </div>
  )
}
