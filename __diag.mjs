import { chromium } from 'playwright'

const BASE = 'https://between-us3.pages.dev'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

const reqs = []
const t0 = Date.now()
page.on('request', (r) => {
  if (r.url().includes('/api/')) reqs.push({ url: r.url().replace(BASE, ''), method: r.method(), t: Date.now() - t0, status: null })
})
page.on('response', (r) => {
  if (!r.url().includes('/api/')) return
  const u = r.url().replace(BASE, '')
  const rec = [...reqs].reverse().find((x) => x.url === u && x.status === null)
  if (rec) { rec.status = r.status(); rec.end = Date.now() - t0 }
})
page.on('requestfailed', (r) => {
  if (!r.url().includes('/api/')) return
  const u = r.url().replace(BASE, '')
  const rec = [...reqs].reverse().find((x) => x.url === u && x.status === null)
  if (rec) { rec.status = 'FAILED:' + (r.failure()?.errorText || ''); rec.end = Date.now() - t0 }
})
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)))
page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 300)) })

await page.goto(BASE + '/__auth', { waitUntil: 'domcontentloaded' })
await page.fill('input[name="p"]', process.env.PW)
await page.click('button[type="submit"]')
await page.waitForTimeout(2500)
console.log('登录后 URL:', page.url())

await page.evaluate(() => localStorage.clear())
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1200)

const ack = page.locator('button', { hasText: '我知道了' })
if (await ack.count()) { await ack.first().click({ force: true }); await page.waitForTimeout(700); console.log('已确认隐私告知') }

const start = page.getByText('开始探索').first()
if (await start.count()) { await start.click({ force: true }); console.log('已点击开始探索') }

await page.waitForTimeout(20000)

console.log('\n=== API 请求 ===')
if (reqs.length === 0) console.log('（一个都没发出）')
for (const r of reqs) {
  const dur = r.end ? `${r.end - r.t}ms` : '未结束'
  console.log(`  ${r.method} ${r.url}  status=${r.status ?? '—'}  开始=${r.t}ms 耗时=${dur}`)
}

console.log('\n=== 标题 ===')
console.log(JSON.stringify(await page.locator('h1').first().textContent().catch(() => null)))

console.log('\n=== stage01 状态 ===')
console.log(JSON.stringify(await page.evaluate(() => {
  const raw = localStorage.getItem('between-us:state')
  if (!raw) return 'NO_SAVE'
  const d = JSON.parse(raw).data.stage01
  return { qa: d.qa?.length, loading: d.loading, error: d.error, branchLoading: d.branchLoading }
})))

await browser.close()
