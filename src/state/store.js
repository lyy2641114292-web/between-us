// ============================================================
// 全局状态层：Context + useReducer
// 原型把用户填写的内容全放在 DOM 节点里（刷新即丢），
// 此处全部收进 state，并持久化到 localStorage。
// ============================================================
import {
  S2_CORE_NEED,
  S2_EMOTIONS,
  S2_FACTS,
  S2_INTERPRETATIONS,
} from '../data/stage02.js'
import { S4_OTHER_BUBBLES, S4_SELF_BUBBLES, S4_UNKNOWNS } from '../data/stage04.js'
import { S5_REFLECTIONS_INIT, S5_STEP5_BY_INTENT, S5_TONE_LABELS, s5TemplateDraft } from '../data/stage05.js'

// 把阶段 01 的问答流转成下游（阶段 02-05、静观）需要的片段格式
// 每条回答带上它对应的问题，方便模型理解上下文
export function fragmentsOf(stage01) {
  if (!stage01) return []
  const qa = Array.isArray(stage01.qa) ? stage01.qa : []
  return qa
    .filter((q) => q.answer && q.answer.trim())
    .map((q, i) => ({
      id: q.id || `frag_${i}`,
      text: q.answer.trim(),
      question: q.question || '',
      step: i + 1,
    }))
}

// 阶段 01 内容指纹：用于判断下游阶段是否需要重新生成
export function stage01Signature(stage01) {
  const frags = fragmentsOf(stage01)
  return frags.map((f) => `${f.text.length}:${f.text.slice(0, 8)}`).join('|')
}

