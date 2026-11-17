// ============================================================
// 阶段 01：记录冲突 · CAPTURE（AI 动态追问版）
//
// 与原型的区别：
// - 不再是固定的四步引导，而是 AI 根据你上一轮的回答，追问下一个问题
// - 标签由 AI 每轮生成，贴合当前问题
// - 问题数量不设上限，由 AI 判断信息是否足够
// - 右侧：核心主题摘要（进入下一步时生成）+ 问答时间线
// - 已去掉「当时的原话记忆」板块
// ============================================================
import { useEffect, useRef, useState } from 'react'

import { useApp } from '../state/AppProvider.jsx'
import { S1_IMAGE_SNIPPET } from '../data/stage01.js'
import { useSpeechRecognition } from '../lib/useSpeechRecognition.js'
import { useStage01Probe } from './stage01/useStage01Probe.js'

const CHIP_BASE =
  'animate-reveal px-3.5 py-1.5 rounded-full text-xs tracking-[0.08em] border transition-all cursor-pointer'
const CHIP_IDLE =
  'border-slatefrost/20 bg-white/[0.02] text-slatefrost/85 hover:border-[#f28c38]/60 hover:text-mistwhite'
const CHIP_PICKED = 'border-[#f28c38] bg-[#f28c38]/20 text-amber-100 scale-[1.03]'

// 时间线里的一轮问答：可编辑回答、可删除
function RoundItem({ item, isCurrent, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.answer || '')

  const startEdit = () => {
    setDraft(item.answer || '')
    setEditing(true)
  }
  const save = () => {
    if (!editing) return
    const t = draft.trim()
    if (t && t !== item.answer) onEdit(item.id, t)
    setEditing(false)
  }

  return (
    <li
      className={`group rounded-lg border p-2.5 leading-relaxed transition-colors ${
        isCurrent
          ? 'bg-[#f28c38]/[0.14] border-[#f28c38]/55'
          : 'bg-[#f28c38]/[0.06] border-[#f28c38]/25'
      }`}
    >
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <p className="text-[11px] leading-snug text-[#f28c38]/80">{item.question}</p>
        {item.answer && (
          <div className="flex shrink-0 items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={startEdit}
              className="text-[10px] text-slatefrost/70 hover:text-mistwhite cursor-pointer"
            >
              改
            </button>
            <span className="text-slatefrost/25">|</span>
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              className="text-[10px] text-slatefrost/70 hover:text-[#FF6B4A] cursor-pointer"
            >
              删
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <input
          autoFocus
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') setEditing(false)
          }}
          className="w-full rounded-md bg-slate-950/70 px-2 py-1 text-[13px] text-amber-100 focus:outline-none focus:ring-1 focus:ring-[#f28c38]/50"
        />
      ) : item.answer ? (
        <p className="text-[13px] text-mistwhite/95">{item.answer}</p>
      ) : (
        <p className="text-[13px] italic text-slatefrost/40">（正在输入中…）</p>
      )}
    </li>
  )
}

