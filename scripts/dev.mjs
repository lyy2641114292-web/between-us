// ============================================================
// 开发启动脚本：同时拉起后端(8788) 与前端(5200)
// 不引入 concurrently，用 Node 原生 child_process
//
// 注意：项目路径含空格（"claude code"），
// 因此 Windows 下必须用 shell 并把命令拼成单个字符串，
// 不能把 args 数组交给 shell:true（会被空格拆开）。
// ============================================================
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const isWin = process.platform === 'win32'

const children = []
let shuttingDown = false

function run(name, commandLine) {
  const child = spawn(commandLine, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  })

  child.on('exit', (code) => {
    if (shuttingDown) return
    console.log(`\n  [${name}] 进程退出（code ${code}）`)
    shutdown(code ?? 1)
  })

  children.push(child)
  return child
}

function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  for (const c of children) {
    try {
      if (isWin && c.pid) {
        // Windows 下需要杀整个进程树
        spawn('taskkill', ['/pid', String(c.pid), '/f', '/t'], { stdio: 'ignore' })
      } else {
        c.kill()
      }
    } catch {
      /* 忽略 */
    }
  }
  setTimeout(() => process.exit(code), 400)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

console.log('')
console.log('  ============================================')
console.log('     Between Us  ·  正在启动')
console.log('  ============================================')
console.log('')

// 先起后端，让密钥状态先打印出来
run('server', `"${process.execPath}" "server/index.mjs"`)

setTimeout(() => {
  run('web', 'npx vite')
}, 900)
