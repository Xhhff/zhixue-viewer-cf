// frontend/vite.config.ts

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path' // 1. 导入 path 模块

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      // 2. 添加路径别名配置
      '@': path.resolve(__dirname, './src'),
    },
  },
  // 3. (可选但推荐) 配置开发服务器代理，以便本地开发时能访问后端
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000', // 指向你的本地Flask后端
        changeOrigin: true,
        // 如果你的后端api路径本身不带 /api，可以用这个重写
        // rewrite: (path) => path.replace(/^\/api/, ''), 
      },
    },
  },
})
