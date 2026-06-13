import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [tailwindcss(), autoprefixer()],
    },
  },
  server: {
    host: true, // 监听 0.0.0.0，云端开发环境(CNB)端口转发才能访问
    allowedHosts: ['.cnb.run'], // 放行 CNB 云端转发域名(*.cnb.run)
    proxy: {
      '/ws': {
        target: 'http://localhost:3001',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
