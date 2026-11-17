// ============================================================
// 静观浮标（可拖拽）+ 观察舱抽屉
//
// 与原型对应：浮标可拖动，拖动超过 4px 视为拖拽，否则视为点击打开
//
// 与原型的区别（AI 接入后）：
// - 开场白与三条追问由 AI 根据用户的实际情境生成，不再使用内置剧本
// - 追问按钮点击后走真实多轮对话
// - 「换一组视角提问」让 AI 针对当前情境重新出题
// - 只有 AI 完全不可用时，才降级到本地剧本（并明确提示）
// ============================================================
import { useEffect, useRef, useState } from 'react'

import { useApp } from '../state/AppProvider.jsx'
import { fragmentsOf } from '../state/store.js'
import {
  STILLPOINT_CONTEXT_ENGINE,
  STILLPOINT_REROLL_POOLS,
  buildFallbackReply,
  getStageFocusLabel,
  matchBranch,
} from '../ai/stillpointEngine.js'
import { generateStillpointOpening, stillpointStream } from '../ai/client.js'

export default function Stillpoint({ stageIndex, activeContextKey, toast }) {
  const { state, actions } = useApp()
  const sp = state.stillpoint

  const wrapRef = useRef(null)
  const btnRef = useRef(null)
  const msgRef = useRef(null)
  const inputRef = useRef(null)
  const drag = useRef({ down: false, moved: false, sx: 0, sy: 0, ol: 0, ot: 0 })
  const replyTimer = useRef(null)
  const busyRef = useRef(false)
  const openingRef = useRef(false)
  const conversationRef = useRef([])

  // 流式状态
  const [thinking, setThinking] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [openingLoading, setOpeningLoading] = useState(false)
  const [rerolling, setRerolling] = useState(false)

  // ---- 抽屉宽度：可拖左边缘调整（360–720px）----
  const MIN_W = 360
  const MAX_W = 720
  const [drawerWidth, setDrawerWidth] = useState(() => {
    try {
      const saved = Number(localStorage.getItem('between-us:drawer-width'))
      if (saved >= MIN_W && saved <= MAX_W) return saved
    } catch {
      /* 忽略 */
    }
    return 440
  })
  const [resizing, setResizing] = useState(false)
  const resizeRef = useRef({ active: false, startX: 0, startW: 0 })

  // 窄屏（手机）不做固定宽度，交给 CSS 全宽
  const [isNarrow, setIsNarrow] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 640 : false,
  )
  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 640)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const onResizeDown = (e) => {
    e.preventDefault()
    resizeRef.current = { active: true, startX: e.clientX, startW: drawerWidth }
    setResizing(true)
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* 忽略 */
    }
  }

  useEffect(() => {
    if (!resizing) return

    const onMove = (e) => {
      const r = resizeRef.current
      if (!r.active) return
      // 向右拖 = 变窄；向左拖 = 变宽
      const delta = r.startX - e.clientX
      const next = Math.max(MIN_W, Math.min(MAX_W, r.startW + delta))
      setDrawerWidth(next)
    }
    const onUp = () => {
      resizeRef.current.active = false
      setResizing(false)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [resizing])

  // 宽度变化后持久化（防抖）
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem('between-us:drawer-width', String(drawerWidth))
      } catch {
        /* 忽略 */
      }
    }, 400)
    return () => clearTimeout(t)
  }, [drawerWidth])

  // 阶段 04 的 activeContextKey 在 AI 生成前仍是模板值（delay26 等），
  // 不能让它参与 signature，也不能据此引用剧本
  const s4Ready = state.stage04.aiStatus === 'ai'
  const signature = `${stageIndex}|${fragmentsOf(state.stage01).length}|${s4Ready ? activeContextKey : 'pending'}`

  // 降级用的剧本：仅在阶段 04 已由 AI 生成时才引用，
  // 否则使用中性开场，避免把「26 小时」这类模板内容说给用户听
  const ctxData = s4Ready
    ? STILLPOINT_CONTEXT_ENGINE[activeContextKey] || STILLPOINT_CONTEXT_ENGINE.delay26
    : null
  const neutralOpening = [
    '我在这里。你可以直接说此刻最想理清的那一部分，或者从你最放不下的一个细节开始。',
  ]

  // 当前情境材料（供开场与追问使用）
  //
  // 关键：只有该阶段已经被 AI 生成过，才把它当作真实材料传给模型。
  // 否则 state 里仍是原型模板（「26 小时」「五天」那套），
  // 会让静观拿着别人的故事提问 —— 这正是之前的问题。
  const s2Ready = state.stage02.aiStatus === 'ai'
  const s3Ready = state.stage03.aiStatus === 'ai'

  const situation = {
    fragments: fragmentsOf(state.stage01),
    facts: s2Ready ? state.stage02.facts : [],
    interpretations: s2Ready ? state.stage02.interpretations : [],
    coreNeed: s2Ready ? state.stage02.coreNeed : '',
    emotions: s2Ready ? state.stage02.emotions.filter((e) => e.selected).map((e) => e.label) : [],
    insights: s3Ready ? state.stage03.insights : [],
    note: s3Ready ? state.stage03.note : '',
    stageLabel:
      fragmentsOf(state.stage01).length > 0 ? '围绕用户记录的这件事' : getStageFocusLabel(stageIndex, activeContextKey),
  }

  // 观测焦点文案：AI 可用时不再显示剧本标题，改为通用描述
  const focusLabel =
    fragmentsOf(state.stage01).length > 0 ? '围绕你记录的这件事' : getStageFocusLabel(stageIndex, activeContextKey)

  // 材料指纹：片段数量与内容长度变化时，说明用户补充或修改了记录，开场需要重算
  const materialKey = fragmentsOf(state.stage01)
    .map((f) => `${f.text.length}:${f.text.slice(0, 6)}`)
    .join('|')

  // 用 AI 生成开场白与追问
  const loadOpening = async (force = false) => {
    if (openingRef.current) return

    const hasMaterial = fragmentsOf(state.stage01).length > 0

    // 没有材料：给中性引导，并且不占用 AI 调用
    if (!hasMaterial) {
      actions.spInit(
        ['你还没有在「记录冲突」里写下具体的事情。等你写下之后，我们可以从那里开始。'],
        [],
        signature,
      )
      return
    }

    if (!force && sp.messages.length > 0) return

    openingRef.current = true
    setOpeningLoading(true)
    try {
      const res = await generateStillpointOpening({ ...situation, mode: 'opening' })
      if (res.ok && res.data?.opening?.length) {
        actions.spInit(res.data.opening, res.data.questions || [], signature)
      } else {
        // 降级到剧本
        actions.spInit(ctxData ? ctxData.opening : neutralOpening, ctxData ? ctxData.initialQuestions : [], signature)
        toast?.('AI 暂时不可用，已使用本地开场')
      }
    } catch {
      actions.spInit(ctxData ? ctxData.opening : neutralOpening, ctxData ? ctxData.initialQuestions : [], signature)
      toast?.('AI 暂时不可用，已使用本地开场')
    } finally {
      setOpeningLoading(false)
      openingRef.current = false
    }
  }

  // 阶段 / 焦点 / 材料变化时重新生成开场
  useEffect(() => {
    if (sp.contextSignature !== signature) {
      loadOpening(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  // 用户补充或修改了记录后，若当前开场还是「还没有记录」的空态，则重新生成
  useEffect(() => {
    if (fragmentsOf(state.stage01).length === 0) return
    if (openingRef.current || openingLoading) return
    // 已有实质对话时不动
    if (sp.messages.length > 1) return
    const onlyPlaceholder =
      sp.messages.length === 0 ||
      (sp.messages.length === 1 &&
        sp.messages[0].role === 'ai' &&
        sp.messages[0].paragraphs?.[0]?.includes('你还没有在「记录冲突」里写下'))
    if (onlyPlaceholder) {
      loadOpening(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialKey])

  // 抽屉首次打开且当前只有空态引导时，重新生成真实开场
  useEffect(() => {
    if (!sp.open) return
    const isEmptyGuide =
      sp.messages.length === 0 ||
      (sp.messages.length === 1 &&
        sp.messages[0].role === 'ai' &&
        sp.messages[0].paragraphs?.[0]?.includes('你还没有在「记录冲突」里写下'))
    if (isEmptyGuide) loadOpening(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp.open])

  // 从其他页面带入内容时，聚焦输入框方便用户直接提问
  useEffect(() => {
    if (sp.open && sp.seed?.text) {
      setTimeout(() => {
        const el = inputRef.current
        if (el) {
          el.focus()
          el.setSelectionRange(el.value.length, el.value.length)
        }
      }, 350)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp.seed])

  // 新消息后滚到底部
  useEffect(() => {
    if (msgRef.current) msgRef.current.scrollTop = msgRef.current.scrollHeight
  }, [sp.messages, thinking, streamingText])

  useEffect(() => () => clearTimeout(replyTimer.current), [])

  // ---- 交互：处理一次用户输入 ----
  const processInteraction = async (userText) => {
    if (busyRef.current) return
    busyRef.current = true

    actions.spAddUser(userText)

    // 先把历史快照下来（sp.messages 在 dispatch 之后才会变）
    const history = sp.messages.map((m) => ({ role: m.role, paragraphs: m.paragraphs }))
    conversationRef.current = history

    const branch = ctxData ? matchBranch(ctxData, userText) : null
    let accumulated = ''
    let gotDelta = false

    clearTimeout(replyTimer.current)
    setThinking(true)

    // 失败时的兜底：剧本引擎
    const fallback = () => {
      setThinking(false)
      setStreamingText('')
      busyRef.current = false
      if (branch) {
        actions.spAddAi(branch.reply, branch.nextQuestions)
      } else {
        actions.spAddAi(buildFallbackReply(userText), ctxData ? ctxData.fallbackQuestions : [])
      }
      toast?.('AI 暂时不可用，已切换到本地陪聊模式')
    }

    try {
      await stillpointStream({
        context: {
          ...situation,
          history,
          userText,
        },
        onDelta: (t) => {
          gotDelta = true
          accumulated += t
          setStreamingText(accumulated)
        },
        onDone: (full) => {
          setThinking(false)
          setStreamingText('')
          busyRef.current = false
          const text = (full || accumulated).trim()
          if (text) {
            actions.spAddAi([text], [])
            // 回复后基于最新对话重新生成贴合情境的追问（不阻塞主流程）
            refreshQuestions(text)
          } else {
            fallback()
          }
        },
        onError: () => {
          // 已经收到部分内容就保留，否则回退
          if (gotDelta && accumulated.trim()) {
            setThinking(false)
            setStreamingText('')
            busyRef.current = false
            actions.spAddAi([accumulated.trim()], [])
            refreshQuestions(accumulated.trim())
          } else {
            fallback()
          }
        },
      })
    } catch {
      fallback()
    }
  }

  // 每次回复后，让 AI 基于最新对话重新出三条追问
  const refreshQuestions = async (lastReply) => {
    if (fragmentsOf(state.stage01).length === 0) return
    try {
      const res = await generateStillpointOpening({
        ...situation,
        mode: 'questions',
        history: conversationRef.current,
        lastReply,
      })
      if (res.ok && res.data?.questions?.length) {
        actions.spSetQuestions(res.data.questions)
      }
    } catch {
      /* 追问生成失败不影响主对话，保留原有追问 */
    }
  }

  const submitReply = () => {
    const val = sp.draft.trim()
    if (!val) return
    processInteraction(val)
  }

  // 换一组提问：让 AI 针对当前情境重新出题；失败才回落到通用池
  const reroll = async () => {
    if (rerolling) return
    setRerolling(true)
    try {
      if (fragmentsOf(state.stage01).length > 0) {
        const res = await generateStillpointOpening({
          ...situation,
          mode: 'questions',
          history: sp.messages.map((m) => ({ role: m.role, paragraphs: m.paragraphs })),
        })
        if (res.ok && res.data?.questions?.length) {
          actions.spSetQuestions(res.data.questions)
          actions.spBumpReroll()
          toast?.('已根据你的情境换了一组提问')
          return
        }
      }
      const pool = STILLPOINT_REROLL_POOLS[sp.rerollIndex % STILLPOINT_REROLL_POOLS.length]
      actions.spSetQuestions(pool)
      actions.spBumpReroll()
      toast?.('已刷新一组通用提问')
    } catch {
      const pool = STILLPOINT_REROLL_POOLS[sp.rerollIndex % STILLPOINT_REROLL_POOLS.length]
      actions.spSetQuestions(pool)
      actions.spBumpReroll()
      toast?.('已刷新一组通用提问')
    } finally {
      setRerolling(false)
    }
  }

  // ---- 拖拽浮标 ----
  const onPointerDown = (e) => {
    const wrap = wrapRef.current
    const btn = btnRef.current
    if (!wrap || !btn) return
    const d = drag.current
    d.down = true
    d.moved = false
    d.sx = e.clientX
    d.sy = e.clientY
    const rect = wrap.getBoundingClientRect()
    d.ol = rect.left
    d.ot = rect.top
    wrap.style.right = 'auto'
    wrap.style.bottom = 'auto'
    wrap.style.left = `${rect.left}px`
    wrap.style.top = `${rect.top}px`
    try {
      btn.setPointerCapture(e.pointerId)
    } catch {
      /* 忽略 */
    }
  }

  const onPointerMove = (e) => {
    const wrap = wrapRef.current
    const btn = btnRef.current
    const d = drag.current
    if (!wrap || !btn || !d.down) return
    const dx = e.clientX - d.sx
    const dy = e.clientY - d.sy
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      d.moved = true
      btn.classList.add('dragging')
    }
    if (d.moved) {
      const maxLeft = window.innerWidth - wrap.offsetWidth - 12
      const maxTop = window.innerHeight - wrap.offsetHeight - 12
      wrap.style.left = `${Math.max(12, Math.min(maxLeft, d.ol + dx))}px`
      wrap.style.top = `${Math.max(12, Math.min(maxTop, d.ot + dy))}px`
    }
  }

  const onPointerUp = (e) => {
    const btn = btnRef.current
    const d = drag.current
    if (!d.down) return
    d.down = false
    btn?.classList.remove('dragging')
    try {
      if (btn && btn.hasPointerCapture(e.pointerId)) btn.releasePointerCapture(e.pointerId)
    } catch {
      /* 忽略 */
    }
    // 未移动视为点击
    if (!d.moved) actions.spToggleOpen()
  }

  return (
    <>
      {/* 浮标 */}
      <div ref={wrapRef} className="fixed right-6 sm:right-10 top-[62%] z-40">
        <button
          ref={btnRef}
          type="button"
          aria-label="拖动或点击打开静观"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="stillpoint-orb group flex items-center gap-2.5 px-4 py-2.5 rounded-full cursor-grab"
        >
          <span className="relative flex items-center justify-center w-3 h-3 shrink-0 pointer-events-none">
            <span className="beacon-ring-1 absolute inset-0 rounded-full border border-amber-300/75" />
            <span className="beacon-ring-2 absolute inset-0 rounded-full border border-[#f28c38]/65" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#f28c38] coral-pulse" />
          </span>
          <span className="text-xs tracking-[0.18em] text-mistwhite/95 font-light pointer-events-none">静观</span>
        </button>
      </div>

      {/* 抽屉 */}
      <aside
        aria-label="静观第三方观察通道"
        style={{ width: isNarrow ? undefined : drawerWidth }}
        className={`stillpoint-drawer fixed inset-y-0 right-0 z-50 flex flex-col justify-between p-5 sm:p-6 w-full sm:w-auto ${
          sp.open ? 'open' : ''
        } ${resizing ? 'select-none' : ''}`}
      >
        {/* 左侧拖拽把手：调宽度 */}
        <div
          role="separator"
          aria-label="拖动调整宽度"
          onPointerDown={onResizeDown}
          className={`group absolute inset-y-0 left-0 z-10 w-3 -translate-x-1/2 cursor-col-resize ${
            sp.open ? '' : 'pointer-events-none'
          }`}
        >
          <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/[0.06] transition-colors group-hover:bg-[#f28c38]/50" />
          <span className="absolute left-1/2 top-1/2 flex h-10 w-1 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/[0.12] opacity-0 transition-opacity group-hover:opacity-100">
            <span className="h-4 w-px bg-white/50" />
          </span>
        </div>
        <div className="pb-4 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#f28c38] coral-pulse" />
            <div>
              <h2 className="font-serif-sc text-base text-slate-100 font-normal">静观</h2>
              <p className="text-[11px] text-slate-400 font-light">我们可以慢慢聊聊</p>
            </div>
          </div>
          <button
            type="button"
            onClick={actions.spToggleOpen}
            className="px-3 py-1 rounded-full text-xs bg-white/[0.04] hover:bg-white/[0.1] text-slate-300 transition-colors cursor-pointer"
          >
            收起 ✕
          </button>
        </div>

        <div className="py-2.5 px-3.5 mt-3 rounded-2xl bg-amber-400/[0.06] border border-amber-300/15 flex items-center justify-between gap-2 text-[11px]">
          <span className="text-amber-200/85 truncate">
            当前观测焦点：<strong className="font-normal text-amber-100">{focusLabel}</strong>
          </span>
          <span className="text-slate-400 shrink-0">动态上下文</span>
        </div>

        <div ref={msgRef} className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {sp.messages.map((m, i) =>
            m.role === 'ai' ? (
              <div key={`ai-${i}`} className="glass-warm-solid rounded-[20px] p-4 space-y-2.5 animate-reveal">
                <div className="flex items-center gap-2 text-[11px] text-amber-200/85">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#f28c38]" />
                  <span>静观</span>
                </div>
                {m.paragraphs.map((p, j) => (
                  <p key={j} className="text-xs sm:text-[13px] text-slate-200/95 leading-relaxed font-light">
                    {p}
                  </p>
                ))}
              </div>
            ) : (
              <div key={`user-${i}`} className="flex justify-end animate-reveal">
                <div className="glass-other rounded-[20px] px-4 py-3 max-w-[85%] text-xs sm:text-[13px] text-sky-50 leading-relaxed">
                  {m.paragraphs[0]}
                </div>
              </div>
            ),
          )}

          {/* 思考中 */}
          {thinking && (
            <div className="glass-warm-solid rounded-[20px] p-4 space-y-2">
              <div className="flex items-center gap-2 text-[11px] text-amber-200/85">
                <span className="w-1.5 h-1.5 rounded-full bg-[#f28c38] animate-pulse" />
                <span>静观 · 正在想</span>
              </div>
              <div className="flex gap-1.5 pt-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-amber-300/60 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 流式输出中 */}
          {!thinking && streamingText && (
            <div className="glass-warm-solid rounded-[20px] p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-[11px] text-amber-200/85">
                <span className="w-1.5 h-1.5 rounded-full bg-[#f28c38]" />
                <span>静观</span>
              </div>
              <p className="text-xs sm:text-[13px] text-slate-200/95 leading-relaxed font-light whitespace-pre-wrap">
                {streamingText}
                <span className="ml-0.5 inline-block h-3 w-[2px] translate-y-[2px] bg-amber-300/80 animate-pulse" />
              </p>
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-white/[0.08] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              {openingLoading ? '正在准备…' : '你也可以问问自己：'}
            </span>
            <button
              type="button"
              onClick={reroll}
              disabled={rerolling || openingLoading}
              className="text-[11px] text-amber-300/85 hover:text-amber-200 flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className={rerolling ? 'inline-block animate-spin' : ''}>↻</span>
              <span>{rerolling ? '生成中…' : '换几个问题'}</span>
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {openingLoading && (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-8 w-full animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.03]"
                    style={{ animationDelay: `${i * 0.12}s` }}
                  />
                ))}
              </div>
            )}

            {!openingLoading && sp.questions.length === 0 && sp.messages.length > 0 && (
              <p className="px-1 text-[11px] leading-relaxed text-slate-500">
                也可以点「换几个问题」，或者直接把心里的疑惑说给我听。
              </p>
            )}

            {!openingLoading &&
              sp.questions.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => processInteraction(q)}
                  className="w-full text-left px-3.5 py-2 rounded-2xl text-xs bg-white/[0.04] hover:bg-amber-400/15 text-slate-200 hover:text-amber-100 border border-white/[0.07] hover:border-amber-300/35 transition-all duration-300 flex items-center justify-between gap-2 animate-reveal cursor-pointer"
                >
                  <span className="leading-snug">{q}</span>
                  <span className="text-amber-300/80 shrink-0">↗</span>
                </button>
              ))}
          </div>

          <div className="glass-panel rounded-full p-1.5 pl-4 flex items-center gap-2 focus-within:border-amber-400/45">
            <input
              type="text"
              value={sp.draft}
              onChange={(e) => actions.spSetDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitReply()
              }}
              ref={inputRef}
              placeholder="说说你此刻的疑惑，或者想不通的地方…"
              className="flex-1 bg-transparent text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={submitReply}
              className="px-4 py-1.5 rounded-full text-xs bg-[#f28c38]/85 hover:bg-[#f28c38] text-white font-medium transition-colors shrink-0 cursor-pointer"
            >
              说给她听 ↑
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
