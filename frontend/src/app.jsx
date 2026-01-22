/*
 * @Description: 3D 可视化项目 - 简化的核心版本
 */
import { defineRuntimeConfig } from '@fesjs/fes'
import Tres from '@tresjs/core'
import { createPinia } from 'pinia'
import '@/styles/theme.css' // Global Theme

export default defineRuntimeConfig({
    // 配置可以继续写在这里
})

export function onAppCreated({ app }) {
    // 注册 TresJS
    app.use(Tres)

    // 关键：注册 Pinia
    const pinia = createPinia()
    app.use(pinia)
}