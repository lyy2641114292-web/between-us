// ============================================================
// Between Us 后端服务
// 职责：持有 API 密钥、转发请求、限流、错误归一化
// 不使用 Express，只用 Node 原生 http（只有 3 个端点，无需框架）
// ============================================================
import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve, sep } from 'node:path'

import { config, describeKeyStatus, ROOT } from './config.mjs'
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

// ------------------------------------------------------------
// 简单限流：每个 IP 每分钟最多 N 次，防止密钥被盗刷
//
// 只统计「真正会调用模型」的请求：先校验 task，再计数。
// 之前是在读 body 之前计数，导致拼错参数、预检失败等无效请求也会占额度，
// 用户正常点击时会被这些请求挤掉配额（2026-11-17 实测边界：第 21 次起 429）。
// ------------------------------------------------------------
const RATE_LIMIT = config.rateLimit
const RATE_WINDOW_MS = 60_000
const hits = new Map()

function isRateLimited(ip) {
  const now = Date.now()
  const list = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS)
  const limited = list.length >= RATE_LIMIT
  hits.set(ip, list)
  return limited
}

function recordHit(ip) {
  const now = Date.now()
  const list = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS)
  list.push(now)
  hits.set(ip, list)
  // 顺带清理长期不活跃的 IP，避免 Map 无限增长
  if (hits.size > 500) {
    for (const [key, ts] of hits) {
      if (ts.length === 0 || now - ts[ts.length - 1] > RATE_WINDOW_MS * 5) hits.delete(key)
    }
  }
}

// ------------------------------------------------------------
// 限流
// ------------------------------------------------------------
function realIP(socket, headers) {
  const forwarded = headers['x-forwarded-for']
  if (config.trustProxy && forwarded) {
    // 取最左边一个：原始客户端 IP（由我们信任的代理写入）
    const first = forwarded.split(',')[0].trim()
    if (first) return first
  }
  return socket.remoteAddress || 'unknown'
}

// ------------------------------------------------------------
// 工具
// ------------------------------------------------------------
function sendJSON(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  })
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    let size = 0
    const LIMIT = 512 * 1024 // 512KB，足够容纳全部对话内容
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > LIMIT) {
        reject(new AIError('bad_request', '请求内容过大'))
        req.destroy()
        return
      }
      data += chunk
    })
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {})
      } catch {
        reject(new AIError('bad_request', '请求体不是合法 JSON'))
      }
    })
    req.on('error', reject)
  })
}

function errorPayload(err) {
  const code = err instanceof AIError ? err.code : 'unknown'
  const message = err?.message || '服务异常'
  // 不透传上游原始响应，避免泄漏细节
  return { ok: false, code, message }
}

// ------------------------------------------------------------
// 任务分发
// ------------------------------------------------------------
const PROMPT_BUILDERS = {
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

async function handleGenerate(req, res, ip) {
  let body
  try {
    body = await readBody(req)
  } catch (err) {
    return sendJSON(res, 400, errorPayload(err))
  }

  const { task, context = {} } = body
  const builder = PROMPT_BUILDERS[task]
  if (!builder) {
    // 无效任务不占限流额度，也不调用模型
    return sendJSON(res, 400, { ok: false, code: 'bad_request', message: `未知任务：${task}` })
  }

  // 到这一步才会真正调用模型，此时才计数
  if (isRateLimited(ip)) {
    return sendJSON(res, 429, { ok: false, code: 'rate_limit', message: '请求过于频繁，请稍后再试' })
  }
  recordHit(ip)

  try {
    const { system, user } = builder(context)
    const result = await chatJSON({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      maxTokens: MAX_TOKENS[task] || 2000,
      temperature: TEMPERATURE[task] ?? 0.7,
    })
    return sendJSON(res, 200, { ok: true, task, data: result })
  } catch (err) {
    console.error(`[generate:${task}]`, err.code || '', err.message)
    return sendJSON(res, 200, errorPayload(err)) // 200 + ok:false，让前端走降级
  }
}

async function handleStillpointOpening(req, res, ip) {
  let body
  try {
    body = await readBody(req)
  } catch (err) {
    return sendJSON(res, 400, errorPayload(err))
  }

  if (isRateLimited(ip)) {
    return sendJSON(res, 429, { ok: false, code: 'rate_limit', message: '请求过于频繁，请稍后再试' })
  }
  recordHit(ip)

  const { context = {} } = body

  try {
    // 由前端明确指定 mode：opening（开场+追问）或 questions（只出追问）
    const mode = context.mode === 'questions' ? 'questions' : 'opening'
    const { system, user } = buildStillpointPrompt({ ...context, mode, userText: '' })
    const data = await chatJSON({
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
        return sendJSON(res, 200, { ok: false, code: 'bad_response', message: '追问生成失败' })
      }
      return sendJSON(res, 200, { ok: true, data: { opening: [], questions } })
    }

    if (opening.length === 0) {
      return sendJSON(res, 200, { ok: false, code: 'bad_response', message: '开场白生成失败' })
    }

    return sendJSON(res, 200, { ok: true, data: { opening, questions } })
  } catch (err) {
    console.error('[stillpoint-opening]', err.code || '', err.message)
    return sendJSON(res, 200, errorPayload(err))
  }
}

async function handleStillpoint(req, res, ip) {
  let body
  try {
    body = await readBody(req)
  } catch (err) {
    return sendJSON(res, 400, errorPayload(err))
  }

  if (isRateLimited(ip)) {
    return sendJSON(res, 429, { ok: false, code: 'rate_limit', message: '请求过于频繁，请稍后再试' })
  }
  recordHit(ip)

  const { context = {} } = body

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })

  const sendEvent = (obj) => {
    res.write(`data: ${JSON.stringify(obj)}\n\n`)
  }

  try {
    const { system, user } = buildStillpointPrompt(context)
    let full = ''
    for await (const delta of chatStream({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      maxTokens: 800,
      temperature: 0.85,
    })) {
      full += delta
      sendEvent({ type: 'delta', text: delta })
    }
    sendEvent({ type: 'done', text: full })
  } catch (err) {
    console.error('[stillpoint]', err.code || '', err.message)
    sendEvent({ type: 'error', ...errorPayload(err) })
  } finally {
    res.end()
  }
}

