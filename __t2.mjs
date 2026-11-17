import { chromium } from 'playwright'
const BASE = 'https://between-us3.pages.dev'
const browser = await chromium.launch()
const page = await browser.newPage()

await page.goto(BASE + '/__auth', { waitUntil: 'domcontentloaded' })
await page.fill('input[name="p"]', process.env.PW)
await page.click('button[type="submit"]')
await page.waitForTimeout(2000)

// 直接在页面里 fetch，测量浏览器侧耗时
const out = await page.evaluate(async () => {
  const res = []
  for (let i = 1; i <= 4; i++) {
    const t0 = performance.now()
    try {
      const r = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: 'probe', context: { qa: [] } }),
      })
      const j = await r.json()
      res.push({ i, status: r.status, ms: Math.round(performance.now() - t0), ok: j?.ok })
    } catch (e) {
      res.push({ i, error: e.message, ms: Math.round(performance.now() - t0) })
    }
  }
  return res
})
console.log('浏览器内 fetch:')
for (const r of out) console.log(' ', JSON.stringify(r))

// 再试 branch 任务（branchLoading 卡住的嫌疑）
const branch = await page.evaluate(async () => {
  const t0 = performance.now()
  const r = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task: 'probeBranch', context: { qa: [], question: '发生了什么？', chips: ['忘了生日', '没回我'] } }),
  })
  const j = await r.json().catch(() => null)
  return { status: r.status, ms: Math.round(performance.now() - t0), ok: j?.ok, keys: j ? Object.keys(j) : null }
})
console.log('probeBranch:', JSON.stringify(branch))

await browser.close()
