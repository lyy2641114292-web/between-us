// ============================================================
// 本地存档状态条（需求 F11：刷新后内容不丢；提供「清空本机数据」入口）
// 位置固定在左下、低调呈现，不干扰原型视觉。
// ============================================================
import { useState } from 'react'
import { useApp } from '../state/AppProvider.jsx'
import { fragmentsOf } from '../state/store.js'

export default function SaveIndicator() {
  const { state, actions, savedAt, restored, corrupted } = useApp()
  const [confirming, setConfirming] = useState(false)

  // 只在有内容时提示，避免首页空状态下多出元素
  const hasContent =
    fragmentsOf(state.stage01).length > 0 || state.stage01.draft.trim().length > 0

  if (!hasContent && !corrupted) return null

  return (
    <div className="fixed bottom-3 left-4 z-[45] flex items-center gap-3 text-[10px] text-slatefrost/45">
      {corrupted && (
        <span className="text-amber-300/80">上次的存档无法读取，已重新开始</span>
      )}
      {restored && savedAt && !corrupted && (
        <span>
          已自动保存到本机 · {new Date(savedAt).toLocaleTimeString('zh-CN', { hour12: false })}
        </span>
      )}

      {confirming ? (
        <span className="flex items-center gap-2">
          <span className="text-amber-300/80">确认清空全部本机数据？</span>
          <button
            type="button"
            onClick={() => {
              actions.resetAll()
              setConfirming(false)
            }}
            className="text-[#f28c38] hover:underline cursor-pointer"
          >
            确认清空
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="hover:text-mistwhite cursor-pointer">
            取消
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="hover:text-slatefrost/80 cursor-pointer underline decoration-slatefrost/20 underline-offset-2"
        >
          清空本机数据
        </button>
      )}
    </div>
  )
}
