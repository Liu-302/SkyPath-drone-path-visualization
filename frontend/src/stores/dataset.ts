// src/stores/dataset.ts
import { defineStore } from 'pinia'
import BackendHistoryService from '@/shared/services/backendHistoryService'

/**
 * 路径点接口
 * 对应JSON文件中的数据结构：{ id, position: {x,y,z}, normal: {x,y,z} }
 */
export interface PathPoint {
  /** 采样点编号 */
  id: number
  /** 位置坐标 */
  x: number
  y: number
  z: number
  /** 相机朝向向量（归一化） */
  normal: {
    x: number
    y: number
    z: number
  }
}

/**
 * 历史记录操作类型
 */
export interface HistoryAction {
  /** 操作类型 */
  type: 'updatePointPosition' | 'updatePointNormal'
  /** 路径点ID */
  pointId: number
  /** 路径点索引 */
  pointIndex: number
  /** 旧数据（用于撤销） */
  oldData: {
    position?: { x: number; y: number; z: number }
    normal?: { x: number; y: number; z: number }
  }
  /** 新数据（用于重做） */
  newData: {
    position?: { x: number; y: number; z: number }
    normal?: { x: number; y: number; z: number }
  }
  /** 操作时间戳 */
  timestamp: number
}

export const useDatasetStore = defineStore('dataset', {
  state: () => ({
    // 模型&路径支持多次导入
    modelFiles: [] as File[],
    pathFiles: [] as File[],

    // 解析出的路径点
    parsedPoints: [] as PathPoint[],

    // 历史记录
    history: [] as HistoryAction[],
    // 当前历史记录索引（指向当前状态对应的历史记录）
    // -1 表示初始状态（没有历史记录）
    // 0 表示应用了第一个操作后的状态
    // 1 表示应用了第二个操作后的状态，以此类推
    historyIndex: -1,
    // 最大历史记录数量
    maxHistorySize: 100,
  }),

  actions: {
    // 模型文件
    addModelFiles(files: File[]) {
      // 同名覆盖：先去重再追加
      const names = new Set(this.modelFiles.map(f => f.name))
      const append = files.filter(f => !names.has(f.name))
      this.modelFiles.push(...append)
    },
    removeModelFile(name: string) {
      this.modelFiles = this.modelFiles.filter(f => f.name !== name)
    },

    // 路径文件（允许多个，但通常可视化取最后一次解析结果）
    addPathFiles(files: File[]) {
      const names = new Set(this.pathFiles.map(f => f.name))
      const append = files.filter(f => !names.has(f.name))
      this.pathFiles.push(...append)
    },
    setPathFiles(files: File[]) {
      this.pathFiles = files
    },
    removePathFile(name: string) {
      this.pathFiles = this.pathFiles.filter(f => f.name !== name)
    },

    // 路径点
    setParsedPoints(points: PathPoint[]) {
      this.parsedPoints = points
    },
    
    /** 根据id获取路径点 */
    getPointById(id: number): PathPoint | undefined {
      return this.parsedPoints.find(p => p.id === id)
    },
    
    /** 根据索引获取路径点 */
    getPointByIndex(index: number): PathPoint | undefined {
      return this.parsedPoints[index]
    },

    /**
     * 更新单个路径点的数据
     * @param id 路径点ID
     * @param updates 要更新的字段
     */
    updatePoint(id: number, updates: Partial<Omit<PathPoint, 'id'>>) {
      const index = this.parsedPoints.findIndex(p => p.id === id)
      if (index !== -1) {
        // 创建新数组触发响应式
        this.parsedPoints = [
          ...this.parsedPoints.slice(0, index),
          { ...this.parsedPoints[index], ...updates },
          ...this.parsedPoints.slice(index + 1)
        ]
      }
    },

    /**
     * 更新路径点的位置坐标
     * @param id 路径点ID
     * @param x X坐标
     * @param y Y坐标
     * @param z Z坐标
     */
    updatePointPosition(id: number, x: number, y: number, z: number) {
      const index = this.parsedPoints.findIndex(p => p.id === id)
      if (index === -1) return

      // 记录历史（在更新之前）
      const oldPoint = this.parsedPoints[index]
      this.pushHistory({
        type: 'updatePointPosition',
        pointId: id,
        pointIndex: index,
        oldData: {
          position: { x: oldPoint.x, y: oldPoint.y, z: oldPoint.z }
        },
        newData: {
          position: { x, y, z }
        },
        timestamp: Date.now()
      })

      this.updatePoint(id, { x, y, z })
    },

    /**
     * 更新路径点的相机朝向向量
     * @param id 路径点ID
     * @param normal 归一化的朝向向量
     */
    updatePointNormal(id: number, normal: { x: number; y: number; z: number }) {
      const index = this.parsedPoints.findIndex(p => p.id === id)
      if (index === -1) return

      // 记录历史（在更新之前）
      const oldPoint = this.parsedPoints[index]
      this.pushHistory({
        type: 'updatePointNormal',
        pointId: id,
        pointIndex: index,
        oldData: {
          normal: { x: oldPoint.normal.x, y: oldPoint.normal.y, z: oldPoint.normal.z }
        },
        newData: {
          normal: { ...normal }
        },
        timestamp: Date.now()
      })

      this.updatePoint(id, { normal })
    },

    resetAll() {
      this.modelFiles = []
      this.pathFiles = []
      this.parsedPoints = []
      this.clearHistory()
    },

    /**
     * 添加历史记录
     */
    async pushHistory(action: HistoryAction) {
      // 如果当前不在历史记录末尾，删除当前位置之后的所有记录
      if (this.historyIndex < this.history.length - 1) {
        this.history = this.history.slice(0, this.historyIndex + 1)
      }

      // 添加新记录
      this.history.push(action)
      this.historyIndex++

      // 限制历史记录数量
      if (this.history.length > this.maxHistorySize) {
        this.history.shift()
        this.historyIndex--
      }

      // 调试日志
      console.log('[History] pushHistory:', {
        historyLength: this.history.length,
        historyIndex: this.historyIndex,
        canUndo: this.canUndo(),
        canRedo: this.canRedo(),
        action: action.type
      })

      // 注意：历史记录不保存到数据库
      // 历史记录是一次性的，只在当前会话中有效，用户关闭网站后就会消失
    },

    /**
     * 撤销操作
     * 将当前状态回退到前一个历史记录的状态
     */
    undo() {
      if (this.historyIndex < 0) {
        console.warn('No undo operation available')
        return
      }

      const action = this.history[this.historyIndex]
      const point = this.parsedPoints[action.pointIndex]

      if (!point) {
        console.warn('Waypoint does not exist, cannot undo')
        return
      }

      // 恢复旧数据（撤销当前操作）
      if (action.oldData.position) {
        point.x = action.oldData.position.x
        point.y = action.oldData.position.y
        point.z = action.oldData.position.z
      }

      if (action.oldData.normal) {
        point.normal = { ...action.oldData.normal }
      }

      // 触发响应式更新
      this.parsedPoints = [...this.parsedPoints]

      // 回退到前一个状态
      this.historyIndex--

      // 调试日志
      console.log('[History] undo:', {
        historyLength: this.history.length,
        historyIndex: this.historyIndex,
        canUndo: this.canUndo(),
        canRedo: this.canRedo()
      })
    },

    /**
     * 重做操作
     * 将当前状态前进到下一个历史记录的状态
     */
    redo() {
      if (this.historyIndex >= this.history.length - 1) {
        console.warn('No redo operation available')
        return
      }

      // 先前进到下一个状态
      this.historyIndex++
      const action = this.history[this.historyIndex]
      const point = this.parsedPoints[action.pointIndex]

      if (!point) {
        console.warn('Waypoint does not exist, cannot redo')
        return
      }

      // 应用新数据（重做下一个操作）
      if (action.newData.position) {
        point.x = action.newData.position.x
        point.y = action.newData.position.y
        point.z = action.newData.position.z
      }

      if (action.newData.normal) {
        point.normal = { ...action.newData.normal }
      }

      // 触发响应式更新
      this.parsedPoints = [...this.parsedPoints]

      // 调试日志
      console.log('[History] redo:', {
        historyLength: this.history.length,
        historyIndex: this.historyIndex,
        canUndo: this.canUndo(),
        canRedo: this.canRedo()
      })
    },

    /**
     * 清空历史记录
     */
    async clearHistory() {
      this.history = []
      this.historyIndex = -1

      // 删除后端的历史记录
      if (BackendHistoryService.useBackend) {
        BackendHistoryService.deleteHistory('1').catch(err => {
          console.warn('[Store] 删除后端历史记录失败:', err)
        })
      }
    },

    /**
     * 从后端加载历史记录
     */
    async loadHistoryFromBackend(projectId: string = '1') {
      if (!BackendHistoryService.useBackend) {
        return
      }

      try {
        const history = await BackendHistoryService.loadHistory(projectId)
        if (history && history.length > 0) {
          this.history = history
          this.historyIndex = history.length - 1
          console.log(`[Store] 从后端加载了 ${history.length} 条历史记录`)
        }
        // 如果没有历史记录，静默处理（不打印日志）
        // 因为新导入的数据确实没有历史记录，这是正常情况
      } catch (error) {
        // 静默处理错误，不打印警告
        // 因为新导入的数据确实没有历史记录，这是正常情况
      }
    },

    /**
     * 检查是否可以撤销
     */
    canUndo(): boolean {
      return this.historyIndex >= 0
    },

    /**
     * 检查是否可以重做
     */
    canRedo(): boolean {
      return this.historyIndex < this.history.length - 1
    },
  },
})