// ------------------------------------------------------------
// 静态文件托管（可选）
// dist/ 存在时，后端顺带把前端页面也发出去，这样部署只需一个地址、一个进程。
// 不存在时（还没 npm run build）只提供 API，不影响开发期使用。
// ------------------------------------------------------------
const DIST_DIR = resolve(ROOT, 'dist')
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

/**
 * 尝试把 dist/ 里的文件发出去。
 * @returns {boolean} 是否已经处理（false 表示调用方继续走 404）
 */
function serveStatic(pathname, res) {
  if (!existsSync(DIST_DIR)) return false

  // 防目录穿越：解码 → 规范化 → 必须仍在 dist/ 内
  let decoded
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return false
  }
  const rel = normalize(decoded).replace(/^([/\\])+/, '')
  const target = resolve(DIST_DIR, rel)
  if (target !== DIST_DIR && !target.startsWith(DIST_DIR + sep)) return false

  // 目录或不存在 → 回落到 index.html（单页应用路由）
  const isFile = existsSync(target) && statSync(target).isFile()
  const file = isFile ? target : join(DIST_DIR, 'index.html')
  if (!existsSync(file) || !statSync(file).isFile()) return false

  const ext = extname(file).toLowerCase()

  // 字体/图片内容不变，可长期缓存；html 与入口必须每次校验
  const immutable = ['.woff', '.woff2', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.ico'].includes(ext)
  const cacheControl = immutable ? 'public, max-age=31536000, immutable' : 'no-cache'

  let size
  try {
    size = statSync(file).size
  } catch {
    return false
  }

  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': size,
    'Cache-Control': cacheControl,
  })
  createReadStream(file).pipe(res)
  return true
}

// ------------------------------------------------------------
// 路由
// ------------------------------------------------------------
const server = createServer(async (req, res) => {
  const ip = realIP(req.socket, req.headers)
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  const path = url.pathname

  // 跨域策略：
  // - 未配置 ALLOWED_ORIGINS：允许任意来源（与开发期行为一致，本机用足够）
  // - 已配置：只放行白名单来源，其余直接 403
  const origin = req.headers.origin || ''
  const allowAll = config.allowedOrigins.length === 0
  const originAllowed = allowAll || !origin || config.allowedOrigins.includes(origin)

  res.setHeader('Access-Control-Allow-Origin', allowAll ? '*' : origin || 'null')
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')

  if (!originAllowed) {
    return sendJSON(res, 403, { ok: false, code: 'origin_not_allowed', message: '来源不在白名单内' })
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (path === '/api/health' && req.method === 'GET') {
    const status = describeKeyStatus()
    return sendJSON(res, 200, {
      ok: true,
      hasKey: status.ok,
      message: status.message,
      model: config.model,
    })
  }

  if (path === '/api/generate' && req.method === 'POST') {
    return handleGenerate(req, res, ip)
  }

  if (path === '/api/stillpoint' && req.method === 'POST') {
    return handleStillpoint(req, res, ip)
  }

  if (path === '/api/stillpoint/opening' && req.method === 'POST') {
    return handleStillpointOpening(req, res, ip)
  }

  // 非 API 路径交给 dist/；尚未构建时给出明确提示而不是干巴巴的 404
  if (!path.startsWith('/api/')) {
    if (serveStatic(path, res)) return
    if (!existsSync(DIST_DIR)) {
      return sendJSON(res, 404, {
        ok: false,
        code: 'no_build',
        message: '还没有构建前端。请先运行 npm run build，或开发时用 npm run dev。',
      })
    }
  }

  sendJSON(res, 404, { ok: false, code: 'not_found', message: '接口不存在' })
})

server.listen(config.port, config.host, () => {
  const status = describeKeyStatus()
  console.log('')
  console.log('  Between Us 后端服务')
  console.log(`  ➜ http://${config.host}:${config.port}`)
  console.log(`  ${status.ok ? '✓' : '!'} ${status.message}`)
  if (config.trustProxy) console.log('  · 已信任反向代理的 X-Forwarded-For')
  if (existsSync(DIST_DIR)) {
    console.log('  · 同时托管 dist/ 前端页面')
  } else {
    console.log('  · 未找到 dist/，只提供 API（先 npm run build 才能访问页面）')
  }
  console.log('')
  if (!status.ok) {
    console.log('  请编辑项目根目录的 .env，填写 DEEPSEEK_API_KEY 后重启。')
    console.log('')
  }
})

process.on('SIGINT', () => {
  server.close(() => process.exit(0))
})
