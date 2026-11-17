// ============================================================
// DeepSeek 客户端
// - 结构化输出（JSON）与流式（SSE）两种模式
// - 统一错误分类，便于前端给出人话提示
//
// 2026-11-17 改造：配置改为显式传入（config 参数）。
// 原因：Workers 的环境变量挂在每次请求的 env 上，不是模块级全局，
// 模块加载时读不到。Node 侧调用方传 config.node.mjs 的 config 即可。
// ============================================================

export class AIError extends Error {
  constructor(code, message, detail) {
    super(message)
    this.name = 'AIError'
    this.code = code // no_key | unauthorized | rate_limit | timeout | bad_response | network | server | bad_request
    this.detail = detail
  }
}

function classifyHttp(status, bodyText) {
  if (status === 401 || status === 403) {
    return new AIError('unauthorized', 'API 密钥无效或已过期', bodyText)
  }
  if (status === 429) {
    return new AIError('rate_limit', '请求过于频繁，请稍后再试', bodyText)
  }
  if (status >= 500) {
    return new AIError('server', 'AI 服务暂时不可用', bodyText)
  }
  return new AIError('bad_response', `AI 返回异常（HTTP ${status}）`, bodyText)
}

async function request(config, body, { stream = false } = {}) {
  if (!config.apiKey) {
    throw new AIError('no_key', '未配置 API 密钥，请在 .env 或环境变量中填写 DEEPSEEK_API_KEY')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.timeoutMs)

  let res
  try {
    res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({ ...body, stream }),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timer)
    if (err.name === 'AbortError') {
      throw new AIError('timeout', `AI 响应超时（${Math.round(config.timeoutMs / 1000)} 秒）`)
    }
    // 代理或网络偶发失败，带上原始原因便于排查
    const cause = err?.cause?.code || err?.cause?.message || ''
    throw new AIError('network', `无法连接 AI 服务${cause ? `（${cause}）` : ''}`, String(err))
  }

  if (!res.ok) {
    clearTimeout(timer)
    const text = await res.text().catch(() => '')
    throw classifyHttp(res.status, text)
  }

  return { res, timer }
}

/**
 * 非流式调用，要求返回 JSON 对象
 * @param {object} params
 * @param {object} params.config  来自 buildConfig 的配置
 * @param {Array}  params.messages
 * @param {number} [params.maxTokens]
 * @param {number} [params.temperature]
 * @param {number} [params.retries] 解析失败时的重试次数
 */
export async function chatJSON({ config, messages, maxTokens = 2000, temperature = 0.7, retries = 2 }) {
  let lastErr = null

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    // 网络抖动时退避重试
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 600 * attempt))
    }

    const payload = {
      model: config.model,
      messages,
      max_tokens: maxTokens,
      temperature,
      stream: false,
    }
    // 部分第三方代理不支持 response_format，可通过环境变量关闭
    if (config.jsonMode) {
      payload.response_format = { type: 'json_object' }
    }
    // 关闭推理过程以提速（实测 20s → 2s）
    if (config.disableThinking) {
      payload.thinking = { type: 'disabled' }
    }

    let res
    let timer
    try {
      const out = await request(config, payload)
      res = out.res
      timer = out.timer
    } catch (err) {
      lastErr = err
      // 密钥无效、限流不重试；网络与超时可以重试
      if (err.code === 'unauthorized' || err.code === 'no_key' || err.code === 'rate_limit') {
        throw err
      }
      continue
    }

    let data
    try {
      data = await res.json()
    } catch {
      clearTimeout(timer)
      lastErr = new AIError('bad_response', 'AI 返回内容无法解析')
      continue
    }
    clearTimeout(timer)

    const content = data?.choices?.[0]?.message?.content
    if (typeof content !== 'string' || !content.trim()) {
      lastErr = new AIError('bad_response', 'AI 返回内容为空')
      continue
    }

    try {
      return JSON.parse(content)
    } catch {
      // 尝试从 ```json ... ``` 中提取
      const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)
      if (fenced) {
        try {
          return JSON.parse(fenced[1])
        } catch {
          /* 继续走重试 */
        }
      }
      lastErr = new AIError('bad_response', 'AI 返回的不是合法 JSON')
    }
  }

  throw lastErr || new AIError('bad_response', 'AI 返回内容异常')
}

/**
 * 流式调用：返回一个 async generator，逐段产出文本增量
 * 调用方负责写入 SSE 响应
 * @param {object} params
 * @param {object} params.config
 * @param {Array}  params.messages
 */
export async function* chatStream({ config, messages, maxTokens = 1200, temperature = 0.8 }) {
  const payload = {
    model: config.model,
    messages,
    max_tokens: maxTokens,
    temperature,
    stream: true,
  }
  if (config.disableThinking) {
    payload.thinking = { type: 'disabled' }
  }

  const { res, timer } = await request(config, payload, { stream: true })

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // SSE：按行解析 data: {...}
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const payloadText = trimmed.slice(5).trim()
        if (payloadText === '[DONE]') return
        try {
          const json = JSON.parse(payloadText)
          const delta = json?.choices?.[0]?.delta?.content
          if (delta) yield delta
        } catch {
          // 忽略无法解析的行
        }
      }
    }
  } finally {
    clearTimeout(timer)
    reader.releaseLock?.()
  }
}
