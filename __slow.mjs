import { chromium } from 'playwright'
const BASE = 'https://between-us3.pages.dev'
const browser = await chromium.launch()
const page = await browser.newPage()

await page.goto(BASE + '/__auth', { waitUntil: 'domcontentloaded' })
await page.fill('input[name="p"]', process.env.PW)
await page.click('button[type="submit"]')
await page.waitForTimeout(1800)

await page.evaluate(() => localStorage.clear())
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(900)
const ack = page.locator('button', { hasText: '我知道了' })
if (await ack.count()) await ack.first().click({ force: true })
await page.waitForTimeout(400)

// 拦截并延迟 API 60 秒，模拟"后端很慢"
await page.route('**/api/generate', async (route) => {
  await new Promise((r) => setTimeout(r, 60000))
  route.continue().catch(() => {})
})

await page.getByText('开始探索').first().click({ force: true })
console.log('已进入阶段 01，API 被延迟 60 秒，观察 70 秒内是否自愈\n')

for (let i = 1; i <= 14; i++) {
  await page.waitForTimeout(5000)
  const s = await page.evaluate(() => {
    const raw = localStorage.getItem('between-us:state')
    const d = raw ? JSON.parse(raw).data.stage01 : null
    const h1 = [...document.querySelectorAll('h1')].map(e => e.textContent.trim()).join(' | ')
    return { qa: d?.qa?.length, loading: d?.loading, error: d?.error, h1 }
  })
  console.log(`t=${i * 5}s  qa=${s.qa} loading=${s.loading} error="${s.error}"`)
  if (i === 8) console.log('   h1:', s.h1.slice(0, 80))
}

console.log('\n=== 90 秒后的最终状态 ===')
console.log(JSON.stringify(await page.evaluate(() => {
  const raw = localStorage.getItem('between-us:state')
  const d = raw ? JSON.parse(raw).data.stage01 : null
  return { qa: d?.qa?.length, loading: d?.loading, error: d?.error }
})))

await browser.close()
