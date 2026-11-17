// 对比：Node fetch vs 浏览器 fetch 对同一接口的耗时
const BASE = 'https://between-us3.pages.dev'

const login = async () => {
  const f = new URLSearchParams({ p: process.env.PW })
  const r = await fetch(`${BASE}/__auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: f.toString(),
    redirect: 'manual',
  })
  return `bu_access=${((r.headers.get('set-cookie') || '').match(/bu_access=([^;]+)/) || [])[1]}`
}

const cookie = await login()
console.log('cookie 获取:', !!cookie)

// 连续 5 次，看是否有时快时慢
for (let i = 1; i <= 5; i++) {
  const t0 = Date.now()
  const r = await fetch(`${BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ task: 'probe', context: { qa: [] } }),
  })
  const ms = Date.now() - t0
  const j = await r.json().catch(() => null)
  console.log(`  #${i}  ${r.status}  ${ms}ms  ok=${j?.ok}`)
}
