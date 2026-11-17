// ============================================================
// 后端配置（纯解析，不碰文件系统）
//
// 两种运行时共用：
//   · Node（server/index.mjs）      → 由 config.node.mjs 读 .env 后调用
//   · Cloudflare Workers（functions/） → 直接用 env 对象调用
//
// 之所以拆出来：Workers 没有 node:fs，不能 readFileSync。
// 本文件只做字符串与数字整理，因此两边都能 import。
// ============================================================

// Base URL 允许指向官方或第三方代理（[OI] 兼容格式）
// 去掉末尾斜杠，避免拼出 //chat/completions
function normalizeBaseUrl(raw) {
  const v = (raw || '').trim().replace(/\/+$/, '')
  return v || 'https://api.deepseek.com'
}

/**
 * 从环境变量构建配置对象。
 * @param {object} params
 * @param {object} [params.env]     真实环境变量（Node: process.env / Workers: env）
 * @param {object} [params.fileEnv] .env 文件解析结果（Workers 传空对象）
 */
export function buildConfig({ env = {}, fileEnv = {} } = {}) {
  // 先查真实环境变量，再查 .env 文件，最后用默认值
  const pick = (key, fallback) => {
    const fromEnv = env[key]
    if (fromEnv !== undefined && fromEnv !== null && String(fromEnv).trim() !== '') {
      return String(fromEnv)
    }
    const fromFile = fileEnv[key]
    if (fromFile !== undefined && fromFile !== null && String(fromFile).trim() !== '') {
      return String(fromFile)
    }
    return fallback
  }

  return {
    apiKey: pick('DEEPSEEK_API_KEY', '').trim(),
    model: pick('DEEPSEEK_MODEL', 'deepseek-flash').trim(),
    port: Number(pick('PORT', 8788)),
    // 监听地址。默认只监听本机（开发期足够，也不会被局域网误访问）。
    // 部署到服务器时设为 0.0.0.0，否则外网连不上。
    host: pick('HOST', '127.0.0.1').trim(),
    // 是否信任反向代理传来的 X-Forwarded-For。
    // 部署在 Nginx / Caddy / 云平台后面时必须设为 true，
    // 否则限流会把所有访客都当成代理那一个 IP。
    trustProxy: pick('TRUST_PROXY', 'false').trim() === 'true',
    // 允许跨域访问的前端来源，逗号分隔，例如 https://between-us.pages.dev
    // 留空 = 允许任意来源（开发期方便）。对公网开放时务必填写，
    // 否则任何人都能拿你的后端当免费代理调用模型。
    allowedOrigins: pick('ALLOWED_ORIGINS', '')
      .split(',')
      .map((s) => s.trim().replace(/\/+$/, ''))
      .filter(Boolean),
    // 每个 IP 每分钟允许的模型调用次数。
    // 一次完整五阶段会话（含 01/03 的后台预取）约需 20~30 次，
    // 原来固定 20 次/分钟，用户正常作答时很容易被自己触发的预取挤掉。
    rateLimit: Number(pick('RATE_LIMIT', 60)),
    timeoutMs: Number(pick('AI_TIMEOUT_MS', 30000)),
    baseUrl: normalizeBaseUrl(pick('DEEPSEEK_BASE_URL', '')),
    // 该端点是否支持 response_format: json_object（代理可能不支持）
    jsonMode: pick('DEEPSEEK_JSON_MODE', 'true').trim() !== 'false',
    // 是否关闭模型的推理过程。deepseek-v4.1-flash 默认会先推理再回答，
    // 实测一次 analyze 有 1335 个 token 花在推理上、耗时近 20 秒；
    // 关闭后 8s → 1.7s。本项目的任务（结构化提取）不需要长推理。
    disableThinking: pick('DEEPSEEK_DISABLE_THINKING', 'true').trim() !== 'false',
  }
}

export function hasApiKey(config) {
  return config.apiKey.length > 0
}

// 启动时打印密钥状态（不打印密钥本身）
export function describeKeyStatus(config) {
  if (!hasApiKey(config)) {
    return {
      ok: false,
      message: '未检测到 DEEPSEEK_API_KEY。请在项目根目录的 .env 中填写后重启服务。',
    }
  }
  const k = config.apiKey
  const masked = k.length > 12 ? `${k.slice(0, 6)}…${k.slice(-4)}` : '已设置'
  return {
    ok: true,
    message: `已检测到密钥（${masked}），模型：${config.model}，接口：${config.baseUrl}`,
  }
}
