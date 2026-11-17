// ============================================================
// 任务分发与业务逻辑（运行时无关）
//
// Node 服务（server/index.mjs）与 Cloudflare Pages Functions
// （functions/api/[[path]].js）共用这里的实现，
// 保证两边行为一致，不会各写一套导致线上与本地不一样。
//
// 这里只用纯 JS：不碰 http 对象、不碰文件系统。
// 输入是「请求体」，输出是「状态码 + JSON / SSE 文本流」。
// ============================================================
import { AIError, chatJSON, chatStream } from './deepseek.mjs'
import {
  buildAnalyzePrompt,
  buildComparePrompt,
  buildDraftPrompt,
  buildExploreBranchPrompt,
  buildExplorePrompt,
  buildProbeBranchPrompt,
  buildProbePrompt,
  buildStillpointPrompt,
  buildSummarizePrompt,
} from './prompts.mjs'

export const PROMPT_BUILDERS = {
  analyze: buildAnalyzePrompt,
  explore: buildExplorePrompt,
  exploreBranch: buildExploreBranchPrompt,
  compare: buildComparePrompt,
  draft: buildDraftPrompt,
  probe: buildProbePrompt,
  probeBranch: buildProbeBranchPrompt,
  summarize: buildSummarizePrompt,
}

const MAX_TOKENS = {
  analyze: 2200,
  explore: 3000,
  exploreBranch: 4000,
  compare: 2400,
  draft: 2600,
  probe: 600,
  probeBranch: 1200,
  summarize: 700,
}

// 每个任务的采样温度：需要发散的高一点，需要稳定的低一点
const TEMPERATURE = {
  analyze: 0.6,
  explore: 0.8,
  exploreBranch: 0.85,
  compare: 0.7,
  draft: 0.8,
  probe: 0.85,
  probeBranch: 0.85,
  summarize: 0.4,
}

export function errorPayload(err) {
  const code = err instanceof AIError ? err.code : 'unknown'
  const message = err?.message || '服务异常'
  // 不透传上游原始响应，避免泄漏细节
  return { ok: false, code, message }
}

/**
 * /api/generate 的业务实现
 * @param {object} params
 * @param {object} params.config
 * @param {object} params.body    已解析的请求体
 * @returns {Promise<{status:number, json:object}>}
 */
export async function runGenerate({ config, body }) {
  const { task, context = {} } = body || {}
  const builder = PROMPT_BUILDERS[task]
  if (!builder) {
    // 无效任务不占限流额度，也不调用模型
    return { status: 400, json: { ok: false, code: 'bad_request', message: `未知任务：${task}` } }
  }

  try {
    const { system, user } = builder(context)
    const result = await chatJSON({
      config,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      maxTokens: MAX_TOKENS[task] || 2000,
      temperature: TEMPERATURE[task] ?? 0.7,
    })
    return { status: 200, json: { ok: true, task, data: result } }
  } catch (err) {
    console.error(`[generate:${task}]`, err.code || '', err.message)
    // 200 + ok:false，让前端走降级
    return { status: 200, json: errorPayload(err) }
  }
}

/**
 * /api/stillpoint/opening 的业务实现
 * @returns {Promise<{status:number, json:object}>}
 */
export async function runStillpointOpening({ config, body }) {
  const context = body?.context || {}

  try {
    // 由前端明确指定 mode：opening（开场+追问）或 questions（只出追问）
    const mode = context.mode === 'questions' ? 'questions' : 'opening'
    const { system, user } = buildStillpointPrompt({ ...context, mode, userText: '' })
    const data = await chatJSON({
      config,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      maxTokens: 900,
      temperature: 0.85,
    })

    const opening = Array.isArray(data.opening)
      ? data.opening.filter((p) => typeof p === 'string' && p.trim())
      : []
    const questions = Array.isArray(data.questions)
      ? data.questions.filter((q) => typeof q === 'string' && q.trim()).slice(0, 3)
      : []

    if (mode === 'questions') {
      // 只出追问：空数组也算失败，让前端回落到通用池
      if (questions.length === 0) {
        return { status: 200, json: { ok: false, code: 'bad_response', message: '追问生成失败' } }
      }
      return { status: 200, json: { ok: true, data: { opening: [], questions } } }
    }

    if (opening.length === 0) {
      return { status: 200, json: { ok: false, code: 'bad_response', message: '开场白生成失败' } }
    }

    return { status: 200, json: { ok: true, data: { opening, questions } } }
  } catch (err) {
    console.error('[stillpoint-opening]', err.code || '', err.message)
    return { status: 200, json: errorPayload(err) }
  }
}

/**
 * /api/stillpoint 的业务实现（SSE 流）
 * 调用方负责把每个 chunk 写出去。
 * @param {object} params
 * @param {object} params.config
 * @param {object} params.body
 * @returns {AsyncGenerator<string>} 逐段 SSE 文本（`data: {...}\n\n`）
 */
export async function* runStillpointStream({ config, body }) {
  const context = body?.context || {}

  const sendEvent = (obj) => `data: ${JSON.stringify(obj)}\n\n`

  try {
    const { system, user } = buildStillpointPrompt(context)
    let full = ''
    for await (const delta of chatStream({
      config,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      maxTokens: 800,
      temperature: 0.85,
    })) {
      full += delta
      yield sendEvent({ type: 'delta', text: delta })
    }
    yield sendEvent({ type: 'done', text: full })
  } catch (err) {
    console.error('[stillpoint]', err.code || '', err.message)
    yield sendEvent({ type: 'error', ...errorPayload(err) })
  }
}

/**
 * 解析请求体，带大小上限
 * @param {string} text
 * @returns {object}
 */
export function parseBody(text, limitBytes = 512 * 1024) {
  if (!text) return {}
  // 粗略估算字节数：ASCII 按 1，其余按 3（中文实际接近 3）
  let size = 0
  for (let i = 0; i < text.length; i += 1) {
    size += text.charCodeAt(i) > 127 ? 3 : 1
    if (size > limitBytes) throw new AIError('bad_request', '请求内容过大')
  }
  try {
    return JSON.parse(text)
  } catch {
    throw new AIError('bad_request', '请求体不是合法 JSON')
  }
}
