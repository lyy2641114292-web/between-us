// 移动端逐阶段探针：打开页面 → 点「开始探索」→ 点底部第 N 个散落导航点，
// 在指定视口下测量横向溢出与被裁切元素，并截图。
//
// 用法: node scripts/stage-probe.mjs <port> <宽> <高> <阶段序号 0~4>
// 只读测量、不输入内容；总超时 60 秒。
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const [, , port = '5200', wArg = '375', hArg = '812', idxArg = '0'] = process.argv
const width = Number(wArg)
const height = Number(hArg)
const stageIdx = Number(idxArg)
const CHROME = process.env.PROBE_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const DEADLINE_MS = 60_000
const started = Date.now()

const profile = mkdtempSync(join(tmpdir(), 'bu-stage-'))
const shot = join(tmpdir(), `bu-s${stageIdx}-${width}x${height}.png`)

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--hide-scrollbars', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
], { stdio: ['ignore', 'pipe', 'pipe'] })

let stderr = ''
chrome.stderr.on('data', (d) => (stderr += d.toString()))

const hardStop = setTimeout(() => {
  console.error('TIMEOUT')
  try { chrome.kill('SIGKILL') } catch {}
  try { rmSync(profile, { recursive: true, force: true }) } catch {}
  process.exit(2)
}, DEADLINE_MS)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function waitForPort() {
  return new Promise((resolve, reject) => {
    const check = () => {
      const m = stderr.match(/DevTools listening on (ws:\/\/\S+)/)
      if (m) return resolve(m[1])
      if (Date.now() - started > 25_000) return reject(new Error('拿不到 DevTools 端口'))
      setTimeout(check, 120)
    }
    check()
  })
}

class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl); this.id = 0; this.pending = new Map(); this.listeners = []
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id); this.pending.delete(msg.id)
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
      } else if (msg.method) {
        this.listeners.forEach((fn) => fn(msg))
      }
    })
  }
  open() { return new Promise((res, rej) => { this.ws.addEventListener('open', res, { once: true }); this.ws.addEventListener('error', rej, { once: true }) }) }
  send(method, params = {}, sessionId) {
    const id = ++this.id
    const payload = { id, method, params }; if (sessionId) payload.sessionId = sessionId
    this.ws.send(JSON.stringify(payload))
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error(method + ' 超时')) } }, 25_000)
    })
  }
  on(fn) { this.listeners.push(fn) }
  close() { try { this.ws.close() } catch {} }
}

const MEASURE = `(() => {
  const vw = window.innerWidth;
  const docW = document.documentElement.scrollWidth;
  const offenders = [];
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const right = r.right + window.scrollX, left = r.left + window.scrollX;
    if (right > vw + 1 || left < -1) {
      offenders.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className || '').toString().trim().slice(0, 80),
        left: Math.round(left), right: Math.round(right), width: Math.round(r.width),
      });
    }
  }
  const seen = new Set();
  const uniq = offenders.filter(o => { const k = o.tag + '|' + o.cls; if (seen.has(k)) return false; seen.add(k); return true; });
  const vis = Array.from(document.querySelectorAll('section')).find(x => x.offsetParent !== null);
  return {
    viewport: { w: vw, h: window.innerHeight },
    docScrollWidth: docW,
    overflowBy: docW - vw,
    horizontalOverflow: docW > vw + 1,
    visibleSection: vis ? (vis.getAttribute('aria-label') || vis.id || vis.className.slice(0, 70)) : null,
    offenderCount: uniq.length,
    offenders: uniq.slice(0, 12),
  };
})()`

async function main() {
  const ws = await waitForPort()
  const cdp = new CDP(ws)
  await cdp.open()
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true })

  const pageErrors = [], consoleErrors = []
  cdp.on((msg) => {
    if (msg.params?.sessionId && msg.params.sessionId !== sessionId) return
    if (msg.method === 'Runtime.exceptionThrown') {
      pageErrors.push(msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text)
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '))
    }
  })

  await cdp.send('Page.enable', {}, sessionId)
  await cdp.send('Runtime.enable', {}, sessionId)
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: true }, sessionId)
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/` }, sessionId)
  await sleep(3000)

  const evalJs = async (expression) => {
    const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId)
    if (exceptionDetails) throw new Error(exceptionDetails.text + ' ' + (exceptionDetails.exception?.description || ''))
    return result.value
  }

  // 首次使用会弹 AI 隐私告知，先关掉，否则挡住后续测量
  const dismissed = await evalJs(`(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('我知道了'));
    if (!btn) return 'none';
    btn.click(); return 'dismissed';
  })()`)
  await sleep(600)

  // 进入工作台
  const entered = await evalJs(`(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('开始探索'));
    if (!btn) return 'no-cta';
    btn.click(); return 'clicked';
  })()`)

  await sleep(1800)

  // 点第 N 个散落导航点
  const navigated = await evalJs(`(() => {
    const nav = document.querySelector('nav[aria-label="探索阶段坐标"]');
    if (!nav) return 'no-nav';
    const btns = nav.querySelectorAll('button');
    if (!btns[${stageIdx}]) return 'no-node';
    btns[${stageIdx}].click();
    return 'clicked-' + btns.length;
  })()`)

  await sleep(2600)

  const measure = await evalJs(MEASURE)
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId)
  writeFileSync(shot, Buffer.from(data, 'base64'))

  console.log(JSON.stringify({ stage: stageIdx, viewport: `${width}x${height}`, dismissed, entered, navigated, screenshot: shot, ...measure, pageErrors, consoleErrors: consoleErrors.slice(0, 3) }, null, 2))

  cdp.close(); chrome.kill('SIGKILL'); clearTimeout(hardStop)
  await sleep(300)
  try { rmSync(profile, { recursive: true, force: true }) } catch {}
  process.exit(0)
}

main().catch((err) => {
  console.error('PROBE FAILED:', err.message)
  try { chrome.kill('SIGKILL') } catch {}
  clearTimeout(hardStop)
  setTimeout(() => { try { rmSync(profile, { recursive: true, force: true }) } catch {}; process.exit(1) }, 300)
})