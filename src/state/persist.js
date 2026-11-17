// ============================================================
// 本地存档：localStorage 读写
// - 带 version，结构变化时丢弃旧档而不是报错
// - 读取失败一律回落到初始状态，不白屏
// ============================================================
import { INITIAL_STATE } from './store.js'

const KEY = 'between-us:state'
// v3：阶段 01 改为 AI 动态问答（qa + chips 预生成分支），
//     阶段 03 区分 speech/action，各阶段增加 aiSourceSignature。
// v4：阶段 03 改为角色互换纯对话（rounds + current），旧结构（stream/turn）
//     无法兼容，版本不匹配时直接丢弃旧档，避免用旧结构渲染出「看起来没更新」的界面。
// v5：阶段 03 的 options 由 { A, B } 改为四情绪角度 [{ key, text }]，
//     replyIntent → replyKey；新增 insightHint / insightItems（AI 生成的觉察卡内容）。
//     读档时把旧结构自动升上来，用户已有的对话记录不丢。
// v6：阶段 05 草稿由「一组 aiDrafts + aiIntentSignature」
//     改为「按方向分开缓存 aiDraftsByIntent / draftsByIntent / aiTriedIntent」，
//     来回切方向不再重复生成。v5 旧档自动迁移。
const VERSION = 6
// 可从这些旧版本迁移上来
const MIGRATABLE_FROM = [4, 5]

