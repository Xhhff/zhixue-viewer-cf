// src/main.ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

import App from './App.vue' // 确保这里导入的是 App.vue
import router from './router' // 确保这里导入了 router

const app = createApp(App) // 确保这里使用的是 App

app.use(createPinia())
app.use(router) // 👈 这一行至关重要，它告诉 Vue 使用我们的路由配置
app.use(ElementPlus)

app.mount('#app')
