import { chromium } from 'playwright'
const BASE = 'https://between-us3.pages.dev'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

const log = []
const t0 = Date.now()
page.on('request', (r) => {
  if (r.url().includes('/api/')) log.push({ ev: 'req', url: r.url().replace(BASE, ''), t: Date.now() - t0, method: r.method() })
})
page.on('response', async (r) => {
  if (!r.url().includes('/api/')) return
  log.push({ ev: 'res', url: r.url().replace(BASE, ''), t: Date.now() - t0, status: r.status() })
})
page.on('requestfailed', (r) => {
  if (r.url().includes('/api/')) log.push({ ev: 'fail', url: r.url().replace(BASE, ''), t: Date.now() - t0, err: r.failure()?.errorText })
})
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 200)))

await page.goto(BASE + '/__auth', { waitUntil: 'domcontentloaded' })
await page.fill('input[name="p"]', process.env.PW)
await page.click('button[type="submit"]')
await page.waitForTimeout(2000)

await page.evaluate(() => localStorage.clear())
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1000)
const ack = page.locator('button', { hasText: '我知道了' })
if (await ack.count()) await ack.first().click({ force: true })
await page.waitForTimeout(500)
await page.getByText('开始探索').first().click({ force: true })

// 每 3 秒采样一次界面状态，持续 30 秒
for (let i = 0; i < 10; i++) {
  await page.waitForTimeout(3000)
  const snap = await page.evaluate(() => {
    const raw = localStorage.getItem('between-us:state')
    const d = raw ? JSON.parse(raw).data.stage01 : null
    const h1 = document.querySelector('h1')?.textContent?.slice(0, 40) || ''
    return { h1, qa: d?.qa?.length, loading: d?.loading, error: d?.error, branchLoading: d?.branchLoading }
  })
  console.log(`t=${(i + 1) * 3}s  ${JSON.stringify(snap)}`)
}

console.log('\n=== 请求时间线 ===')
for (const l of log) console.log(`  ${l.t}ms  ${l.ev}  ${l.method || ''} ${l.url} ${l.status || l.err || ''}`)

await browser.close()
