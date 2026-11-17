// ============================================================
// 访问口令门禁（Cloudflare Pages Functions 中间件）
//
// 背景（2026-11-17）：
//   Cloudflare Access 要求域名是账户内的 active zone，
//   而 pages.dev 是 Cloudflare 自己的域名，无法加入账户，
//   因此不能直接给 between-us3.pages.dev 配 Access。
//   在没有自有域名之前，用这层口令门禁兜住：
//   别人打开链接只会看到登录页，调不到 API，也就花不了你的额度。
//
// 保护范围：
//   · 所有页面路径  → 未通过口令返回登录页
//   · /api/*       → 未通过口令返回 401 JSON
//   · /assets/*    → 放行（构建产物，不含用户数据；放行可免去几百次函数调用）
//
// 口令来源：环境变量 ACCESS_PASSWORD（在 Pages 后台配置）
// 会话票据：HMAC-SHA256 签名的短令牌，不包含口令本身
// ============================================================

const COOKIE_NAME = 'bu_access'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 天
const LOGIN_PATH = '/__auth'
const PUBLIC_PREFIXES = ['/assets/']

// 口令错误次数限制：同一 IP 每分钟最多 10 次，避免被暴力猜
const FAIL_WINDOW_MS = 60_000
const FAIL_LIMIT = 10
const failures = new Map()

const encoder = new TextEncoder()

// ------------------------------------------------------------
// 工具
// ------------------------------------------------------------
async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ])
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// 常量时间比较，避免通过响应时间推断口令
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function readCookie(request, name) {
  const raw = request.headers.get('cookie') || ''
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    if (part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim()
  }
  return ''
}

function clientIP(request) {
  return request.headers.get('cf-connecting-ip') || 'unknown'
}

function tooManyFailures(ip) {
  const now = Date.now()
  const list = (failures.get(ip) || []).filter((t) => now - t < FAIL_WINDOW_MS)
  failures.set(ip, list)
  return list.length >= FAIL_LIMIT
}

function recordFailure(ip) {
  const now = Date.now()
  const list = (failures.get(ip) || []).filter((t) => now - t < FAIL_WINDOW_MS)
  list.push(now)
  failures.set(ip, list)
  if (failures.size > 500) {
    for (const [key, ts] of failures) {
      if (ts.length === 0 || now - ts[ts.length - 1] > FAIL_WINDOW_MS * 5) failures.delete(key)
    }
  }
}

// 会话票据：对固定串做 HMAC。口令不变则票据稳定，
// 改口令后旧 cookie 自动失效（不需要额外的过期表）。
async function expectedToken(secret) {
  return hmacHex(secret, 'between-us-access-v1')
}

async function isAuthenticated(request, secret) {
  const token = readCookie(request, COOKIE_NAME)
  if (!token) return false
  return timingSafeEqual(token, await expectedToken(secret))
}

