import { chromium } from 'playwright'
const BASE = 'https://between-us3.pages.dev'
const browser = await chromium.launch()
const page = await browser.newPage()

// 记录首问请求的完整细节
page.on('request', (r) => {
  if (r.url().includes('/api/generate')) {
    console.log('[REQ] 带 cookie:', (r.headers()['cookie'] || '(无)').slice(0, 40))
    console.log('[REQ] body:', r.postData()?.slice(0, 120))
  }
})
page.on('response', async (r) => {
  if (r.url().includes('/api/generate')) {
    console.log('[RES] status:', r.status())
    const body = await r.text().catch(() => '(读取失败)')
    console.log('[RES] body:', body.slice(0, 200))
  }
})

await page.goto(BASE + '/__auth', { waitUntil: 'domcontentloaded' })
await page.fill('input[name="p"]', process.env.PW)
await page.click('button[type="submit"]')
await page.waitForTimeout(2000)

console.log('登录后 cookies:', (await page.context().cookies()).map(c => `${c.name}=${c.value.slice(0, 12)}… domain=${c.domain} path=${c.path} sameSite=${c.sameSite}`))

await page.evaluate(() => localStorage.clear())
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(900)
const ack = page.locator('button', { hasText: '我知道了' })
if (await ack.count()) await ack.first().click({ force: true })
await page.waitForTimeout(400)
await page.getByText('开始探索').first().click({ force: true })
await page.waitForTimeout(12000)

await browser.close()
