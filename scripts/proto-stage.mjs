// 原型逐阶段截图（用于视觉基线对比）
// 用法: node scripts/proto-stage.mjs <宽> <高> <阶段序号 0~4>
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const [, , wArg = '375', hArg = '812', idxArg = '2'] = process.argv
const width = Number(wArg), height = Number(hArg), idx = Number(idxArg)
const CHROME = process.env.PROBE_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PROTO = process.env.PROTO_URL || 'file:///C:/Users/26411/Desktop/between%20us/%E7%89%88%E6%9C%AC%E8%BF%AD%E4%BB%A3/7.html'
const DEADLINE_MS = 60_000
const started = Date.now()
const profile = mkdtempSync(join(tmpdir(), 'bu-proto-'))
const shot = join(tmpdir(), `bu-proto-s${idx}-${width}x${height}.png`)

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--hide-scrollbars', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  '--allow-file-access-from-files', 'about:blank',
], { stdio: ['ignore', 'pipe', 'pipe'] })

let stderr = ''
chrome.stderr.on('data', (d) => (stderr += d.toString()))
const hardStop = setTimeout(() => { console.error('TIMEOUT'); try { chrome.kill('SIGKILL') } catch {}; process.exit(2) }, DEADLINE_MS)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function waitForPort() {
  return new Promise((resolve, reject) => {
    const check = () => {
      const m = stderr.match(/DevTools listening on (ws:\/\/\S+)/)
      if (m) return resolve(m[1])
      if (Date.now() - started > 25_000) return reject(new Error('no devtools port'))
      setTimeout(check, 120)
    }
    check()
  })
}

class CDP {
  constructor(u) {
    this.ws = new WebSocket(u); this.id = 0; this.pending = new Map()
    this.ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id); this.pending.delete(m.id)
        m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result)
      }
    })
  }
  open() { return new Promise((res, rej) => { this.ws.addEventListener('open', res, { once: true }); this.ws.addEventListener('error', rej, { once: true }) }) }
  send(method, params = {}, sid) {
    const id = ++this.id
    const p = { id, method, params }; if (sid) p.sessionId = sid
    this.ws.send(JSON.stringify(p))
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error(method + ' timeout')) } }, 25_000) })
  }
  close() { try { this.ws.close() } catch {} }
}

async function main() {
  const cdp = new CDP(await waitForPort())
  await cdp.open()
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true })
  await cdp.send('Page.enable', {}, sessionId)
  await cdp.send('Runtime.enable', {}, sessionId)
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: true }, sessionId)

  const errors = []
  cdp.ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data)
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails?.text)
  })

  await cdp.send('Page.navigate', { url: PROTO }, sessionId)

  const evalJs = async (expr) => {
    const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sessionId)
    if (exceptionDetails) throw new Error(exceptionDetails.text + ' ' + (exceptionDetails.exception?.description || ''))
    return result.value
  }

  // 等页面脚本就绪（最多 15 秒）
  const ready = await (async () => {
    for (let i = 0; i < 30; i++) {
      const ok = await evalJs(`typeof navigateToStage === 'function' && !!document.getElementById('stillpoint-drawer')`)
      if (ok) return true
      await sleep(500)
    }
    return false
  })()

  // 关闭静观抽屉（原型默认打开），再跳到目标阶段
  const closed = await evalJs(`(() => {
    const d = document.getElementById('stillpoint-drawer');
    if (!d) return 'no-drawer';
    d.classList.remove('open');
    if (typeof toggleStillpointDrawer === 'function' && d.classList.contains('open')) toggleStillpointDrawer();
    return d.classList.contains('open') ? 'still-open' : 'closed';
  })()`)
  await sleep(600)

  const nav = await evalJs(`(() => { if (typeof navigateToStage !== 'function') return 'no-fn'; navigateToStage(${idx}); return 'ok'; })()`)
  await sleep(3000)

  const measure = await evalJs(`(() => {
    const vw = innerWidth, docW = document.documentElement.scrollWidth;
    const vis = Array.from(document.querySelectorAll('.stage-view')).find(s => s.classList.contains('active'));
    // 阶段 03 头图元素的实际矩形
    let headerRects = null;
    if (${idx} === 2) {
      const left = document.getElementById('s3-orb-origin');
      const right = document.getElementById('s3-orb-friend');
      const h1 = right && right.querySelector('h1');
      const r = (el) => el ? (() => { const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; })() : null;
      headerRects = { left: r(left), right: r(right), h1: r(h1) };
    }
    return { stage: ${idx}, viewport: vw, docW, overflow: docW - vw, activeFound: !!vis, headerRects };
  })()`)

  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId)
  writeFileSync(shot, Buffer.from(data, 'base64'))
  console.log(JSON.stringify({ screenshot: shot, ready, closed, nav, ...measure, errors }, null, 2))
  cdp.close(); chrome.kill('SIGKILL'); clearTimeout(hardStop)
  await sleep(300); try { rmSync(profile, { recursive: true, force: true }) } catch {}
  process.exit(0)
}
main().catch((e) => { console.error('FAILED:', e.message); try { chrome.kill('SIGKILL') } catch {}; clearTimeout(hardStop); process.exit(1) })