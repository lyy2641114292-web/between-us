// ============================================================
// 后端配置：读取 .env（Node 环境专用）
//
// 2026-11-17 拆分原因：
//   Cloudflare Pages Functions 跑在 Workers 运行时，没有 node:fs，
//   无法 readFileSync 读 .env，配置只能从环境变量注入。
//   因此把「怎么读」与「有哪些键」拆开：
//     · config.js       纯配置解析（两种运行时共用，不碰文件系统）
//     · config.node.mjs 本文件，Node 侧额外读 .env 并导出 ROOT
// ============================================================
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildConfig, describeKeyStatus as describe, hasApiKey as hasKey } from './config.js'

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

// 优先级：真实环境变量 > .env 文件 > 默认值
export const config = buildConfig({ env: process.env, fileEnv })

export function hasApiKey() {
  return hasKey(config)
}

export function describeKeyStatus() {
  return describe(config)
}