// 规范化一条纯对话：只保留 role 与 text
// role: 'left'  = 原来的你
// role: 'right' = 朋友（她）
// 兜底：剥掉模型偶发残留的旁白/动作/转述前缀（角色互换模式禁止旁白）
function normalizeChatLine(line) {
  if (!line || typeof line.text !== 'string') return null
  let text = line.text.trim()
  if (!text) return null

  const role = line.role === 'right' ? 'right' : 'left'

  // 整行被括号包住的，是旁白/动作，直接丢弃
  if (/^（.*）$/.test(text) || /^\(.*\)$/.test(text) || /^【.*】$/.test(text)) return null

  // 剥掉转述前缀：「她说」「你回应说」「她表示」等
  text = text.replace(/^(原来的你|朋友（她）|朋友|她|他|对方)\s*(说|表示|回应说|回答说|认为|觉得)[，,：:]\s*/, '')
  // 剥掉行中的括号旁白
  text = text.replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '').trim()
  // 剥掉外层引号，渲染时统一加
  text = text.replace(/^[「“"']+/, '').replace(/[」”"']+$/, '').trim()

  return text ? { role, text } : null
}

// 规范化一轮的 chat 数组
function normalizeChat(chat) {
  if (!Array.isArray(chat)) return []
  return chat.map(normalizeChatLine).filter(Boolean).slice(0, 4)
}

// 阶段 03 的四个情绪角度草稿
// 新结构：[{ key, text }]（key 为 2~4 字关键词）
// 兼容旧结构：{ A, B }（存档 v4）或纯字符串数组
const LEGACY_OPTION_KEYS = ['A', 'B', 'C', 'D']

function normalizeOptions(options) {
  if (Array.isArray(options)) {
    return options
      .map((opt, i) => {
        if (typeof opt === 'string') {
          const text = opt.trim()
          return text ? { key: LEGACY_OPTION_KEYS[i] || `选项${i + 1}`, text } : null
        }
        if (!opt || typeof opt.text !== 'string') return null
        const text = opt.text.trim()
        if (!text) return null
        const key = typeof opt.key === 'string' && opt.key.trim() ? opt.key.trim() : LEGACY_OPTION_KEYS[i] || `选项${i + 1}`
        return { key: key.slice(0, 6), text }
      })
      .filter(Boolean)
      .slice(0, 4)
  }

  // 旧结构 { A: '...', B: '...' }
  if (options && typeof options === 'object') {
    return ['A', 'B', 'C', 'D']
      .map((k) => {
        const text = typeof options[k] === 'string' ? options[k].trim() : ''
        return text ? { key: k, text } : null
      })
      .filter(Boolean)
  }

  return []
}

// 换位觉察卡：引导语 + 4 个觉察项，人称只允许「你」与「朋友」
// 注意：只把作人称的「她」换成「朋友」，不能误伤「其他」这类词。
// 用 split/join 保护「其他」，避免依赖正则后行断言（兼容性更稳）。
function normalizeInsightHint(hint) {
  if (typeof hint !== 'string') return ''
  const cleaned = hint
    .trim()
    .replace(/她（朋友）/g, '朋友')
    .replace(/朋友（她）/g, '朋友')
    .replace(/（她）/g, '')
    .replace(/\(她\)/g, '')
  return cleaned
    .split('其他')
    .map((seg) => seg.replace(/她/g, '朋友'))
    .join('其他')
}

function normalizeInsights(list) {
  if (!Array.isArray(list)) return []
  return list
    .map((x) => {
      if (typeof x !== 'string') return null
      const text = normalizeInsightHint(x)
      return text || null
    })
    .filter(Boolean)
    .slice(0, 4)
}

// AI 返回的情绪名称 → 带颜色的胶囊
// 已有预设复用原配色（保持视觉一致性），新情绪按调色板轮转补充
const EMOTION_PALETTE = [
  { color: '#f28c38', rgb: '242, 140, 56' },
  { color: '#5da9e9', rgb: '93, 169, 233' },
  { color: '#A78BFA', rgb: '167, 139, 250' },
  { color: '#FB7185', rgb: '251, 113, 133' },
  { color: '#FBBF24', rgb: '251, 191, 36' },
  { color: '#34D399', rgb: '52, 211, 153' },
]

function buildEmotionsFromNames(names, existing) {
  return names.slice(0, 6).map((label, i) => {
    // 先找同名预设，保持原配色
    const preset = existing.find((e) => e.label === label)
    if (preset) {
      return { ...preset, id: preset.id || `em_${i}`, selected: true }
    }
    const p = EMOTION_PALETTE[i % EMOTION_PALETTE.length]
    return {
      id: `em_${i}`,
      label,
      color: p.color,
      rgb: p.rgb,
      selected: true,
    }
  })
}

export const INITIAL_STATE = {
  // 阶段 01 记录冲突
  // 阶段 01 记录冲突（AI 动态追问）
  stage01: {
    // 问答流：[{ id, question, chips, answer, askedAt }]
    qa: [],
    // 当前输入框内容
    draft: '',
    // 当前待回答的问题（qa 里的最后一条就是当前问题）
    // 加载状态
    loading: false, // 正在生成下一个问题
    // 后台正在预取「每个标签会通向哪个下一问」（不阻塞用户，仅影响点标签是否零等待）
    branchLoading: false,
    summaryLoading: false,
    error: '',
    // AI 判断信息是否足够
    enough: false,
    // 核心主题摘要（点「进入理解自己」时生成）
    keywords: [],
    coreSummary: '',
    quotes: [], // 用户提到的对方原话（AI 摘录，不是界面板块）
    // 兼容旧字段：旧存档迁移时使用
    fragments: [],
    factCount: 0,
    step: 1,
  },

  // 阶段 02 理解自己
  stage02: {
    emotions: S2_EMOTIONS,
    coreNeed: S2_CORE_NEED,
    needCondensed: false, // 真实需求是否被编辑过（原型 s2IsNeedCondensed）
    facts: S2_FACTS,
    interpretations: S2_INTERPRETATIONS,
    // UI 态（不进存档也可，但保留以便刷新后恢复展开状态）
    addingFact: false,
    newFactDraft: '',
    altEditorOpen: [], // 已展开「补充其他可能性」的解读 id
    // AI 生成状态
    // idle: 尚未请求 | loading: 请求中 | ai: 已用 AI 结果 | template: 降级为模板
    aiStatus: 'idle',
    aiError: '',
    aiGeneratedAt: 0,
    aiSourceSignature: '', // 生成时阶段 01 的内容指纹，用于判断是否需要重生
  },

  // 阶段 03 探索对方 · 角色互换纯对话
  stage03: {
    // 已完成的轮次：每项 { chat:[{role,text}], question, options:[{key,text}], reply, replyKey }
    rounds: [],
    // 当前这一轮（AI 生成，等待用户以「朋友（她）」的身份回应）；null 表示还没生成
    current: null,
    draft: '',
    // 换位觉察卡
    insights: [], // 已选中的觉察项
    // 觉察卡的引导语与 4 个觉察项；随收尾轮一起生成，模型没给则为空
    insightHint: '',
    insightItems: [], // string[]，4 项
    // 后台预取的 4 条分支：{ [key]: { chat, question, options, done, insightHint, insightItems } }
    // 用户点某个草稿时直接取这里的内容，零等待；手打自由输入仍发真实请求
    branches: {},
    branchLoading: false, // 后台正在预取（不阻塞用户）
    note: '', // 可选的自由记录
    done: false, // AI 判断对话够了 / 五轮走完
    // AI 状态
    aiStatus: 'idle', // idle | loading | ai | template
    aiError: '',
    aiSourceSignature: '',
    // 一旦降级，后续轮次继续走本地兜底，避免每轮都等一次超时
    useFallback: false,
  },

  // 阶段 04 对照视角
  stage04: {
    activeSelfId: 'sb1',
    activeOtherId: 'ob1',
    activeUnknownId: 'u1',
    activeContextKey: 'delay26',
    drawerOpen: false,
    // AI 生成的数据；null 表示使用内置模板
    selfBubbles: null,
    otherBubbles: null,
    unknowns: null,
    aiStatus: 'idle', // idle | loading | ai | template
    aiError: '',
  },

  // 阶段 05 决定下一步
  stage05: {
    intent: 'express',
    tone: 'gentle',
    draft: s5TemplateDraft('express', 'gentle'),
    // 五条反思（可编辑）
    reflections: { ...S5_REFLECTIONS_INIT },
    sheetOpen: true,
    // 按方向分开缓存的草稿（2026-11-16 用户指定：来回切方向不再重复生成）
    //   aiDraftsByIntent: { express: {gentle,brief,nopressure}, explain: {...} }
    //     只存 AI 生成的原始版本
    //   draftsByIntent:   同上结构，存「当前正在用的文字」
    //     用户在某个方向改过字就更新这里，切走再切回时原样还原
    aiDraftsByIntent: {},
    draftsByIntent: {},
    // 哪些方向已经请求过 AI（避免重复请求；失败也记，除非用户点「重新生成」）
    aiTriedIntent: {},
    // 本阶段是否有请求在跑
    aiStatus: 'idle',
    aiError: '',
  },

  // 静观抽屉
  stillpoint: {
    open: false,
    // 对话记录：[{ role:'ai'|'user', paragraphs:[...] }]
    messages: [],
    // 当前显示的追问按钮
    questions: [],
    rerollIndex: 0,
    // 输入框草稿
    draft: '',
    // 用于判断是否需要重新初始化对话（阶段或焦点变化时）
    contextSignature: '',
    // 从其他页面带入的上下文（如阶段 02 点某条「感受与判断」）
    // { text, source }，打开抽屉时预填到输入框
    seed: null,
  },
}

export function reducer(state, action) {
  switch (action.type) {
    // ---- 阶段 01 ----
    case 's1/setDraft':
      return { ...state, stage01: { ...state.stage01, draft: action.payload } }

    // 生成下一个问题中
    case 's1/probeStart':
      return { ...state, stage01: { ...state.stage01, loading: true, error: '' } }

    // 收到下一个问题与可选标签（每个标签自带「下一问」，用于零等待）
    case 's1/probeSuccess': {
      const d = action.payload || {}
      const question = typeof d.question === 'string' ? d.question.trim() : ''
      if (!question) {
        return { ...state, stage01: { ...state.stage01, loading: false, error: '问题生成失败' } }
      }

      // 规范化 chips：只保留标签文字；
      // nextQuestion / nextChips 由后台 probeBranch 请求稍后填入（s1/branchSuccess）
      const normChips = (arr) =>
        (Array.isArray(arr) ? arr : [])
          .map((c) => {
            const label = typeof c === 'string' ? c.trim() : c && typeof c.label === 'string' ? c.label.trim() : ''
            if (!label) return null
            return {
              label,
              nextQuestion: '',
              nextChips: [],
            }
          })
          .filter(Boolean)
          .slice(0, 4)

      return {
        ...state,
        stage01: {
          ...state.stage01,
          loading: false,
          error: '',
          enough: Boolean(d.enough),
          draft: '',
          branchLoading: true,
          qa: [
            ...state.stage01.qa,
            {
              id: 'q' + Date.now() + Math.random().toString(36).slice(2, 6),
              question,
              chips: normChips(d.chips),
              answer: '',
              askedAt: Date.now(),
            },
          ],
        },
      }
    }

    // 后台预取完成：把每个标签的「下一问」填进最后一轮的 chips
    // payload: { branches: [{ label, nextQuestion, nextChips }] }
    // 不依赖 roundId：probeSuccess 与 branchSuccess 之间 React 状态可能还没提交，
    // 用「最后一轮」定位最稳，因为后台预取永远针对刚显示出来的那一轮。
    case 's1/branchSuccess': {
      const branches = action.payload?.branches
      if (!Array.isArray(branches) || branches.length === 0) {
        return { ...state, stage01: { ...state.stage01, branchLoading: false } }
      }

      const byLabel = new Map()
      branches.forEach((b) => {
        if (!b || typeof b.label !== 'string') return
        const nextQuestion = typeof b.nextQuestion === 'string' ? b.nextQuestion.trim() : ''
        if (!nextQuestion) return
        const nextChips = (Array.isArray(b.nextChips) ? b.nextChips : [])
          .map((x) => (typeof x === 'string' ? x.trim() : x && typeof x.label === 'string' ? x.label.trim() : ''))
          .filter(Boolean)
          .slice(0, 4)
          .map((label) => ({ label, nextQuestion: '', nextChips: [] }))
        byLabel.set(b.label.trim(), { nextQuestion, nextChips })
      })

      const qa = [...state.stage01.qa]
      const lastIdx = qa.length - 1
      if (lastIdx < 0) return { ...state, stage01: { ...state.stage01, branchLoading: false } }

      qa[lastIdx] = {
        ...qa[lastIdx],
        chips: (qa[lastIdx].chips || []).map((c) => {
          const hit = byLabel.get(c.label)
          return hit ? { ...c, ...hit } : c
        }),
      }

      return {
        ...state,
        stage01: { ...state.stage01, branchLoading: false, qa },
      }
    }

    // 后台预取失败：不打扰用户，只是点标签时退回真实请求
    case 's1/branchFail':
      return { ...state, stage01: { ...state.stage01, branchLoading: false } }

    // 点选一个标签：用它自带的 nextQuestion 直接进入下一问（零等待）
    case 's1/pickChip': {
      const s1 = state.stage01
      const { label, nextQuestion, nextChips } = action.payload
      const qa = [...s1.qa]
      const last = qa[qa.length - 1]
      if (!last) return state

      qa[qa.length - 1] = { ...last, answer: label }

      // 有预取到的下一问 → 立刻追加，无需等 API
      if (nextQuestion) {
        qa.push({
          id: 'q' + Date.now() + Math.random().toString(36).slice(2, 6),
          question: nextQuestion,
          // nextChips 已是规范化后的对象数组，直接沿用
          chips: Array.isArray(nextChips) ? nextChips : [],
          answer: '',
          askedAt: Date.now(),
        })
      }

      return {
        ...state,
        stage01: { ...s1, qa, draft: '', loading: false, error: '', branchLoading: false },
      }
    }

    // 多选合并提交：回答用合并后的完整文字，下一问沿用第一个标签预取到的结果
    // payload: { chip: 第一个命中的标签, answerText: 合并后的回答 }
    case 's1/chipMulti': {
      const s1 = state.stage01
      const { chip, answerText } = action.payload || {}
      const qa = [...s1.qa]
      const last = qa[qa.length - 1]
      if (!last || !chip || !chip.nextQuestion) return state

      qa[qa.length - 1] = { ...last, answer: answerText || chip.label }
      qa.push({
        id: 'q' + Date.now() + Math.random().toString(36).slice(2, 6),
        question: chip.nextQuestion,
        chips: Array.isArray(chip.nextChips) ? chip.nextChips : [],
        answer: '',
        askedAt: Date.now(),
      })

      return {
        ...state,
        stage01: { ...s1, qa, draft: '', loading: false, error: '', branchLoading: false },
      }
    }

    // 使用预判分支：用户选了某条预测回答 → 立刻落答并进入已准备好的下一问
    case 's1/answer': {
      const s1 = state.stage01
      const text = (action.payload || '').trim()
      if (!text) return state
      const qa = [...s1.qa]
      // 找到最后一条未回答的
      const idx = [...qa].reverse().findIndex((q) => !q.answer)
      if (idx >= 0) {
        const realIdx = qa.length - 1 - idx
        qa[realIdx] = { ...qa[realIdx], answer: text }
      }
      return { ...state, stage01: { ...s1, qa, draft: '' } }
    }

    // 编辑某一轮的回答（时间线里直接改）
    case 's1/editAnswer': {
      const s1 = state.stage01
      const qa = s1.qa.map((q) =>
        q.id === action.payload.id ? { ...q, answer: (action.payload.answer || '').trim() || q.answer } : q,
      )
      return { ...state, stage01: { ...s1, qa } }
    }

    // 删除某一轮问答
    case 's1/deleteRound': {
      const s1 = state.stage01
      return {
        ...state,
        stage01: { ...s1, qa: s1.qa.filter((q) => q.id !== action.payload) },
      }
    }

    // 回到上一题：只清空最后一轮已作答的回答，问题保留在原地等用户重答。
    // 与 deleteRound 的区别：不删问题本身，也不触发新的 AI 追问。
    // 若末尾还挂着一条尚未回答的问题（它本来就是基于上一轮回答生成的），
    // 一并去掉，保证「最后一条」始终是当前要回答的那一题。
    case 's1/revert': {
      const s1 = state.stage01
      const qa = s1.qa.map((q) => ({ ...q }))

      // 去掉末尾未作答的轮次
      while (qa.length > 0 && !(qa[qa.length - 1].answer && qa[qa.length - 1].answer.trim())) {
        qa.pop()
      }
      if (qa.length === 0) return state

      // 清掉最后一轮的回答，输入框一并清空，让用户重新组织这句话
      qa[qa.length - 1].answer = ''
      return {
        ...state,
        stage01: { ...s1, qa, draft: '', error: '', loading: false },
      }
    }

    // 语音 / 相册：追加到输入框
    case 's1/appendDraft': {
      const cur = state.stage01.draft
      const next = cur ? `${cur} ${action.payload}` : action.payload
      return { ...state, stage01: { ...state.stage01, draft: next } }
    }

    case 's1/appendDraftNewline': {
      const cur = state.stage01.draft
      const next = cur ? `${cur}\n${action.payload}` : action.payload
      return { ...state, stage01: { ...state.stage01, draft: next } }
    }

    // 摘要生成
    case 's1/summaryStart':
      return { ...state, stage01: { ...state.stage01, summaryLoading: true } }

    case 's1/summarySuccess': {
      const d = action.payload || {}
      const keywords = Array.isArray(d.keywords)
        ? d.keywords.filter((k) => typeof k === 'string' && k.trim()).slice(0, 6)
        : []
      const quotes = Array.isArray(d.quotes)
        ? d.quotes.filter((q) => typeof q === 'string' && q.trim()).slice(0, 3)
        : []
      return {
        ...state,
        stage01: {
          ...state.stage01,
          summaryLoading: false,
          keywords,
          quotes,
          coreSummary:
            typeof d.summary === 'string' && d.summary.trim()
              ? d.summary.trim()
              : state.stage01.coreSummary,
        },
      }
    }

    case 's1/summaryFail':
      return { ...state, stage01: { ...state.stage01, summaryLoading: false } }

    // 用户主动收尾（AI 判断够了或用户想结束）
    case 's1/setEnough':
      return { ...state, stage01: { ...state.stage01, enough: Boolean(action.payload) } }

    case 's1/reset':
      return { ...state, stage01: INITIAL_STATE.stage01 }

    // ---- 阶段 02 ----
    case 's2/toggleEmotion':
      return {
        ...state,
        stage02: {
          ...state.stage02,
          emotions: state.stage02.emotions.map((e) =>
            e.id === action.payload ? { ...e, selected: !e.selected } : e,
          ),
        },
      }

    case 's2/setCoreNeed':
      return {
        ...state,
        stage02: { ...state.stage02, coreNeed: action.payload },
      }

    case 's2/condenseNeed':
      return {
        ...state,
        stage02: { ...state.stage02, needCondensed: true },
      }

    case 's2/editFact':
      return {
        ...state,
        stage02: {
          ...state.stage02,
          facts: state.stage02.facts.map((f) =>
            f.id === action.payload.id ? { ...f, text: action.payload.text } : f,
          ),
        },
      }

    case 's2/setAddingFact':
      return {
        ...state,
        stage02: {
          ...state.stage02,
          addingFact: action.payload.open,
          newFactDraft: action.payload.open ? state.stage02.newFactDraft : '',
        },
      }

    case 's2/setNewFactDraft':
      return {
        ...state,
        stage02: { ...state.stage02, newFactDraft: action.payload },
      }

    case 's2/addFact': {
      const text = action.payload.trim()
      if (!text) return state
      return {
        ...state,
        stage02: {
          ...state.stage02,
          facts: [...state.stage02.facts, { id: `f_${Date.now()}`, text }],
          newFactDraft: '',
          addingFact: false,
        },
      }
    }

    case 's2/toggleInterpExpand':
      return {
        ...state,
        stage02: {
          ...state.stage02,
          interpretations: state.stage02.interpretations.map((i) =>
            i.id === action.payload ? { ...i, expanded: !i.expanded } : i,
          ),
        },
      }

    case 's2/toggleShelve':
      return {
        ...state,
        stage02: {
          ...state.stage02,
          interpretations: state.stage02.interpretations.map((i) =>
            i.id === action.payload
              ? { ...i, shelved: !i.shelved, expanded: !i.shelved ? false : i.expanded }
              : i,
          ),
        },
      }

    case 's2/toggleAltEditor':
      return {
        ...state,
        stage02: {
          ...state.stage02,
          altEditorOpen: state.stage02.altEditorOpen.includes(action.payload)
            ? state.stage02.altEditorOpen.filter((x) => x !== action.payload)
            : [...state.stage02.altEditorOpen, action.payload],
        },
      }

    case 's2/addAlternative':
      return {
        ...state,
        stage02: {
          ...state.stage02,
          interpretations: state.stage02.interpretations.map((i) =>
            i.id === action.payload.id && !i.alternatives.includes(action.payload.text)
              ? { ...i, alternatives: [...i.alternatives, action.payload.text] }
              : i,
          ),
        },
      }

    // ---- 阶段 02：AI 生成 ----
    case 's2/aiStart':
      return {
        ...state,
        stage02: { ...state.stage02, aiStatus: 'loading', aiError: '' },
      }

    // AI 成功：用生成结果整体替换事实、判断、情绪、真实需求
    // 用户的编辑（needCondensed）被重置，因为内容是全新的
    case 's2/aiSuccess': {
      const d = action.payload || {}
      const facts = (Array.isArray(d.facts) ? d.facts : [])
        .filter((t) => typeof t === 'string' && t.trim())
        .map((text, i) => ({ id: `ai_f${i}`, text: text.trim() }))

      const interpretations = (Array.isArray(d.interpretations) ? d.interpretations : [])
        .filter((x) => x && typeof x.statement === 'string' && x.statement.trim())
        .map((x, i) => ({
          id: `ai_i${i}`,
          statement: x.statement.trim(),
          filterTag: typeof x.filterTag === 'string' && x.filterTag.trim() ? x.filterTag.trim() : '解读',
          aiPrompt: typeof x.aiPrompt === 'string' ? x.aiPrompt.trim() : '',
          expanded: i === 0, // 默认展开第一条，与原型的视觉节奏一致
          shelved: false,
          alternatives: [],
          quickSuggestions: Array.isArray(x.quickSuggestions)
            ? x.quickSuggestions.filter((s) => typeof s === 'string' && s.trim())
            : [],
        }))

      // 情绪：AI 返回的是名称数组，需要映射成带颜色的胶囊。
      // 优先复用已有预设（保持原配色），新出现的情绪按调色板补充。
      const names = (Array.isArray(d.emotions) ? d.emotions : [])
        .filter((n) => typeof n === 'string' && n.trim())
        .map((n) => n.trim())
      const emotions =
        names.length > 0 ? buildEmotionsFromNames(names, state.stage02.emotions) : state.stage02.emotions

      return {
        ...state,
        stage02: {
          ...state.stage02,
          facts: facts.length > 0 ? facts : state.stage02.facts,
          interpretations: interpretations.length > 0 ? interpretations : state.stage02.interpretations,
          emotions,
          coreNeed:
            typeof d.coreNeed === 'string' && d.coreNeed.trim()
              ? d.coreNeed.trim()
              : state.stage02.coreNeed,
          needCondensed: false,
          aiStatus: 'ai',
          aiSourceSignature: stage01Signature(state.stage01),
          aiError: '',
          aiGeneratedAt: Date.now(),
        },
      }
    }

    // AI 失败：保留原有内容（模板），标记为降级
    case 's2/aiFail':
      return {
        ...state,
        stage02: {
          ...state.stage02,
          aiStatus: 'template',
          aiError: action.payload || 'AI 暂时不可用',
        },
      }

    // ---- 阶段 03：角色互换纯对话 ----
    case 's3/setDraft':
      return { ...state, stage03: { ...state.stage03, draft: action.payload } }

    case 's3/toggleInsight':
      return {
        ...state,
        stage03: {
          ...state.stage03,
          insights: state.stage03.insights.includes(action.payload)
            ? state.stage03.insights.filter((x) => x !== action.payload)
            : [...state.stage03.insights, action.payload],
        },
      }

    case 's3/setNote':
      return { ...state, stage03: { ...state.stage03, note: action.payload } }

    // 用户以「朋友（她）」的身份回应了当前这一轮
    // payload: { text, key }    key = 用户点选的情绪角度关键词，自由输入时为「自由输入」
    case 's3/answer': {
      const cur = state.stage03.current
      if (!cur) return state
      const text = typeof action.payload?.text === 'string' ? action.payload.text.trim() : ''
      if (!text) return state

      const answered = {
        ...cur,
        reply: text,
        replyKey: action.payload?.key || '自由输入',
      }

      const done = state.stage03.done || !!cur.done

      return {
        ...state,
        stage03: {
          ...state.stage03,
          rounds: [...state.stage03.rounds, answered],
          current: null, // 等下一轮生成
          draft: '',
          done,
          // 离开这一轮 → 它的预取分支作废，避免下一轮的 key 撞上旧分支
          branches: {},
          branchLoading: false,
          // 本轮已被标记为最后一轮 → 把觉察卡内容搬到根上，避免随 current 一起丢弃
          insightHint: done ? cur.insightHint || state.stage03.insightHint : state.stage03.insightHint,
          insightItems:
            done && cur.insightItems && cur.insightItems.length
              ? cur.insightItems
              : state.stage03.insightItems,
        },
      }
    }

    // 后台预取开始：只标记状态，不阻塞任何界面
    case 's3/branchStart':
      return { ...state, stage03: { ...state.stage03, branchLoading: true } }

    // 后台预取成功：把 4 条分支存起来，用户点草稿时直接取用
    // payload: { branches: [{ key, chat, question, options, done, insightHint, insights }] }
    case 's3/branchSuccess': {
      const list = action.payload?.branches
      if (!Array.isArray(list) || list.length === 0) {
        return { ...state, stage03: { ...state.stage03, branchLoading: false } }
      }

      const map = {}
      list.forEach((b) => {
        if (!b || typeof b.key !== 'string' || !b.key.trim()) return
        const chat = normalizeChat(b.chat)
        const options = normalizeOptions(b.options)
        const question = typeof b.question === 'string' ? b.question.trim() : ''
        // 不完整的分支直接丢弃，点它时退回真实请求
        if (chat.length === 0 || !question || options.length < 2) return
        const key = b.key.trim()
        map[key] = {
          chat,
          question,
          options,
          done: b.done === true,
          insightHint: normalizeInsightHint(b.insightHint),
          insightItems: normalizeInsights(b.insights),
        }
      })

      return {
        ...state,
        stage03: { ...state.stage03, branches: map, branchLoading: false },
      }
    }

    // 后台预取失败：不打扰用户，点草稿时退回真实请求
    case 's3/branchFail':
      return { ...state, stage03: { ...state.stage03, branchLoading: false } }

    // 用户点选了某个情绪角度草稿：若能命中预取分支，直接推进（零等待）
    // payload: { text, key }
    //   命中 → 本轮落答并立刻把预取的那一轮设为 current
    //   未命中 → 返回 state，由调用方走真实请求（s3/answer）
    case 's3/answerFromBranch': {
      const cur = state.stage03.current
      if (!cur) return state
      const text = typeof action.payload?.text === 'string' ? action.payload.text.trim() : ''
      const key = action.payload?.key || ''
      if (!text) return state

      const branch = key ? state.stage03.branches?.[key] : null
      if (!branch) return state

      const answered = { ...cur, reply: text, replyKey: key }
      const rounds = [...state.stage03.rounds, answered]
      // 与 s3/answer 一致：收尾判定看「刚答完的这一轮」是否被标记为最后一轮
      const done = state.stage03.done || !!cur.done
      // 预取分支的下限保护：第 5 轮强制收尾
      const nextDone = branch.done === true || rounds.length >= 4
      const nextCurrent = {
        chat: branch.chat,
        question: branch.question,
        options: branch.options,
        done: nextDone,
        insightHint: nextDone ? branch.insightHint : '',
        insightItems: nextDone ? branch.insightItems : [],
      }

      return {
        ...state,
        stage03: {
          ...state.stage03,
          rounds,
          current: nextCurrent,
          draft: '',
          done,
          branches: {}, // 进入新一轮，旧分支作废
          branchLoading: false,
          // 刚答完的这一轮若是收尾轮，把它的觉察卡内容搬到根上
          insightHint: done ? cur.insightHint || state.stage03.insightHint : state.stage03.insightHint,
          insightItems:
            done && cur.insightItems && cur.insightItems.length
              ? cur.insightItems
              : state.stage03.insightItems,
        },
      }
    }

    // AI 生成一轮成功
    // payload: { chat[], question, options:{A,B}, done, fallback?, sticky? }
    //   fallback = true 表示这一轮用的是本地兜底对话
    //   sticky   = true 表示「本阶段已降级」，后续轮次不再请求网络
    //              （「还没记录任何片段」这种临时情况传 sticky: false）
    case 's3/aiSuccess': {
      const chat = normalizeChat(action.payload?.chat)
      const options = normalizeOptions(action.payload?.options)
      const question = typeof action.payload?.question === 'string' ? action.payload.question.trim() : ''
      const insightHint = normalizeInsightHint(action.payload?.insightHint)
      const insights = normalizeInsights(action.payload?.insights)
      const isFallback = action.payload?.fallback === true
      const sticky = action.payload?.sticky !== false

      // 必须至少有对话 + 一句提问 + 两个可选草稿，否则视为生成失败
      if (chat.length === 0 || !question || options.length < 2) {
        return {
          ...state,
          stage03: { ...state.stage03, aiStatus: 'template', aiError: '生成内容不完整' },
        }
      }

      const done = action.payload?.done === true || state.stage03.rounds.length >= 4

      return {
        ...state,
        stage03: {
          ...state.stage03,
          current: {
            chat,
            question,
            options,
            // 硬上限兜底：模型偶尔会一直说 false，第 5 轮强制收尾
            done,
            // 收尾轮才带觉察卡内容；模型没给就留空，由页面回落兜底文案
            insightHint: done ? insightHint : '',
            insightItems: done ? insights : [],
          },
          // 收尾轮的觉察卡内容同时写到根上：这一轮不会再被回答，
          // 只依赖 s3/answer 搬运会丢掉 AI 生成的引导语与觉察项
          insightHint: done ? insightHint || state.stage03.insightHint : state.stage03.insightHint,
          insightItems: done && insights.length ? insights : state.stage03.insightItems,
          // 新一轮出现 → 上一轮预取的分支作废，等后台重新算
          branches: {},
          branchLoading: false,
          aiStatus: isFallback ? 'template' : 'ai',
          aiError: isFallback ? action.payload?.error || 'AI 暂时不可用' : '',
          useFallback: isFallback && sticky ? true : state.stage03.useFallback,
          aiSourceSignature: stage01Signature(state.stage01),
        },
      }
    }

    case 's3/aiStart':
      return { ...state, stage03: { ...state.stage03, aiStatus: 'loading', aiError: '' } }

    case 's3/aiFail':
      return {
        ...state,
        stage03: {
          ...state.stage03,
          aiStatus: 'template',
          aiError: action.payload || 'AI 暂时不可用',
          useFallback: true,
        },
      }

    // 重置推演：清空已完成的轮次与觉察，并回到「尝试真实 AI」
    case 's3/reset':
      return {
        ...state,
        stage03: {
          ...state.stage03,
          rounds: [],
          current: null,
          draft: '',
          insights: [],
          insightHint: '',
          insightItems: [],
          branches: {},
          branchLoading: false,
          note: '',
          done: false,
          useFallback: false,
          aiStatus: 'idle',
          aiError: '',
        },
      }

    // ---- 阶段 04 ----
    // 选中我的视角气泡：同步 contextKey 与对应的「未知」项（原型 selectS4Self）
    // ---- 阶段 04 ----
    // 读取当前生效的数据源（AI 优先，其次模板）
    case 's4/selectSelf': {
      const list = state.stage04.selfBubbles || S4_SELF_BUBBLES
      const unknowns = state.stage04.unknowns || S4_UNKNOWNS
      const found = list.find((b) => b.id === action.payload)
      if (!found) return state
      const matched = unknowns.find((u) => u.contextKey === found.contextKey)
      return {
        ...state,
        stage04: {
          ...state.stage04,
          activeSelfId: found.id,
          activeContextKey: found.contextKey,
          activeUnknownId: matched ? matched.id : state.stage04.activeUnknownId,
        },
      }
    }

    case 's4/selectOther': {
      const list = state.stage04.otherBubbles || S4_OTHER_BUBBLES
      const unknowns = state.stage04.unknowns || S4_UNKNOWNS
      const found = list.find((b) => b.id === action.payload)
      if (!found) return state
      const matched = unknowns.find((u) => u.contextKey === found.contextKey)
      return {
        ...state,
        stage04: {
          ...state.stage04,
          activeOtherId: found.id,
          activeContextKey: found.contextKey,
          activeUnknownId: matched ? matched.id : state.stage04.activeUnknownId,
        },
      }
    }

    case 's4/selectUnknown': {
      const unknowns = state.stage04.unknowns || S4_UNKNOWNS
      const found = unknowns.find((u) => u.id === action.payload)
      if (!found) return state
      return {
        ...state,
        stage04: {
          ...state.stage04,
          activeUnknownId: found.id,
          activeContextKey: found.contextKey,
        },
      }
    }

    case 's4/toggleDrawer':
      return { ...state, stage04: { ...state.stage04, drawerOpen: !state.stage04.drawerOpen } }

    // ---- 阶段 04：AI 生成 ----
    case 's4/aiStart':
      return { ...state, stage04: { ...state.stage04, aiStatus: 'loading', aiError: '' } }

    case 's4/aiSuccess': {
      const d = action.payload || {}
      const normBubble = (arr, prefix) =>
        (Array.isArray(arr) ? arr : [])
          .filter((b) => b && typeof b.label === 'string' && b.label.trim())
          .slice(0, 3)
          .map((b, i) => ({
            id: `${prefix}${i + 1}`,
            label: b.label.trim(),
            headline: typeof b.headline === 'string' ? b.headline.trim() : '',
            contextKey: typeof b.contextKey === 'string' && b.contextKey.trim() ? b.contextKey.trim() : `k${i + 1}`,
          }))

      const normUnknown = (arr) =>
        (Array.isArray(arr) ? arr : [])
          .filter((u) => u && typeof u.pillLabel === 'string' && u.pillLabel.trim())
          .slice(0, 3)
          .map((u, i) => ({
            id: `u${i + 1}`,
            contextKey: typeof u.contextKey === 'string' && u.contextKey.trim() ? u.contextKey.trim() : `k${i + 1}`,
            pillLabel: u.pillLabel.trim(),
            selfRead: typeof u.selfRead === 'string' ? u.selfRead.trim() : '',
            otherRead: typeof u.otherRead === 'string' ? u.otherRead.trim() : '',
            detailDesc: typeof u.detailDesc === 'string' ? u.detailDesc.trim() : '',
          }))

      const selfBubbles = normBubble(d.selfBubbles, 'sb')
      const otherBubbles = normBubble(d.otherBubbles, 'ob')
      const unknowns = normUnknown(d.unknowns)

      if (selfBubbles.length < 2 || otherBubbles.length < 2 || unknowns.length < 2) {
        return { ...state, stage04: { ...state.stage04, aiStatus: 'template', aiError: '生成内容不完整' } }
      }

      return {
        ...state,
        stage04: {
          ...state.stage04,
          selfBubbles,
          otherBubbles,
          unknowns,
          // 重置选中项到第一个，避免 id 对不上
          activeSelfId: selfBubbles[0].id,
          activeOtherId: otherBubbles[0].id,
          activeUnknownId: unknowns[0].id,
          activeContextKey: unknowns[0].contextKey,
          aiStatus: 'ai',
          aiSourceSignature: stage01Signature(state.stage01),
          aiError: '',
        },
      }
    }

    case 's4/aiFail':
      return { ...state, stage04: { ...state.stage04, aiStatus: 'template', aiError: action.payload || 'AI 暂时不可用' } }

    // 阶段 05 取草稿：优先用该方向「当前正在用的文字」（含用户手改），
// 其次用该方向的 AI 原始版本，最后回落到该方向的兜底文案
function draftFor(stage05, intent, tone) {
  const t = tone || stage05.tone
  const current = stage05.draftsByIntent?.[intent]?.[t]
  if (typeof current === 'string' && current.trim()) return current
  const ai = stage05.aiDraftsByIntent?.[intent]?.[t]
  if (typeof ai === 'string' && ai.trim()) return ai
  return s5TemplateDraft(intent, t)
}

// ---- 阶段 05 ----
    case 's5/selectIntent': {
      const intent = action.payload
      const isDraftType = intent === 'express' || intent === 'explain'
      const st = state.stage05

      return {
        ...state,
        stage05: {
          ...st,
          intent,
          // 切方向：直接取该方向已缓存的草稿（含手改），不请求 AI
          draft: isDraftType ? draftFor(st, intent) : st.draft,
          // 第 5 条反思文案随意愿变化
          reflections: { ...st.reflections, step5: S5_STEP5_BY_INTENT[intent] || S5_STEP5_BY_INTENT.express },
        },
      }
    }

    case 's5/switchTone': {
      const st = state.stage05
      const nextTone = action.payload
      return {
        ...state,
        stage05: {
          ...st,
          tone: nextTone,
          // 同一方向内换语气：取该方向该语气的缓存，没有才用兜底
          draft: draftFor(st, st.intent, nextTone),
        },
      }
    }

    case 's5/setDraft': {
      // 用户手改：同时写进「该方向当前正在用的文字」，切走再切回时原样还原
      const st = state.stage05
      const intent = st.intent
      return {
        ...state,
        stage05: {
          ...st,
          draft: action.payload,
          draftsByIntent: {
            ...st.draftsByIntent,
            [intent]: { ...(st.draftsByIntent?.[intent] || {}), [st.tone]: action.payload },
          },
        },
      }
    }

    case 's5/setReflection':
      return {
        ...state,
        stage05: {
          ...state.stage05,
          reflections: { ...state.stage05.reflections, [action.payload.key]: action.payload.text },
        },
      }

    case 's5/toggleSheet':
      return { ...state, stage05: { ...state.stage05, sheetOpen: !state.stage05.sheetOpen } }

    // 进入阶段 05 时把阶段 02 的真实需求同步为第 1 条反思
    // （原型 syncCrossStageData 在 navigateToStage 到 3/4 时执行）
    case 's5/syncCare':
      return {
        ...state,
        stage05: {
          ...state.stage05,
          reflections: { ...state.stage05.reflections, care: action.payload },
        },
      }

    // ---- 阶段 05：AI 生成 ----
    case 's5/aiStart':
      return { ...state, stage05: { ...state.stage05, aiStatus: 'loading', aiError: '' } }

    case 's5/aiSuccess': {
      const d = action.payload || {}
      const drafts = d.drafts || {}
      const valid =
        typeof drafts.gentle === 'string' &&
        drafts.gentle.trim() &&
        typeof drafts.brief === 'string' &&
        typeof drafts.nopressure === 'string'

      const st = state.stage05
      const intent = st.intent

      if (!valid) {
        return {
          ...state,
          stage05: {
            ...st,
            aiStatus: 'template',
            aiError: '生成内容不完整',
            aiTriedIntent: { ...st.aiTriedIntent, [intent]: true },
          },
        }
      }

      const r = d.reflections || {}
      const pick = (k, fallback) => (typeof r[k] === 'string' && r[k].trim() ? r[k].trim() : fallback)
      const prev = st.reflections

      const aiDrafts = {
        gentle: drafts.gentle.trim(),
        brief: drafts.brief.trim(),
        nopressure: drafts.nopressure.trim(),
      }

      // 结果只写进「发起请求时所在的方向」，另一个方向的缓存原样保留
      const nextDraftsByIntent = { ...st.draftsByIntent, [intent]: { ...aiDrafts } }

      return {
        ...state,
        stage05: {
          ...st,
          aiDraftsByIntent: { ...st.aiDraftsByIntent, [intent]: aiDrafts },
          draftsByIntent: nextDraftsByIntent,
          // 当前正在看的方向就是发起方 → 立即换成 AI 版本
          draft: intent === st.intent ? nextDraftsByIntent[intent][st.tone] || aiDrafts.gentle : st.draft,
          reflections: {
            // 第 1 条保留用户的真实需求（跨阶段同步优先级更高）
            care: prev.care,
            past: pick('past', prev.past),
            newPossibility: pick('newPossibility', prev.newPossibility),
            uncertain: pick('uncertain', prev.uncertain),
            step5: pick('step5', prev.step5),
          },
          aiStatus: 'ai',
          aiTriedIntent: { ...st.aiTriedIntent, [intent]: true },
          aiSourceSignature: stage01Signature(state.stage01),
          aiError: '',
        },
      }
    }

    case 's5/aiFail':
      // 降级：该方向标记为「已试过」，草稿用该方向的兜底文案。
      // 写 aiSourceSignature 很关键 —— 否则 hook 会因 contentChanged 一直为真而无限重试，
      // aiStatus 会永远停在 loading（2026-11-16 实测踩到过）。
      return {
        ...state,
        stage05: {
          ...state.stage05,
          aiStatus: 'template',
          aiError: action.payload || 'AI 暂时不可用',
          aiTriedIntent: { ...state.stage05.aiTriedIntent, [state.stage05.intent]: true },
          aiSourceSignature: stage01Signature(state.stage01),
          draft: s5TemplateDraft(state.stage05.intent, state.stage05.tone),
        },
      }

    // 「没有材料」导致的降级：清掉签名，等用户补上记录后重新尝试
    case 's5/clearIntentSignature':
      return { ...state, stage05: { ...state.stage05, aiTriedIntent: {} } }

    // 「重新生成」只作用于当前方向：清掉这个方向的缓存与标记，另一方向不受影响
    case 's5/clearCurrentIntentCache': {
      const st = state.stage05
      const intent = st.intent
      const nextTried = { ...st.aiTriedIntent }
      delete nextTried[intent]
      const nextAi = { ...st.aiDraftsByIntent }
      delete nextAi[intent]
      const nextDrafts = { ...st.draftsByIntent }
      delete nextDrafts[intent]
      return {
        ...state,
        stage05: {
          ...st,
          aiTriedIntent: nextTried,
          aiDraftsByIntent: nextAi,
          draftsByIntent: nextDrafts,
          draft: s5TemplateDraft(intent, st.tone),
          aiStatus: 'idle',
          aiError: '',
        },
      }
    }

    // ---- 静观 ----
    case 'sp/toggleOpen':
      return { ...state, stillpoint: { ...state.stillpoint, open: !state.stillpoint.open } }

    case 'sp/setOpen':
      return { ...state, stillpoint: { ...state.stillpoint, open: action.payload } }

    // 从别处带上下文打开静观：预填这条内容到输入框
    case 'sp/openWithSeed':
      return {
        ...state,
        stillpoint: {
          ...state.stillpoint,
          open: true,
          seed: action.payload,
          draft: action.payload?.text || '',
        },
      }

    case 'sp/clearSeed':
      return { ...state, stillpoint: { ...state.stillpoint, seed: null } }

    // 重新初始化对话（原型 initStillpointConversation）：清空消息与追问，写入开场白
    case 'sp/init':
      return {
        ...state,
        stillpoint: {
          ...state.stillpoint,
          messages: [{ role: 'ai', paragraphs: action.payload.opening }],
          questions: action.payload.questions,
          contextSignature: action.payload.signature,
          draft: '',
        },
      }

    case 'sp/addUserMessage':
      return {
        ...state,
        stillpoint: {
          ...state.stillpoint,
          messages: [...state.stillpoint.messages, { role: 'user', paragraphs: [action.payload] }],
          draft: '',
        },
      }

    case 'sp/addAiMessage':
      return {
        ...state,
        stillpoint: {
          ...state.stillpoint,
          messages: [...state.stillpoint.messages, { role: 'ai', paragraphs: action.payload.reply }],
          questions: action.payload.questions ?? state.stillpoint.questions,
        },
      }

    case 'sp/setQuestions':
      return { ...state, stillpoint: { ...state.stillpoint, questions: action.payload } }

    case 'sp/setDraft':
      return { ...state, stillpoint: { ...state.stillpoint, draft: action.payload } }

    case 'sp/bumpReroll':
      return { ...state, stillpoint: { ...state.stillpoint, rerollIndex: state.stillpoint.rerollIndex + 1 } }

    case 'state/replace':
      return action.payload

    default:
      return state
  }
}
