// ============================================================
// 真实需求条（原型 6.html L1102-1109 + activateS2NeedEditor）
// 点击后原地变为输入框；失焦或回车保存并把文字包进「」
// ============================================================
import { useEffect, useRef, useState } from 'react'

export default function CoreNeed({ value, onSave, onEnterEdit }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef(null)

  useEffect(() => {
    if (editing) {
      setDraft(value)
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      })
    }
  }, [editing, value])

  const startEdit = () => {
    onEnterEdit()
    setEditing(true)
  }

  const finish = () => {
    if (!editing) return
    const trimmed = draft.trim()
    if (trimmed) onSave(trimmed)
    setEditing(false)
  }

  return (
    <div className="flex justify-center px-2">
      <div
        onClick={editing ? undefined : startEdit}
        title="点击直接修改"
        className="group relative max-w-2xl w-full rounded-2xl px-6 py-3.5 bg-white/[0.025] hover:bg-white/[0.045] backdrop-blur-xl transition-all duration-700 cursor-text flex items-center justify-center gap-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]"
      >
        <span className="w-2 h-2 rounded-full bg-[#FBBF24] shadow-[0_0_10px_#FBBF24] shrink-0 transition-transform duration-700" />
        <div className="text-center text-sm text-slate-100/95 font-normal">
          {editing ? (
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={finish}
              onKeyDown={(e) => {
                if (e.key === 'Enter') finish()
              }}
              className="w-full bg-slate-950/65 rounded-xl px-3.5 py-1.5 text-sm text-amber-100 text-center focus:outline-none focus:ring-1 focus:ring-amber-300/50"
            />
          ) : (
            `「${value}」`
          )}
        </div>
      </div>
    </div>
  )
}
