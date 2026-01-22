/*
 * @Description: 3D 可视化项目配置（带默认 '/' → '/upload' 重定向）
 */
import { defineBuildConfig } from '@fesjs/fes'
import { templateCompilerOptions } from '@tresjs/core'

// TresJS 的自定义元素检测
const combinedIsCustomElement = (tag) =>
  templateCompilerOptions.template.compilerOptions.isCustomElement(tag)

export default defineBuildConfig({
  mountElementId: 'skypath-app',
  title: 'SkyPath',
  publicPath: './',

  router: {
    mode: 'hash',
  },

  viteVuePlugin: {
    template: {
      compilerOptions: {
        isCustomElement: (tag) => combinedIsCustomElement(tag),
      },
    },
  },

  vite: {
    build: {
      target: 'esnext',
      chunkSizeWarningLimit: 1000,
    },
    css: {
      preprocessorOptions: {
        scss: {
          // SCSS 配置
        },
      },
    },
    server: {
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      host: '0.0.0.0',
    },
  },

  // 路由重定向通过 index.vue 中的 router.replace('/upload') 实现
})
