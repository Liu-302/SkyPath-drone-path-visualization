/**
 * 后端视锥体高亮服务
 * 调用后端API获取可见面数据
 */

interface ViewpointRequest {
  position: { x: number; y: number; z: number }
  direction: { x: number; y: number; z: number }
  up: { x: number; y: number; z: number }
  fov: number
  aspect: number
  near: number
  far: number
}

interface HighlightResult {
  visibleFaceIndices: number[]
  visibleFaceCount: number
  totalFaceCount: number
  coverage: number
  calculationTime: number
  frustumCorners: any
}

import { BACKEND_CONFIG } from '../config/backend.config'

export class BackendHighlightService {
  private static get BASE_URL() {
    return BACKEND_CONFIG.API_BASE_URL
  }
  
  private static get DEFAULT_PROJECT_ID() {
    return BACKEND_CONFIG.DEFAULT_PROJECT_ID
  }

  /** 是否使用后端模式 - 已禁用，因为后端端点已被删除 */
  static useBackend = false

  /**
   * 计算视锥体高亮
   */
  static async calculateHighlight(
    viewpoint: ViewpointRequest,
    projectId: string = this.DEFAULT_PROJECT_ID
  ): Promise<HighlightResult | null> {
    if (!this.useBackend) {
      return null
    }

    try {
      console.log('[后端高亮] 计算视锥体可见面...', viewpoint)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), BACKEND_CONFIG.TIMEOUT)

      const response = await fetch(`${this.BASE_URL}/${projectId}/highlight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ viewpoint }),
        signal: controller.signal,
      })
      
      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`后端高亮失败: ${response.statusText}`)
      }

      const result = await response.json()

      console.log('[后端高亮] 计算完成:', {
        可见面: result.visibleFaceCount,
        总面数: result.totalFaceCount,
        覆盖率: `${(result.coverage * 100).toFixed(2)}%`,
        耗时: `${result.calculationTime}ms`,
      })

      return result
    } catch (error: any) {
      // 只在首次失败时打印详细错误，后续静默降级
      if (this.useBackend) {
        if (error.message?.includes('Failed to fetch') || error.name === 'AbortError') {
          console.warn('[后端高亮] 后端服务不可用，已降级到本地计算')
        } else {
          console.warn('[后端高亮] 请求失败,降级到本地计算:', error)
        }
        this.useBackend = false
      }
      return null
    }
  }
}

export default BackendHighlightService
