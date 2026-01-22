/**
 * 后端历史记录服务
 * 注意：历史记录是一次性的，不保存到数据库
 * 历史记录只在当前会话的内存中有效，用户关闭网站后就会消失
 * 此服务中的保存和加载方法已废弃，仅保留用于兼容
 */

export interface HistoryActionDTO {
  type: 'updatePointPosition' | 'updatePointNormal'
  pointId: number
  pointIndex: number
  oldData?: {
    position?: { x: number; y: number; z: number }
    normal?: { x: number; y: number; z: number }
  }
  newData?: {
    position?: { x: number; y: number; z: number }
    normal?: { x: number; y: number; z: number }
  }
  timestamp: number
}

import { BACKEND_CONFIG } from '../config/backend.config'

export class BackendHistoryService {
  private static get BASE_URL() {
    return BACKEND_CONFIG.API_BASE_URL
  }
  
  private static get DEFAULT_PROJECT_ID() {
    return BACKEND_CONFIG.DEFAULT_PROJECT_ID
  }

  /** 是否使用后端模式 */
  static useBackend = BACKEND_CONFIG.ENABLED

  /**
   * 保存历史记录到后端
   * 注意：历史记录是一次性的，不保存到数据库，此方法已废弃
   * 保留此方法仅用于兼容，但不会实际调用
   */
  static async saveHistory(
    actions: HistoryActionDTO[],
    projectId: string = this.DEFAULT_PROJECT_ID
  ): Promise<void> {
    // 历史记录不保存到数据库，所以不需要保存到后端
    // 历史记录只在当前会话的内存中有效
  }

  /**
   * 从后端加载历史记录
   * 注意：历史记录是一次性的，不保存到数据库，此方法已废弃
   * 保留此方法仅用于兼容，但不会实际调用
   */
  static async loadHistory(
    projectId: string = this.DEFAULT_PROJECT_ID
  ): Promise<HistoryActionDTO[] | null> {
    // 历史记录不保存到数据库，所以不需要从后端加载
    // 返回空数组表示没有历史记录
    return []
  }

  /**
   * 删除项目的历史记录
   */
  static async deleteHistory(
    projectId: string = this.DEFAULT_PROJECT_ID
  ): Promise<void> {
    if (!this.useBackend) {
      return
    }

    try {
      console.log('[后端历史] 删除历史记录...')

      const response = await fetch(`${this.BASE_URL}/${projectId}/history`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(`删除历史记录失败: ${response.statusText}`)
      }

      console.log('[后端历史] 历史记录删除成功')
    } catch (error) {
      console.warn('[后端历史] 删除失败:', error)
    }
  }
}

export default BackendHistoryService