// ------------------------------------------------------------
// 登录页（自包含样式，不依赖 /assets，保证门禁本身零依赖）
// ------------------------------------------------------------
function loginPage({ error = '', configured = true } = {}) {
  const body = configured
    ? `
    <h1>Between Us</h1>
    <p class="sub">这里需要访问口令</p>
    <form method="POST" action="${LOGIN_PATH}">
      <input type="password" name="p" placeholder="输入访问口令" autocomplete="current-password" autofocus required />
      <button type="submit">进入</button>
    </form>
    ${error ? `<p class="err">${error}</p>` : ''}
    <p class="tip">口令由站点所有者提供。</p>`
    : `
    <h1>尚未配置</h1>
    <p class="sub">站点还没有设置访问口令</p>
    <div class="box">
      <p>请在 Cloudflare Pages 后台添加环境变量：</p>
      <code>ACCESS_PASSWORD</code>
      <p>保存后重新部署即可生效。</p>
    </div>`

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Between Us</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: #050911;
    background-image: radial-gradient(circle at 30% 20%, rgba(93,169,233,0.12), transparent 45%),
                      radial-gradient(circle at 70% 80%, rgba(242,140,56,0.08), transparent 45%);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", sans-serif;
    color: #E6ECF2; padding: 24px;
  }
  .card {
    width: 100%; max-width: 380px; padding: 36px 32px;
    background: rgba(10, 19, 36, 0.86);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 24px;
    backdrop-filter: blur(12px);
    box-shadow: 0 24px 64px rgba(0,0,0,0.6);
  }
  h1 {
    margin: 0 0 6px; font-size: 22px; font-weight: 400; letter-spacing: 0.02em;
    font-family: "Cormorant Garamond", "Noto Serif SC", serif;
  }
  .sub { margin: 0 0 26px; font-size: 13px; color: #8BA6BC; }
  form { display: flex; flex-direction: column; gap: 12px; }
  input {
    width: 100%; padding: 12px 16px; font-size: 14px; color: #E6ECF2;
    background: rgba(5, 9, 17, 0.6);
    border: 1px solid rgba(255,255,255,0.1); border-radius: 999px;
    outline: none; transition: border-color 0.2s, box-shadow 0.2s;
  }
  input:focus { border-color: rgba(93,169,233,0.5); box-shadow: 0 0 18px rgba(93,169,233,0.18); }
  input::placeholder { color: #4A6B82; }
  button {
    padding: 12px 20px; font-size: 14px; color: #fff; cursor: pointer;
    border: none; border-radius: 999px;
    background: linear-gradient(135deg, #f28c38, #d9702a);
    transition: filter 0.2s, transform 0.2s;
  }
  button:hover { filter: brightness(1.08); }
  button:active { transform: scale(0.99); }
  .err { margin: 14px 0 0; font-size: 12px; color: #fca5a5; }
  .tip { margin: 22px 0 0; font-size: 11px; color: #4A6B82; }
  .box { font-size: 12px; line-height: 1.8; color: #8BA6BC; }
  code {
    display: inline-block; padding: 3px 10px; margin: 4px 0;
    background: rgba(93,169,233,0.12); border-radius: 6px;
    color: #93c5fd; font-size: 12px;
  }
</style>
</head>
<body>
  <div class="card">${body}</div>
</body>
</html>`
}

// ------------------------------------------------------------
// 中间件入口
// ------------------------------------------------------------
export async function onRequest(context) {
  const { request, env, next } = context
  const url = new URL(request.url)
  const path = url.pathname

  const password = (env?.ACCESS_PASSWORD || '').trim()

  // 登录页与提交端点自身必须可达，否则会把自己锁在外面
  if (path === LOGIN_PATH) {
    // 未配置口令：只展示配置说明，不接受提交
    if (!password) {
      return new Response(loginPage({ configured: false }), {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      })
    }

    if (request.method === 'POST') {
      const ip = clientIP(request)
      if (tooManyFailures(ip)) {
        return new Response(loginPage({ error: '尝试次数过多，请稍后再试' }), {
          status: 429,
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
        })
      }

      let input = ''
      try {
        const form = await request.formData()
        input = String(form.get('p') || '')
      } catch {
        input = ''
      }

      if (!timingSafeEqual(input, password)) {
        recordFailure(ip)
        return new Response(loginPage({ error: '口令不正确' }), {
          status: 401,
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
        })
      }

      // 通过：写入签名票据（不含口令本身）
      const token = await expectedToken(password)
      const secure = url.protocol === 'https:' ? '; Secure' : ''
      const cookie = `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}${secure}`

      return new Response(null, {
        status: 303,
        headers: {
          Location: '/',
          'Set-Cookie': cookie,
          'Cache-Control': 'no-store',
        },
      })
    }

    return new Response(loginPage(), {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }

  // 静态资源放行：构建产物，不含用户数据，且数量大（字体 600+），
  // 逐个过函数既慢又浪费调用额度
  if (PUBLIC_PREFIXES.some((p) => path.startsWith(p))) {
    return next()
  }

  // 未配置口令：明确告诉用户去配置，而不是假装有保护
  if (!password) {
    return new Response(loginPage({ configured: false }), {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }

  if (await isAuthenticated(request, password)) {
    return next()
  }

  // 未通过：API 返回 JSON，页面返回登录页
  if (path.startsWith('/api/')) {
    return new Response(
      JSON.stringify({ ok: false, code: 'unauthorized', message: '需要访问口令，请先打开站点首页登录' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      },
    )
  }

  return new Response(loginPage(), {
    status: 401,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
