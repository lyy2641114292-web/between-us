// ============================================================
// 前端 AI 调用层
// 所有请求都走 /api（Vite 代理到后端），浏览器里没有任何密钥
// 统一返回 { ok, data?, code?, message? }，调用方据此决定是否降级
// ============================================================

const TIMEOUT_MS = 45_000

// 后端地址前缀。默认空字符串 = 相对路径 /api（本机 dev 由 Vite 代理转发）。
// 前端与后端不同源时（例如静态托管 + 独立部署的后端），在项目根目录 .env
// 里填 VITE_API_BASE=https://你的后端域名 再重新 npm run build。
// 注意：这是"构建时"变量，改完必须重新构建才会进产物。
const API_BASE = (import.meta.env.VITE_API_BASE || '').trim().replace(/\/+$/, '')

/** 把逻辑路径拼成实际请求地址；API_BASE 为空时原样返回 */
function url(path) {
  return API_BASE ? `${API_BASE}${path}` : path
}

async function post(path, body) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!res.ok) {
      // 429 单独给一句能指导行动的话：用户除了等待没有别的办法，
      // 沿用「AI 服务返回异常」会让人以为出了故障、反复重试（反而更久恢复不了）。
      if (res.status === 429) {
        return { ok: false, code: 'rate_limit', message: '操作有点快，AI 调用次数已达上限，约 1 分钟后可继续' }
      }
      return { ok: false, code: `http_${res.status}`, message: 'AI 服务返回异常' }
    }

    const json = await res.json()
    return json
  } catch (err) {
    if (err.name === 'AbortError') {
      return { ok: false, code: 'timeout', message: 'AI 响应超时' }
    }
    return { ok: false, code: 'network', message: '无法连接 AI 服务，请确认后端已启动' }
  } finally {
    clearTimeout(timer)
  }
}

// 检查后端是否可用、是否已配置密钥
export async function checkHealth() {
  try {
    const res = await fetch(url('/api/health'), { method: 'GET' })
    if (!res.ok) return { ok: false, hasKey: false, message: '后端未响应' }
    return await res.json()
  } catch {
    return { ok: false, hasKey: false, message: '无法连接后端服务' }
  }
}

/**
 * 生成结构化内容
 * @param {'analyze'|'explore'|'compare'|'draft'|'probe'|'probeBranch'|'summarize'} task
 * @param {object} context
 * @returns {Promise<{ok:boolean, data?:object, code?:string, message?:string}>}
 */
export function generate(task, context) {
  return post('/api/generate', { task, context })
}

/**
 * 生成静观开场白与三条追问（根据用户实际情境）
 * @param {object} context
 * @returns {Promise<{ok:boolean, data?:{opening:string[],questions:string[]}, code?:string, message?:string}>}
 */
export function generateStillpointOpening(context) {
  return post('/api/stillpoint/opening', { context })
}

/**
 * 静观流式对话
 * @param {object} context
 * @param {(text:string)=>void} onDelta  每收到一段文本
 * @param {(full:string)=>void} onDone   结束时收到完整文本
 * @param {(err:{code:string,message:string})=>void} onError
 */
export async function stillpointStream({ context, onDelta, onDone, onError }) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url('/api/stillpoint'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context }),
      signal: controller.signal,
    })

    if (!res.ok || !res.body) {
      if (res.status === 429) {
        onError?.({ code: 'rate_limit', message: '操作有点快，AI 调用次数已达上限，约 1 分钟后可继续' })
        return
      }
      onError?.({ code: `http_${res.status}`, message: 'AI 服务返回异常' })
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const t = line.trim()
        if (!t.startsWith('data:')) continue
        const payload = t.slice(5).trim()
        if (!payload) continue
        try {
          const evt = JSON.parse(payload)
          if (evt.type === 'delta') onDelta?.(evt.text)
          else if (evt.type === 'done') onDone?.(evt.text)
          else if (evt.type === 'error') onError?.({ code: evt.code, message: evt.message })
        } catch {
          /* 忽略无法解析的行 */
        }
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      onError?.({ code: 'timeout', message: 'AI 响应超时' })
    } else {
      onError?.({ code: 'network', message: '无法连接 AI 服务' })
    }
  } finally {
    clearTimeout(timer)
  }
}
