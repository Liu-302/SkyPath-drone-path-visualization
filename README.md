# SkyPath

一个基于 Vue 3 + TresJS + Three.js + Fes 的 3D 可视化项目。参考 TvT.js 的工程架构思路,实现了无人机轨迹可视化与建筑模型加载功能:

- 使用 Fes 框架的运行时扩展模式(`src/app.jsx`)组织首屏与路由
- 使用 TresJS 的声明式组件范式编写三维场景(`<TresCanvas>`)
- 使用 three-stdlib 工具链(`OBJLoader`)加载建筑模型
- 使用 TresJS 生态组件库 Cientos(`OrbitControls`)实现相机控制
- 使用 Vite 的公共资源组织方式(静态资源放在 `public/`,原样拷贝)

## 特性

- 参考 TvT.js 的工程架构,开发体验一致
- 现代技术栈:Vue 3 + TresJS(声明式 Three) + Fes(工程与运行时)
- 支持无人机轨迹上传与可视化
- 支持建筑模型(OBJ 格式)加载与显示
- 提供航点交互与相机视锥体可视化
- 内置 KPI 指标计算(路径长度、覆盖率、能耗等)

## 技术栈

### 核心框架
- **Vue 3.5.21** - 现代前端框架,Composition API
- **TypeScript 5.9.2** - 类型安全的 JavaScript 超集

### 3D 渲染引擎
- **Three.js 0.160.0** - WebGL 3D 图形库
- **TresJS 5.1.0** - Vue 3 的声明式 Three.js 组件
- **@tresjs/cientos 5.1.0** - TresJS 生态组件库

### 状态管理与路由
- **Pinia 3.0.4** - Vue 3 状态管理库
- **Vue Router 4** - Vue 官方路由管理器(由 Fes 集成)

### 工具库
- **three-stdlib 2.36.0** - Three.js 标准工具库(OBJLoader 等)

### 样式与构建
- **Sass 1.49.11** - CSS 预处理器
- **Fes 3.1.17** - 基于 Vite 的前端工程化框架,提供开发、构建、路由、状态管理等完整解决方案


## 快速开始

环境要求:
- Node >= 18.18
- Yarn 1.22.x(建议 1.22.22)

使用步骤:
```bash
# 1) 安装依赖
yarn install

# 2) 本地开发
yarn dev
# 控制台会输出访问地址,例如:http://localhost:8000/

# 3) 构建生产版本
yarn build
```

## 功能说明

### 数据上传
- 支持上传建筑模型文件(OBJ 格式)
- 支持上传无人机轨迹文件(CSV 格式)

### 可视化功能
- 3D 场景中渲染建筑模型
- 路径点与路径线段可视化
- 支持路径点点击交互
- 相机视锥体可视化
- 航点视角切换

### KPI 指标
- 路径长度计算
- 覆盖率分析
- 重叠率检测
- 能耗估算
- 碰撞检测

## 许可证

本项目基于 Apache 2.0 协议开源。
