/**
 * 后端服务配置
 * 统一管理后端API的基础URL和配置
 */

// 从环境变量获取后端URL，如果没有则使用默认值
const getBackendUrl = (): string => {
  // 优先使用环境变量（生产部署必须设置 VITE_BACKEND_URL）
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL
  }
  // 开发环境默认值
  if (import.meta.env.DEV) {
    return 'http://localhost:8080'
  }
  // 生产环境：未设置 VITE_BACKEND_URL 时回退到 localhost（部署时请务必配置）
  return 'http://localhost:8080'
}

export const BACKEND_CONFIG = {
  /** 后端API基础URL */
  BASE_URL: getBackendUrl(),
  
  /** 默认项目ID */
  DEFAULT_PROJECT_ID: '1',
  
  /** API路径前缀 */
  API_PREFIX: '/api/projects',
  
  /** 完整的API基础URL */
  get API_BASE_URL() {
    return `${this.BASE_URL}${this.API_PREFIX}`
  },
  
  /** 请求超时时间（毫秒） - 文件上传需要更长时间 */
  TIMEOUT: 300000, // 5分钟，足够处理大文件（31MB+）
  
  /** 是否启用后端服务（可以通过环境变量控制） */
  get ENABLED() {
    return import.meta.env.VITE_BACKEND_ENABLED !== 'false'
  },
  
  /** 检查后端是否可用 */
  async checkHealth(): Promise<boolean> {
    if (!this.ENABLED) {
      return false
    }
    
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000) // 3秒超时
      
      const response = await fetch(`${this.BASE_URL}/actuator/health`, {
        method: 'GET',
        signal: controller.signal,
      })
      
      clearTimeout(timeoutId)
      return response.ok
    } catch (error) {
      return false
    }
  },
}

export default BACKEND_CONFIG
