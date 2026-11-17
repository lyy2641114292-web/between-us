import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // 固定端口；若被占用则直接报错而不是静默换端口，
    // 避免打开错项目的页面（本机 5173 常被其他项目占用）
    port: 5200,
    strictPort: true,
    host: '127.0.0.1',
    open: false,
    proxy: {
      // 前端所有 /api 请求转发到后端，浏览器里不出现密钥
      '/api': {
        target: 'http://127.0.0.1:8788',
        changeOrigin: true,
      },
    },
  },
})
