// ============================================================
// 客观事实列表（原型 6.html L2122-2185）
// - 点击文字原地编辑（失焦或回车保存）
// - 「+ 补充事实」展开表单，取消/确定与原型一致
// ============================================================
import { useState } from 'react'

function FactItem({ fact, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(fact.text)

  const start = () => {
    setDraft(fact.text)
    setEditing(true)
  }
  const save = () => {
    if (!editing) return
    const trimmed = draft.trim()
    if (trimmed) onSave(trimmed)
    setEditing(false)
  }

  return (
    <div className="s2-abyss-glass rounded-2xl p-4 sm:p-5 hover:bg-white/[0.04]">
      <div className="flex items-start gap-3.5">
        <span className="mt-2 w-2 h-2 rounded-full bg-sky-300/90 shadow-[0_0_8px_rgba(125,211,252,0.7)] shrink-0" />
        {editing ? (
          <input
            autoFocus
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
            }}
            className="w-full bg-slate-950/70 rounded-lg px-3 py-1.5 text-sm text-sky-100 focus:outline-none focus:ring-1 focus:ring-sky-300/40"
          />
        ) : (
          <p
            onClick={start}
            title="点击直接编辑"
            className="text-sm text-slate-200/95 leading-relaxed cursor-text hover:text-white transition-colors"
          >
            {fact.text}
          </p>
        )}
      </div>
    </div>
  )
}

export default function FactsList({
  facts,
  addingFact,
  newFactDraft,
  onEditFact,
  onOpenAdd,
  onCloseAdd,
  onDraftChange,
  onConfirmAdd,
}) {
  return (
    <>
      <div className="space-y-3.5">
        {facts.map((f) => (
          <FactItem key={f.id} fact={f} onSave={(t) => onEditFact(f.id, t)} />
        ))}
      </div>

      <div className="pt-1 px-1">
        {!addingFact && (
          <div
            onClick={onOpenAdd}
            className="cursor-pointer inline-flex items-center gap-2 text-xs text-slate-400/85 hover:text-sky-200 transition-colors py-1.5 px-3 rounded-full hover:bg-white/[0.03]"
          >
            <span>+ 补充事实</span>
          </div>
        )}

        {addingFact && (
          <div className="s2-abyss-glass rounded-2xl p-4 space-y-3 mt-1">
            <input
              autoFocus
              type="text"
              value={newFactDraft}
              onChange={(e) => onDraftChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onConfirmAdd()
              }}
              placeholder="写下客观发生的事实..."
              className="w-full bg-slate-950/50 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-400/40"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onCloseAdd}
                className="px-3 py-1 rounded-full text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={onConfirmAdd}
                className="px-3.5 py-1 rounded-full text-xs bg-sky-500/20 text-sky-100 hover:bg-sky-500/30 transition-colors cursor-pointer"
              >
                确定
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
