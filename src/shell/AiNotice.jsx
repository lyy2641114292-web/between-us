// ============================================================
// 隐私告知：首次使用 AI 功能时显示一次
// 用户确认后写入 localStorage，不再重复弹出
// ============================================================
import { useEffect, useState } from 'react'

const STORAGE_KEY = 'between-us:ai-notice-ack'

export function hasAcknowledgedNotice() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export default function AiNotice({ onAcknowledge }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!hasAcknowledgedNotice()) setVisible(true)
  }, [])

  if (!visible) return null

  const accept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* 隐私模式下可能失败，本次会话仍然继续 */
    }
    setVisible(false)
    onAcknowledge?.()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#050911]/85 backdrop-blur-md px-6">
      <div className="w-full max-w-md rounded-[24px] border border-amber-300/25 bg-[#0A1324]/95 p-6 sm:p-7 shadow-[0_24px_64px_rgba(0,0,0,0.8)]">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="h-2 w-2 rounded-full bg-[#f28c38]" />
          <h2 className="font-serif-sc text-lg text-mistwhite font-normal">关于你的内容会如何使用</h2>
        </div>

        <div className="space-y-3 text-xs leading-relaxed text-slate-300/90">
          <p>
            为了生成贴合你具体情境的分析（而不是套用通用模板），
            你在各阶段填写的内容会被发送到 <span className="text-amber-200/90">DeepSeek</span> 的服务器处理。
          </p>
          <p>
            <span className="text-mistwhite/90">本项目自己的服务器不保存任何内容</span>，只做请求转发。
            你的记录仍然只存在这台设备的浏览器里。
          </p>
          <p className="text-slate-400/85">
            如果这些内容对你来说是敏感的私人信息，请在使用前考虑清楚。
            不配置 API 密钥时，应用会退回纯本地模式（内容较通用）。
          </p>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={accept}
            className="cta-warm rounded-full px-6 py-2.5 text-xs font-medium tracking-wider text-white cursor-pointer"
          >
            我知道了，继续
          </button>
        </div>
      </div>
    </div>
  )
}
