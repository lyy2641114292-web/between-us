// ============================================================
// 后端配置：读取 .env
// 不引入 dotenv 依赖，手写一个最小解析器（只有 4 个键，够用）
// ============================================================
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const ROOT = resolve(__dirname, '..')

function parseEnvFile(path) {
  if (!existsSync(path)) return {}
  const out = {}
  const text = readFileSync(path, 'utf8')
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    // 去掉包裹的引号
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (key) out[key] = value
  }
  return out
}

const fileEnv = parseEnvFile(resolve(ROOT, '.env'))

// Base URL 允许指向官方或第三方代理（[OI] 兼容格式）
// 去掉末尾斜杠，避免拼出 //chat/completions
function normalizeBaseUrl(raw) {
  const v = (raw || '').trim().replace(/\/+$/, '')
  return v || 'https://api.deepseek.com'
}

export const config = {
  apiKey: (process.env.DEEPSEEK_API_KEY || fileEnv.DEEPSEEK_API_KEY || '').trim(),
  model: (process.env.DEEPSEEK_MODEL || fileEnv.DEEPSEEK_MODEL || 'deepseek-flash').trim(),
  port: Number(process.env.PORT || fileEnv.PORT || 8788),
  // 监听地址。默认只监听本机（开发期足够，也不会被局域网误访问）。
  // 部署到服务器时设为 0.0.0.0，否则外网连不上。
  host: (process.env.HOST || fileEnv.HOST || '127.0.0.1').trim(),
  // 是否信任反向代理传来的 X-Forwarded-For。
  // 部署在 Nginx / Caddy / 云平台后面时必须设为 true，
  // 否则限流会把所有访客都当成代理那一个 IP，20 次/分钟变成全站共享。
  trustProxy: (process.env.TRUST_PROXY || fileEnv.TRUST_PROXY || 'false').trim() === 'true',
  // 允许跨域访问的前端来源，逗号分隔，例如 https://between-us.vercel.app
  // 留空 = 允许任意来源（开发期方便）。对公网开放时务必填写，
  // 否则任何人都能拿你的后端当免费代理调用模型。
  allowedOrigins: (process.env.ALLOWED_ORIGINS || fileEnv.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean),
  // 每个 IP 每分钟允许的模型调用次数。
  // 一次完整五阶段会话（含 01/03 的后台预取）约需 20~30 次，
  // 原来固定 20 次/分钟，用户正常作答时很容易被自己触发的预取挤掉。
  rateLimit: Number(process.env.RATE_LIMIT || fileEnv.RATE_LIMIT || 60),
  timeoutMs: Number(process.env.AI_TIMEOUT_MS || fileEnv.AI_TIMEOUT_MS || 30000),
  baseUrl: normalizeBaseUrl(process.env.DEEPSEEK_BASE_URL || fileEnv.DEEPSEEK_BASE_URL),
  // 该端点是否支持 response_format: json_object（代理可能不支持）
  jsonMode: (process.env.DEEPSEEK_JSON_MODE || fileEnv.DEEPSEEK_JSON_MODE || 'true').trim() !== 'false',
  // 是否关闭模型的推理过程。deepseek-v4.1-flash 默认会先推理再回答，
  // 实测一次 analyze 有 1335 个 token 花在推理上、耗时近 20 秒；
  // 关闭后 8s → 1.7s。本项目的任务（结构化提取）不需要长推理。
  disableThinking:
    (process.env.DEEPSEEK_DISABLE_THINKING || fileEnv.DEEPSEEK_DISABLE_THINKING || 'true').trim() !== 'false',
}

export function hasApiKey() {
  return config.apiKey.length > 0
}

// 启动时打印密钥状态（不打印密钥本身）
export function describeKeyStatus() {
  if (!hasApiKey()) {
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
