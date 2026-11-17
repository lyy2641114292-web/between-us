// ============================================================
// 阶段 05：决定下一步 · DECIDE（原型 6.html L1496-1668 + L2772-2852）
//
// 与原型对应：
// - 四种意愿：express / explain 显示草稿面板；distance / undecided 显示留白面板
// - 第 5 条反思文案随意愿变化
// - 三种语气切换会**覆盖**草稿（原型行为，会丢失用户手改内容）
// - 五条反思 contenteditable，导出 txt
// ============================================================
import { useEffect, useState } from 'react'

import { useApp } from '../state/AppProvider.jsx'
import { S5_INTENTS, S5_NONCOMM, S5_REFLECTION_KEYS, S5_REFLECTION_LABELS, S5_TONE_LABELS } from '../data/stage05.js'
import AiStatusBar from './stage02/AiStatusBar.jsx'
import { useStage05AI } from './stage05/useStage05AI.js'

// 可编辑段落：内容以 DOM 为准，失焦时写回 store（与原型 contenteditable 一致）
function EditableP({ text, onSave, className, remountKey }) {
  return (
    <p
      key={remountKey}
      contentEditable
      suppressContentEditableWarning
      onBlur={(e) => onSave(e.currentTarget.textContent || '')}
      className={`${className} outline-none`}
    >
      {text}
    </p>
  )
}