export default function Stage01Capture({ onNext, toast }) {
  const { state, actions } = useApp()
  const s1 = state.stage01
  const probe = useStage01Probe(toast)

  const [flashChip, setFlashChip] = useState(null)
  const chipTimer = useRef(null)
  const fileRef = useRef(null)
  const textareaRef = useRef(null)
  const [voiceFlash, setVoiceFlash] = useState(false)
  const flashTimer = useRef(null)
  const [confirmReset, setConfirmReset] = useState(false)

  const current = s1.qa[s1.qa.length - 1]
  const answered = s1.qa.filter((q) => q.answer && q.answer.trim())
  const isLastUnanswered = current && !current.answer

  const speech = useSpeechRecognition({
    lang: 'zh-CN',
    onResult: (text) => {
      actions.appendDraft(text)
      setVoiceFlash(true)
      clearTimeout(flashTimer.current)
      flashTimer.current = setTimeout(() => setVoiceFlash(false), 1600)
      toast('语音片段已转写至输入框')
    },
    onError: (err) => {
      const messages = {
        unsupported: '当前浏览器不支持语音识别，请用文字输入（推荐 Chrome / Edge）',
        'not-allowed': '麦克风权限被拒绝，请在浏览器地址栏允许后重试',
        'service-not-allowed': '浏览器拒绝了语音服务，请用文字输入',
        'no-speech': '没有听到声音，请再试一次',
        network: '语音识别需要网络连接，请检查网络',
      }
      toast(messages[err] || '语音识别失败，请用文字输入')
    },
  })

  useEffect(
    () => () => {
      clearTimeout(flashTimer.current)
      clearTimeout(chipTimer.current)
      clearTimeout(pickTimer.current)
    },
    [],
  )

  // 换到新问题时清空多选
  useEffect(() => {
    pickedRef.current = []
    setPicked([])
    clearTimeout(pickTimer.current)
  }, [current?.id])

  // 多选标签：点击只切换选中，不立即提交
  const [picked, setPicked] = useState([])
  const pickedRef = useRef([])
  const pickTimer = useRef(null)
  // 用 ref 读最新输入框内容，避免定时器闭包读到旧值
  const stateRefDraft = useRef('')
  stateRefDraft.current = s1.draft

  const pickChip = (label) => {
    if (probe.busy) return

    const cur = pickedRef.current
    const next = cur.includes(label) ? cur.filter((p) => p !== label) : [...cur, label]
    pickedRef.current = next
    setPicked(next)

    clearTimeout(pickTimer.current)
    // 停手 1.5 秒后自动提交；继续点选会重新计时
    if (next.length > 0) {
      pickTimer.current = setTimeout(() => {
        const snapshot = pickedRef.current
        if (snapshot.length === 0) return
        const extra = stateRefDraft.current.trim()
        const merged = [extra, ...snapshot].filter(Boolean).join('；')
        pickedRef.current = []
        setPicked([])
        // 多选也走预取分支：用第一个选中标签的下一问，避免必然等一次完整往返
        probe.pickMulti(snapshot[0], merged)
      }, 1500)
    }
  }

  const submit = () => {
    if (probe.busy) return
    probe.pickChip(s1.draft)
  }

  const onVoiceClick = () => {
    if (speech.listening) speech.stop()
    else speech.start()
  }

  // 回到上一题：清空最后一轮的回答，问题留在原地，输入框清空并聚焦
  const revertOne = () => {
    if (probe.busy) return
    actions.s1Revert()
    toast('已回到上一题，可以重新回答')
    setTimeout(() => textareaRef.current?.focus(), 60)
  }

  // 从头再来：二次确认后清空本阶段，重新生成第一个问题
  const doReset = () => {
    setConfirmReset(false)
    actions.resetStage01()
    toast('已清空本阶段的记录，重新开始')
    // 阶段清空后 qa 为空，useStage01Probe 的挂载 effect 不会重跑，这里手动重新起第一问。
    // 显式传空数组，避免 setTimeout 里读到还没更新的 state
    setTimeout(() => probe.askNext([]), 0)
  }

  const onFileChange = (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    actions.appendDraftNewline(S1_IMAGE_SNIPPET)
    toast(`已从「${file.name}」提取对话片段`)
    e.target.value = ''
  }

  const handleNext = async () => {
    if (!probe.canProceed) {
      toast('可以再多聊两句，让经过更清楚一些')
      return
    }
    await probe.buildSummary()
    onNext()
  }

  return (
    <section className="flex w-full flex-col items-stretch gap-6 lg:flex-row lg:gap-8">
      {/* ---------- 左：提问与输入 ---------- */}
      <div className="glass-panel flex min-h-[560px] flex-1 flex-col justify-between rounded-2xl p-7 sm:p-10">
        <div className="space-y-6">
          <div className="space-y-2.5">
            <h1 className="font-serif-sc text-2xl font-normal leading-relaxed text-mistwhite transition-all duration-500 sm:text-[28px]">
              {current ? current.question : probe.error ? '暂时没能准备好问题' : '正在准备第一个问题…'}
            </h1>
            <p className="text-xs font-light leading-relaxed text-slatefrost/75 transition-all duration-500 sm:text-[13px]">
              {current
                ? '想到多少说多少，说清楚就好。我们会顺着你的回答往下问。'
                : probe.error
                  ? probe.error
                  : '静观正在读你的情况，稍等一下。'}
            </p>
            {/* 首问失败时给出重试入口：首次请求只在挂载时发一次，没有这一步用户只能刷新页面 */}
            {!current && probe.error && (
              <button
                type="button"
                onClick={() => probe.askNext()}
                disabled={probe.busy}
                className="mt-1 inline-flex items-center gap-2 rounded-full border border-[#f28c38]/40 bg-[#f28c38]/10 px-4 py-1.5 text-[11px] tracking-[0.12em] text-[#f28c38] transition-colors hover:bg-[#f28c38]/20 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
              >
                <span>↻ 重新准备</span>
              </button>
            )}
          </div>

          {/* 进度：已聊几轮 + 回退操作 */}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-light tracking-[0.12em] text-[#f28c38]/90">
              {probe.enough ? '信息已经比较完整了' : '慢慢说，不着急'}
            </p>

            <div className="flex shrink-0 items-center gap-2">
              {answered.length > 0 && (
                <button
                  type="button"
                  onClick={revertOne}
                  disabled={probe.busy}
                  className="rounded-full border border-slatefrost/20 px-2.5 py-1 text-[11px] text-slatefrost/80 transition-colors hover:border-[#f28c38]/50 hover:text-mistwhite disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                >
                  ← 上一题
                </button>
              )}

              {confirmReset ? (
                <span className="flex items-center gap-1.5 text-[11px]">
                  <span className="text-amber-300/85">清空重来？</span>
                  <button
                    type="button"
                    onClick={doReset}
                    className="text-[#f28c38] hover:underline cursor-pointer"
                  >
                    确认
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="text-slatefrost/70 hover:text-mistwhite cursor-pointer"
                  >
                    取消
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  disabled={probe.busy}
                  className="rounded-full border border-slatefrost/20 px-2.5 py-1 text-[11px] text-slatefrost/80 transition-colors hover:border-[#f28c38]/50 hover:text-mistwhite disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                >
                  ↻ 从头再来
                </button>
              )}

              <span className="text-[11px] font-mono text-slatefrost/45">
                已聊 {answered.length} 轮
              </span>
            </div>
          </div>

          {/* 可选标签 */}
          {current && current.chips?.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2.5">
                {current.chips.map((chip) => {
                  const label = typeof chip === 'string' ? chip : chip.label
                  const on = picked.includes(label)
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => pickChip(label)}
                      className={`${CHIP_BASE} ${on ? CHIP_PICKED : CHIP_IDLE}`}
                    >
                      {on && <span className="mr-1">✓</span>}
                      {label}
                    </button>
                  )
                })}
              </div>
              {picked.length > 0 && (
                <p className="text-[11px] text-[#f28c38]/70">
                  已选 {picked.length} 项，停手 1.5 秒后自动继续；也可以再点一次取消
                </p>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 space-y-3.5">
          <div className="relative rounded-xl border border-slatefrost/20 bg-abyss/80 p-4 transition-colors focus-within:border-[#f28c38]/55">
            <textarea
              rows={4}
              ref={textareaRef}
              value={s1.draft}
              onChange={(e) => actions.setDraft(e.target.value)}
              onKeyDown={(e) => {
                // 回车提交，Shift+回车换行
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  // 直接读 DOM 值，避免 React 状态还没提交导致提交到旧内容
                  const value = e.currentTarget.value
                  actions.setDraft(value)
                  if (!probe.busy && value.trim()) probe.submitAnswer(value)
                }
              }}
              placeholder="写下你想到的…"
              className="w-full resize-none bg-transparent text-sm font-light leading-relaxed text-mistwhite placeholder:text-slatefrost/35 focus:outline-none"
            />

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slatefrost/10 pt-3">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onVoiceClick}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-all duration-300 cursor-pointer ${
                    voiceFlash || speech.listening
                      ? 'border border-[#f28c38]/40 bg-[#f28c38]/12 text-amber-100'
                      : 'border border-transparent text-slatefrost/80 hover:bg-white/[0.04] hover:text-mistwhite'
                  }`}
                >
                  <svg
                    className={`h-3.5 w-3.5 transition-all duration-300 ${
                      voiceFlash || speech.listening
                        ? 'scale-110 text-[#f28c38] drop-shadow-[0_0_8px_rgba(242,140,56,0.9)]'
                        : 'text-slatefrost/85'
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M19 10v1a7 7 0 0 1-14 0v-1M12 19v3" />
                  </svg>
                  <span>{speech.listening ? '正在聆听…' : voiceFlash ? '语音已录入' : '语音讲述'}</span>
                </button>

                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-slatefrost/80 transition-colors hover:bg-white/[0.04] hover:text-mistwhite">
                  <svg className="h-3.5 w-3.5 text-slatefrost/85" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.6" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M21 15l-5-5L5 21" />
                  </svg>
                  <span>相册上传</span>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
                </label>
              </div>

              <button
                type="button"
                onClick={submit}
                disabled={probe.busy || !isLastUnanswered}
                className="inline-flex items-center gap-2 rounded-full bg-slatefrost/15 px-5 py-2 text-xs tracking-[0.14em] text-mistwhite transition-all hover:bg-[#f28c38] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span>{probe.busy ? '正在想下一个问题…' : '继续说'}</span>
                <span>↵</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 px-1 text-xs text-[#f28c38]/90">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#f28c38] shadow-[0_0_8px_#f28c38]" />
            <span className="font-light">
              {probe.error
                ? `${probe.error}，可以点「继续说」重试`
                : probe.busy
                  ? '静观正在想接着问什么…'
                  : '接下来会顺着你的回答继续问'}
            </span>
          </div>
        </div>
      </div>

      {/* ---------- 右：摘要与时间线 ---------- */}
      <aside className="paper-surface flex w-full flex-col justify-between rounded-2xl p-7 sm:p-9 lg:w-[430px] min-h-[560px]">
        <div className="paper-grain-overlay" />
        <div className="relative z-10 space-y-5">
          <div className="flex items-center justify-between border-b border-mistwhite/10 pb-3.5">
            <div className="flex items-center gap-2.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#f28c38] shadow-[0_0_8px_#f28c38]" />
              <h2 className="font-serif-sc text-xl tracking-[0.12em] text-mistwhite">事件时间线</h2>
            </div>
            <span className="text-[11px] text-slatefrost/65">已聊 {answered.length} 轮</span>
          </div>

          <div className="space-y-4 text-xs">
            {/* 核心主题摘要 */}
            <div className="space-y-2 rounded-xl border border-slatefrost/15 bg-abyss/55 p-4">
              <span className="block text-[11px] tracking-[0.14em] text-[#f28c38]/90">核心主题摘要</span>
              {s1.summaryLoading ? (
                <div className="space-y-1.5">
                  <div className="h-3 w-full animate-pulse rounded bg-white/[0.06]" />
                  <div className="h-3 w-2/3 animate-pulse rounded bg-white/[0.06]" />
                </div>
              ) : s1.coreSummary ? (
                <>
                  <p className="text-xs font-normal leading-relaxed text-mistwhite/95 sm:text-sm">{s1.coreSummary}</p>
                  {s1.keywords?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {s1.keywords.map((k) => (
                        <span
                          key={k}
                          className="rounded-full border border-[#f28c38]/30 bg-[#f28c38]/10 px-2 py-0.5 text-[10px] text-amber-100/85"
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs font-light italic leading-relaxed text-slatefrost/55">
                  （聊完主要经过后，点「进入理解自己」会生成摘要）
                </p>
              )}
            </div>

            {/* 问答时间线 */}
            <div className="space-y-2 rounded-xl border border-slatefrost/15 bg-abyss/55 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] tracking-[0.14em] text-slatefrost/85">记录的内容</span>
                <span className="text-[10px] text-slatefrost/50">{answered.length} 轮</span>
              </div>
              <ul className="max-h-[300px] space-y-2 overflow-y-auto pr-1 font-light leading-relaxed">
                {s1.qa.length === 0 ? (
                  <li className="italic text-slatefrost/40">（静观正在准备第一个问题…）</li>
                ) : (
                  s1.qa.map((q, i) => (
                    <RoundItem
                      key={q.id}
                      item={q}
                      isCurrent={i === s1.qa.length - 1}
                      onEdit={actions.s1EditAnswer}
                      onDelete={actions.s1DeleteRound}
                    />
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-5 flex items-center justify-between gap-3 border-t border-mistwhite/10 pt-5">
          <span className="text-[11px] text-slatefrost/60">
            {probe.canProceed ? '可以进入下一步了' : '再聊一两轮会更有帮助'}
          </span>
          <button
            type="button"
            onClick={handleNext}
            disabled={!probe.canProceed || s1.summaryLoading}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full px-5 py-2.5 text-xs font-medium tracking-[0.16em] text-white transition-all ${
              probe.canProceed && !s1.summaryLoading
                ? 'cta-warm cursor-pointer'
                : 'cursor-not-allowed bg-white/[0.06] text-slate-500'
            }`}
          >
            <span>{s1.summaryLoading ? '正在整理…' : '进入理解自己'}</span>
            <span>→</span>
          </button>
        </div>
      </aside>
    </section>
  )
}
