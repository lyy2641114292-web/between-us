// ============================================================
// Cloudflare Pages Functions 入口：/api/*
//
// 作用：把原本跑在 Node 的后端，放到 Pages 同一个站点上。
//   · 同域名 → 前端不需要 VITE_API_BASE，请求走相对路径 /api
//   · 无需另开服务器，也不需要自己的电脑开机
//
// 与 server/index.mjs 的关系：
//   业务逻辑全部复用 server/handlers.js，两边行为一致。
//   本文件只负责「把 Workers 的 Request 转成 handlers 的输入，
//   再把输出转成 Response」，以及 Workers 特有的限流。
//
// 密钥：从 Pages 后台的环境变量读取（Settings → Environment variables），
//       不存在代码里，也不进仓库。
// ============================================================
import { buildConfig, describeKeyStatus } from '../../server/config.js'
import { AIError } from '../../server/deepseek.mjs'
import {
  errorPayload,
  parseBody,
  runGenerate,
  runStillpointOpening,
  runStillpointStream,
} from '../../server/handlers.js'

// ------------------------------------------------------------
// 限流
//
// 注意：Workers 没有跨请求共享的内存。
// 模块级 Map 只在「同一个 isolate 内」有效，不同边缘节点各自计数。
// 也就是说：单地区访问时能挡住刷量，多地区访问时额度不共享。
//
// 这是 Workers 架构的固有限制。要做全局限流需要 KV / Durable Objects，
// 属后续可选项，当前先用这个轻量版本兜底。
// ------------------------------------------------------------
const RATE_WINDOW_MS = 60_000
const hits = new Map()

function isRateLimited(ip, limit) {
  const now = Date.now()
  const list = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS)
  const limited = list.length >= limit
  hits.set(ip, list)
  return limited
}

function recordHit(ip) {
  const now = Date.now()
  const list = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS)
  list.push(now)
  hits.set(ip, list)
  // 避免 Map 无限增长
  if (hits.size > 500) {
    for (const [key, ts] of hits) {
      if (ts.length === 0 || now - ts[ts.length - 1] > RATE_WINDOW_MS * 5) hits.delete(key)
    }
  }
}

// Cloudflare 会写入真实访客 IP；没有时退回一个固定值（不影响功能，只影响限流粒度）
function clientIP(request) {
  return request.headers.get('cf-connecting-ip') || 'unknown'
}

// ------------------------------------------------------------
// 响应工具
// ------------------------------------------------------------
const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
}

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS })
}

function applyCORS(response, request, allowedOrigins) {
  const origin = request.headers.get('origin') || ''
  const allowAll = allowedOrigins.length === 0
  const originAllowed = allowAll || !origin || allowedOrigins.includes(origin)

  const headers = new Headers(response.headers)
  headers.set('Access-Control-Allow-Origin', allowAll ? '*' : origin || 'null')
  headers.set('Vary', 'Origin')
  headers.set('Access-Control-Allow-Headers', 'Content-Type')
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')

  return { response: new Response(response.body, { status: response.status, headers }), originAllowed }
}

// ------------------------------------------------------------
// 路由
// ------------------------------------------------------------
export async function onRequest(context) {
  const { request, env, params } = context

  // env 里只有 Pages 后台配置的变量，因此 fileEnv 传空对象
  const config = buildConfig({ env, fileEnv: {} })

  // 路径：/api/xxx → ['xxx']，/api → undefined
  const segments = Array.isArray(params?.path)
    ? params.path
    : typeof params?.path === 'string' && params.path
      ? params.path.split('/')
      : []
  const route = segments.join('/')

  // 统一处理 CORS 预检
  if (request.method === 'OPTIONS') {
    const res = new Response(null, { status: 204 })
    applyCORS(res, request, config.allowedOrigins)
    return res
  }

  const wrap = (response) => {
    const { response: withCors, originAllowed } = applyCORS(response, request, config.allowedOrigins)
    if (!originAllowed) {
      return jsonResponse(403, { ok: false, code: 'origin_not_allowed', message: '来源不在白名单内' })
    }
    return withCors
  }

  // ---- GET /api/health ----
  if (route === 'health' && request.method === 'GET') {
    const status = describeKeyStatus(config)
    return wrap(
      jsonResponse(200, {
        ok: true,
        hasKey: status.ok,
        message: status.message,
        model: config.model,
        runtime: 'cloudflare-pages',
      }),
    )
  }

  // ---- POST /api/generate ----
  if (route === 'generate' && request.method === 'POST') {
    let body
    try {
      body = parseBody(await request.text())
    } catch (err) {
      return wrap(jsonResponse(400, errorPayload(err)))
    }

    const { task, context = {} } = body
    // 任务白名单在 handlers 里校验；这里先挡掉明显无效的，避免占额度
    if (typeof task !== 'string' || !task) {
      return wrap(jsonResponse(400, { ok: false, code: 'bad_request', message: `未知任务：${task}` }))
    }

    const ip = clientIP(request)
    if (isRateLimited(ip, config.rateLimit)) {
      return wrap(jsonResponse(429, { ok: false, code: 'rate_limit', message: '请求过于频繁，请稍后再试' }))
    }
    recordHit(ip)

    const { status, json } = await runGenerate({ config, body: { task, context } })
    return wrap(jsonResponse(status, json))
  }

  // ---- POST /api/stillpoint/opening ----
  if (route === 'stillpoint/opening' && request.method === 'POST') {
    let body
    try {
      body = parseBody(await request.text())
    } catch (err) {
      return wrap(jsonResponse(400, errorPayload(err)))
    }

    const ip = clientIP(request)
    if (isRateLimited(ip, config.rateLimit)) {
      return wrap(jsonResponse(429, { ok: false, code: 'rate_limit', message: '请求过于频繁，请稍后再试' }))
    }
    recordHit(ip)

    const { status, json } = await runStillpointOpening({ config, body })
    return wrap(jsonResponse(status, json))
  }

  // ---- POST /api/stillpoint（SSE 流式）----
  if (route === 'stillpoint' && request.method === 'POST') {
    let body
    try {
      body = parseBody(await request.text())
    } catch (err) {
      return wrap(jsonResponse(400, errorPayload(err)))
    }

    const ip = clientIP(request)
    if (isRateLimited(ip, config.rateLimit)) {
      return wrap(jsonResponse(429, { ok: false, code: 'rate_limit', message: '请求过于频繁，请稍后再试' }))
    }
    recordHit(ip)

    const encoder = new TextEncoder()
    // 用 ReadableStream 把 async generator 转成 SSE 响应
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of runStillpointStream({ config, body })) {
            controller.enqueue(encoder.encode(chunk))
          }
        } catch (err) {
          // 流已经开始，只能在流内报错，前端会走 onError
          const evt = `data: ${JSON.stringify(new AIError('server', '流式输出中断'))}\n\n`
          controller.enqueue(encoder.encode(evt))
        } finally {
          controller.close()
        }
      },
    })

    const headers = new Headers({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    })
    const response = new Response(stream, { status: 200, headers })
    return wrap(response)
  }

  return wrap(jsonResponse(404, { ok: false, code: 'not_found', message: '接口不存在' }))
}