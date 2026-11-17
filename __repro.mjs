import { chromium } from 'playwright'
const BASE = 'https://between-us3.pages.dev'
const browser = await chromium.launch()
const page = await browser.newPage()

await page.goto(BASE + '/__auth', { waitUntil: 'domcontentloaded' })
await page.fill('input[name="p"]', process.env.PW)
await page.click('button[type="submit"]')
await page.waitForTimeout(1800)

// 模拟"上一次会话崩溃时留下的 loading:true"
await page.evaluate(() => {
  const raw = localStorage.getItem('between-us:state')
  if (!raw) { console.log('无存档'); return }
  const p = JSON.parse(raw)
  p.data.stage01.qa = []
  p.data.stage01.loading = true      // ← 关键：残留的 true
  p.data.stage01.error = ''
  localStorage.setItem('between-us:state', JSON.stringify(p))
  return p.version
}).then((v) => console.log('已写入残留状态, version =', v))

// 记录是否有 API 请求
let apiCount = 0
page.on('request', (r) => { if (r.url().includes('/api/generate')) apiCount++ })

await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1200)
const ack = page.locator('button', { hasText: '我知道了' })
if (await ack.count()) await ack.first().click({ force: true })
await page.waitForTimeout(400)
await page.getByText('开始探索').first().click({ force: true })
await page.waitForTimeout(12000)

const st = await page.evaluate(() => {
  const raw = localStorage.getItem('between-us:state')
  const d = JSON.parse(raw).data.stage01
  const h1 = [...document.querySelectorAll('h1')].map(e => e.textContent.trim()).join(' | ')
  return { qa: d.qa?.length, loading: d.loading, error: d.error, h1: h1.slice(0, 60) }
})

console.log('\n=== 结果 ===')
console.log('API 请求次数:', apiCount)
console.log('状态:', JSON.stringify(st))
console.log(apiCount === 0 && st.qa === 0 && st.loading === true
  ? '\n✅ 复现成功：不请求、qa=0、loading 永远为 true、error 为空 → 界面永久卡住'
  : '\n❌ 未复现')
await browser.close()
