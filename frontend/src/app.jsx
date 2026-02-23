/*
 * @Description: 3D 可视化项目 - 简化的核心版本
 */
import { defineRuntimeConfig } from '@fesjs/fes'
import Tres from '@tresjs/core'
import { createPinia, setActivePinia } from 'pinia'
import '@/styles/theme.css' // Global Theme

export default defineRuntimeConfig({
    // 配置可以继续写在这里
})

export function onAppCreated({ app }) {
    // 关键：注册 Pinia
    const pinia = createPinia()
    app.use(pinia)
    // 强制设置活动 Pinia 实例，解决可能的多实例/上下文丢失问题
    setActivePinia(pinia)

    // 注册 TresJS
    app.use(Tres)
}

/** Route guard: require login for protected pages */
export function onRouterCreated({ router }) {
    const publicPaths = ['/Login']
    router.beforeEach(async (to, from, next) => {
        const isPublic = publicPaths.includes(to.path)
        const { useAuthStore } = await import('@/stores/auth')
        const store = useAuthStore()
        if (!isPublic && !store.isLoggedIn) {
            next({ path: '/Login', query: { redirect: to.fullPath } })
        } else if (to.path === '/Login' && store.isLoggedIn) {
            const redirect = to.query.redirect
            next({ path: (typeof redirect === 'string' ? redirect : '/Home') })
        } else {
            next()
        }
    })
}