export default function Stage05Decide({ onPrev, toast }) {
  const { state, actions } = useApp()
  const s5 = state.stage05
  const coreNeed = state.stage02.coreNeed

  // 进入本阶段时生成表达草稿与反思
  const ai = useStage05AI(toast)

  const [copied, setCopied] = useState(false)

  // 进入本阶段时同步阶段 02 的真实需求为第 1 条反思（原型 syncCrossStageData）
  useEffect(() => {
    if (coreNeed && coreNeed !== s5.reflections.care) {
      actions.s5SyncCare(coreNeed)
    }
    // 仅在挂载时同步一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isDraftType = s5.intent === 'express' || s5.intent === 'explain'
  const noncomm = S5_NONCOMM[s5.intent]

  // 复制草稿：优先 execCommand（与原型一致），失败回退到 Clipboard API
  const copyDraft = async () => {
    const ok = await new Promise((resolve) => {
      try {
        const ta = document.createElement('textarea')
        ta.value = s5.draft
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        const done = document.execCommand('copy')
        document.body.removeChild(ta)
        resolve(done)
      } catch {
        resolve(false)
      }
    })

    if (!ok) {
      try {
        await navigator.clipboard.writeText(s5.draft)
        toast('已复制表达草稿')
        return
      } catch {
        toast('复制失败，请手动全选复制')
        return
      }
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
    toast('已复制表达草稿')
  }

  // 导出 txt（原型 exportS5Reflection）
  const exportReflection = () => {
    const r = s5.reflections
    let content = 'Between Us · 我的反思记录\n========================\n\n'
    S5_REFLECTION_KEYS.forEach((key, idx) => {
      content += `${S5_REFLECTION_LABELS[idx]}\n${(r[key] || '').trim()}\n\n`
    })

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'Between_Us_我的反思记录.txt'
    a.click()
    URL.revokeObjectURL(url)
    toast('已为你导出「Between_Us_我的反思记录.txt」')
  }

  return (
    <section className="flex-col gap-6 w-full flex">
      {/* 头图：双星交汇 */}
      <div className="text-center max-w-xl mx-auto space-y-2">
        <div className="relative flex items-center justify-center gap-6 sm:gap-10 pb-1">
          <div className="relative w-16 h-16 flex items-center justify-center float-gentle">
            <div className="absolute inset-[-10px] rounded-full bg-[#f28c38]/22 blur-xl" />
            <div className="star-track-cw absolute inset-0 rounded-full border border-dashed border-[#f28c38]/45">
              <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-200 shadow-[0_0_8px_#f28c38]" />
            </div>
            <div className="star-track-ccw absolute inset-2 rounded-full border border-amber-300/25" />
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-100 via-[#f28c38] to-orange-950 star-amber-glow relative">
              <span className="absolute top-1.5 left-2 w-2 h-2 rounded-full bg-white/55 blur-[0.5px]" />
            </div>
          </div>

          <div className="relative w-24 sm:w-32 h-10 flex items-center justify-center">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 120 40" fill="none">
              <defs>
                <linearGradient id="s5HarmonicBridge" x1="0%" y1="50%" x2="100%" y2="50%">
                  <stop offset="0%" stopColor="#f28c38" stopOpacity="0.65" />
                  <stop offset="50%" stopColor="#fde68a" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#5da9e9" stopOpacity="0.65" />
                </linearGradient>
              </defs>
              <path
                d="M 4 20 Q 60 4 116 20"
                stroke="url(#s5HarmonicBridge)"
                strokeWidth="1.2"
                strokeDasharray="3 4"
                fill="none"
              />
              <path
                d="M 116 20 Q 60 36 4 20"
                stroke="url(#s5HarmonicBridge)"
                strokeWidth="1"
                strokeDasharray="2 5"
                fill="none"
                opacity="0.7"
              />
              <circle r="2.2" fill="#fde68a">
                <animateMotion dur="4.5s" repeatCount="indefinite" path="M 4 20 Q 60 4 116 20" />
              </circle>
              <circle r="2" fill="#bae6fd">
                <animateMotion dur="5.2s" repeatCount="indefinite" path="M 116 20 Q 60 36 4 20" />
              </circle>
            </svg>
          </div>

          <div className="relative w-16 h-16 flex items-center justify-center float-gentle" style={{ animationDelay: '-2.2s' }}>
            <div className="absolute inset-[-10px] rounded-full bg-[#5da9e9]/22 blur-xl" />
            <div className="star-track-ccw absolute inset-0 rounded-full border border-dashed border-[#5da9e9]/45">
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-sky-200 shadow-[0_0_8px_#5da9e9]" />
            </div>
            <div className="star-track-cw absolute inset-2 rounded-full border border-sky-300/25" />
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-white via-[#5da9e9] to-blue-950 star-blue-glow relative">
              <span className="absolute top-1.5 left-2 w-2 h-2 rounded-full bg-white/60 blur-[0.5px]" />
            </div>
          </div>
        </div>

        <h1 className="font-serif-sc text-xl sm:text-[26px] font-light text-slate-100 tracking-wide">决定下一步</h1>
      </div>

      {/* AI 生成状态 */}
      <div className="w-full">
        <AiStatusBar
          status={ai.status}
          error={ai.error}
          regenerating={ai.regenerating}
          onRegenerate={ai.regenerate}
          hasFragments={ai.hasFragments}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* 左列 */}
        <div className="lg:col-span-7 space-y-5">
          <div className="glass-panel rounded-[24px] p-5 sm:p-6 space-y-4">
            <h2 className="font-serif-sc text-base sm:text-lg text-slate-100 font-normal">
              你现在希望如何面对这段关系？
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {S5_INTENTS.map((it) => {
                const active = s5.intent === it.id
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => {
                      actions.s5SelectIntent(it.id)
                      toast('已更新你的下一步意愿')
                    }}
                    className={`intent-card rounded-2xl p-4 text-left border border-white/[0.07] flex items-center justify-between ${
                      active ? 'active-warm' : 'bg-white/[0.025]'
                    }`}
                  >
                    <span className={`text-xs sm:text-[13px] font-medium ${active ? 'text-amber-100' : 'text-slate-200'}`}>
                      {it.label}
                    </span>
                    <span className={`rounded-full ${active ? 'w-2 h-2 bg-[#f28c38]' : 'w-1.5 h-1.5 bg-white/20'}`} />
                  </button>
                )
              })}
            </div>
          </div>

          {/* 草稿面板：express / explain */}
          {isDraftType && (
            <div className="glass-panel rounded-[24px] p-5 sm:p-6 space-y-4 border-amber-400/25">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#f28c38]" />
                <h3 className="font-serif-sc text-base text-amber-100 font-normal">把心意说清楚</h3>
              </div>

              <div className="rounded-2xl bg-slate-950/50 border border-white/[0.08] focus-within:border-amber-400/45 p-4 transition-colors">
                <textarea
                  rows={5}
                  value={s5.draft}
                  onChange={(e) => actions.s5SetDraft(e.target.value)}
                  className="w-full bg-transparent text-xs sm:text-[13px] text-slate-100 leading-relaxed resize-none focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  {Object.entries(S5_TONE_LABELS).map(([key, label]) => {
                    const active = s5.tone === key
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          actions.s5SwitchTone(key)
                          toast('已为你切换表达草稿的语气')
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs border transition-all cursor-pointer ${
                          active
                            ? 'bg-amber-400/20 text-amber-100 border-amber-300/40'
                            : 'bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border-white/[0.08]'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>

                <button
                  type="button"
                  onClick={copyDraft}
                  className="px-4 py-2 rounded-full text-xs font-medium bg-white/[0.1] hover:bg-white/[0.18] text-white border border-white/[0.15] transition-all cursor-pointer"
                >
                  {copied ? '已复制 ✓' : '复制'}
                </button>
              </div>
            </div>
          )}

          {/* 留白面板：distance / undecided */}
          {!isDraftType && noncomm && (
            <div className="glass-panel rounded-[24px] p-6 sm:p-7 space-y-3 border-sky-300/20">
              <div className="flex items-center gap-2 text-sky-200">
                <span className="w-2 h-2 rounded-full bg-[#5da9e9]" />
                <h3 className="font-serif-sc text-base font-normal">{noncomm.title}</h3>
              </div>
              <p className="text-xs sm:text-[13px] text-slate-300/90 leading-relaxed font-light">{noncomm.desc}</p>
            </div>
          )}
        </div>

        {/* 右列：反思星笺 */}
        <div className="lg:col-span-5 reflection-scroll-sheet rounded-[26px] p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />
              <h2 className="font-serif-sc text-base text-slate-100 font-normal">我的反思记录</h2>
            </div>
            <button
              type="button"
              onClick={actions.s5ToggleSheet}
              className="text-xs text-amber-200/80 hover:text-amber-100 flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-300/20 transition-all cursor-pointer"
            >
              <span>{s5.sheetOpen ? '收起反思星笺' : '展开反思星笺'}</span>
              <span
                className="transition-transform duration-500 text-[10px]"
                style={{ transform: s5.sheetOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              >
                ▼
              </span>
            </button>
          </div>

          {/* 收起时的预览卡 */}
          {!s5.sheetOpen && (
            <div
              onClick={actions.s5ToggleSheet}
              className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-2 cursor-pointer hover:bg-white/[0.05] transition-all"
            >
              <div className="flex items-center justify-between text-[11px] text-amber-300/85">
                <span>✦ 5 条核心沉淀已生成</span>
                <span>点击展开全文</span>
              </div>
              <p className="text-xs text-slate-200 line-clamp-2 leading-relaxed font-light">
                核心需求：{coreNeed}
              </p>
            </div>
          )}

          <div className={`expand-drawer ${s5.sheetOpen ? 'open' : ''}`}>
            <div className="expand-inner space-y-3.5 pt-1 text-xs sm:text-[13px]">
              <div className="rounded-2xl bg-white/[0.025] border border-white/[0.06] p-3.5 space-y-1">
                <div className="text-[11px] text-amber-300/80">1. 最在意的事情</div>
                <EditableP
                  remountKey={`care-${coreNeed}`}
                  text={coreNeed}
                  onSave={(t) => actions.s5SetReflection('care', t)}
                  className="text-slate-100 leading-relaxed"
                />
              </div>

              <div className="rounded-2xl bg-white/[0.025] border border-white/[0.06] p-3.5 space-y-1">
                <div className="text-[11px] text-amber-300/80">2. 之前的理解</div>
                <EditableP
                  remountKey={`past-${s5.reflections.past}`}
                  text={s5.reflections.past}
                  onSave={(t) => actions.s5SetReflection('past', t)}
                  className="text-slate-200/95 leading-relaxed"
                />
              </div>

              <div className="rounded-2xl bg-white/[0.025] border border-white/[0.06] p-3.5 space-y-1">
                <div className="text-[11px] text-amber-300/80">3. 看见的新可能</div>
                <EditableP
                  remountKey={`newp-${s5.reflections.newPossibility}`}
                  text={s5.reflections.newPossibility}
                  onSave={(t) => actions.s5SetReflection('newPossibility', t)}
                  className="text-slate-200/95 leading-relaxed"
                />
              </div>

              <div className="rounded-2xl bg-white/[0.025] border border-white/[0.06] p-3.5 space-y-1">
                <div className="text-[11px] text-amber-300/80">4. 尚不确定的问题</div>
                <EditableP
                  remountKey={`unc-${s5.reflections.uncertain}`}
                  text={s5.reflections.uncertain}
                  onSave={(t) => actions.s5SetReflection('uncertain', t)}
                  className="text-slate-200/95 leading-relaxed"
                />
              </div>

              <div className="rounded-2xl bg-amber-400/[0.06] border border-amber-300/20 p-3.5 space-y-1">
                <div className="text-[11px] text-[#f28c38]">5. 我决定采取的下一步行动</div>
                <EditableP
                  remountKey={`step5-${s5.intent}-${s5.reflections.step5}`}
                  text={s5.reflections.step5}
                  onSave={(t) => actions.s5SetReflection('step5', t)}
                  className="text-amber-100 leading-relaxed"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onPrev}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              ← 返回对照视角
            </button>
            <button
              type="button"
              onClick={exportReflection}
              className="cta-warm text-white text-xs font-medium tracking-wider px-5 py-2.5 rounded-full flex items-center gap-2 cursor-pointer"
            >
              <span>导出反思档案</span>
              <span>↓</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