function upgradeStage03Options(options) {
  if (Array.isArray(options)) return options
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

function upgradeStage03Round(round) {
  if (!round || typeof round !== 'object') return round
  const { replyIntent, ...rest } = round
  return {
    ...rest,
    options: upgradeStage03Options(round.options),
    replyKey: round.replyKey || replyIntent || '',
  }
}

// v4 → v5：旧档的 { A, B } 与 replyIntent 升级到新结构
function migrateStage03(stage03) {
  const s = stage03 || {}
  return {
    ...s,
    rounds: Array.isArray(s.rounds) ? s.rounds.map(upgradeStage03Round) : [],
    current: s.current ? upgradeStage03Round(s.current) : null,
    insightHint: typeof s.insightHint === 'string' ? s.insightHint : '',
    insightItems: Array.isArray(s.insightItems) ? s.insightItems : [],
  }
}

// v5 → v6：阶段 05 草稿由「一组 aiDrafts + aiIntentSignature」
// 改为「按方向分开缓存的 aiDraftsByIntent / draftsByIntent / aiTriedIntent」。
// 旧档里那组草稿只能归到它当时对应的方向，另一个方向留空，首次切过去会自动生成一次。
function migrateStage05Drafts(stage05) {
  const s = stage05 || {}
  // 已经是新结构
  if (s.aiDraftsByIntent && typeof s.aiDraftsByIntent === 'object') return {}

  const oldDrafts = s.aiDrafts
  const oldIntent = typeof s.aiIntentSignature === 'string' ? s.aiIntentSignature : ''
  if (!oldDrafts || !oldIntent) return {}

  return {
    aiDraftsByIntent: { [oldIntent]: { ...oldDrafts } },
    draftsByIntent: { [oldIntent]: { ...oldDrafts } },
    aiTriedIntent: { [oldIntent]: true },
  }
}

// 读取存档时把所有「进行中」标记复位为 false。
//
// 为什么必须做：
//   这些字段表示「有一个请求正在飞」，是会话态，而不是用户数据。
//   如果用户在请求途中刷新/关页/断网，loading 会以 true 被写进存档。
//   下次打开时，各阶段的「首次请求」触发条件都带 !loading 守卫，
//   于是永远不发请求；而 loading 又没有任何路径会自己变回 false，
//   error 也是空的，界面就永久停在「正在准备…」，刷新也救不回来。
//   （2026-11-17 线上复现：qa=0、loading=true、error=''、零请求）
function resetTransientFlags(state) {
  const s = state || {}
  return {
    ...s,
    stage01: {
      ...(s.stage01 || {}),
      loading: false,
      branchLoading: false,
      summaryLoading: false,
    },
    stage02: { ...(s.stage02 || {}), aiStatus: resetAiStatus(s.stage02) },
    stage03: { ...(s.stage03 || {}), aiStatus: resetAiStatus(s.stage03) },
    stage04: { ...(s.stage04 || {}), aiStatus: resetAiStatus(s.stage04) },
    stage05: { ...(s.stage05 || {}), aiStatus: resetAiStatus(s.stage05) },
  }
}

// 只有 loading 需要复位；ai / template / idle 都是完成态，要原样保留，
// 否则每次刷新都会白白重新请求一次模型。
function resetAiStatus(stage) {
  return stage?.aiStatus === 'loading' ? 'idle' : stage?.aiStatus
}

// 旧档（v1）的 fragments 是纯字符串数组，缺少 step 与 id。
// 按顺序推断所属步骤（第 i 条属于第 i+1 题），保证老用户数据不丢。
// 旧档（v1/v2）的 stage01 用 fragments（固定四步），
// 新结构用 qa（AI 动态追问）。这里把旧片段转成问答形式，数据不丢。
function migrateStage01(stage01) {
  const s = stage01 || {}

  // 已经是新结构
  if (Array.isArray(s.qa)) {
    return { ...s, qa: s.qa }
  }

  const STEP_QUESTIONS = {
    1: '最近发生了什么，让你开始重新思考这段友情？',
    2: '当时具体在什么场景下？',
    3: '她说了什么原话，让你印象最深？',
    4: '你当时是怎么回应的？后来关系发生了什么变化？',
  }

  const raw = Array.isArray(s.fragments) ? s.fragments : []
  const qa = raw
    .map((f, i) => {
      const step = f && typeof f === 'object' && f.step ? f.step : Math.min(4, i + 1)
      const text = f && typeof f === 'object' ? f.text : typeof f === 'string' ? f : ''
      if (!text) return null
      return {
        id: `legacy_${i}`,
        question: STEP_QUESTIONS[step] || '当时发生了什么？',
        chips: [],
        answer: text,
        askedAt: 0,
      }
    })
    .filter(Boolean)

  return {
    ...s,
    qa,
    fragments: [],
    factCount: qa.length,
    keywords: s.keywords || [],
    quotes: typeof s.quotes === 'string' ? (s.quotes ? [s.quotes] : []) : s.quotes || [],
    enough: qa.length >= 2,
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { state: INITIAL_STATE, restored: false }
    const parsed = JSON.parse(raw)
    if (!parsed || !parsed.data) {
      return { state: INITIAL_STATE, restored: false, corrupted: true }
    }
      // 版本号只升不降：旧版本存档做迁移而不是丢弃
    const version = parsed.version || 1
    const canMigrate = version === VERSION || MIGRATABLE_FROM.includes(version)
    if (!canMigrate) {
      // 更早的结构已经不兼容（v3 起阶段 01 改为动态问答），
      // 直接丢弃旧档，重新开始，避免旧数据渲染出过期界面
      return { state: INITIAL_STATE, restored: false, corrupted: true }
    }

    // 与初始结构做浅合并，避免旧档缺字段导致崩溃
    const merged = {
      ...INITIAL_STATE,
      ...parsed.data,
      stage01: migrateStage01({ ...INITIAL_STATE.stage01, ...(parsed.data.stage01 || {}) }),
      stage02: { ...INITIAL_STATE.stage02, ...(parsed.data.stage02 || {}) },
      stage03: migrateStage03({ ...INITIAL_STATE.stage03, ...(parsed.data.stage03 || {}) }),
      stage04: { ...INITIAL_STATE.stage04, ...(parsed.data.stage04 || {}) },
      stage05: {
        ...INITIAL_STATE.stage05,
        ...(parsed.data.stage05 || {}),
        // reflections 是嵌套对象，需单独合并，否则旧档缺 key 会丢
        reflections: {
          ...INITIAL_STATE.stage05.reflections,
          ...((parsed.data.stage05 && parsed.data.stage05.reflections) || {}),
        },
        // v5 → v6：草稿改为按方向分开缓存。
        // 旧档只有一组 aiDrafts + aiIntentSignature，把它迁移成当前方向的缓存，
        // 另一个方向留空（首次切过去时会自动生成一次）。
        ...migrateStage05Drafts(parsed.data.stage05 || {}),
      },
      // 静观对话不进存档（属于会话态，刷新后重新开场更符合预期）
      stillpoint: INITIAL_STATE.stillpoint,
    }

    // 最后一步：把所有「请求进行中」标记复位。
    // 这些是会话态而非用户数据，残留会让界面永久卡在加载中。
    return { state: resetTransientFlags(merged), restored: true }
  } catch {
    return { state: INITIAL_STATE, restored: false, corrupted: true }
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: VERSION, savedAt: Date.now(), data: state }))
    return true
  } catch {
    return false
  }
}

export function clearState() {
  try {
    localStorage.removeItem(KEY)
    return true
  } catch {
    return false
  }
}

export function hasSavedState() {
  try {
    return localStorage.getItem(KEY) !== null
  } catch {
    return false
  }
}
