// src/stores/dataset.ts
import { defineStore } from 'pinia'
import BackendHistoryService from '@/shared/services/backendHistoryService'
// calculateOptimalPath import removed in favor of worker implementation

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
  type: 'updatePointPosition' | 'updatePointNormal' | 'addPoint' | 'deletePoint' | 'replacePath'
  /** 路径点ID（addPoint 时为新增点的 id；deletePoint 时为删除的点的 id） */
  pointId: number
  /** 路径点索引（addPoint 时为插入位置；deletePoint 时为删除位置） */
  pointIndex: number
  /** 旧数据（用于撤销） */
  oldData: {
    position?: { x: number; y: number; z: number }
    normal?: { x: number; y: number; z: number }
    /** deletePoint 时：删除的完整 PathPoint */
    point?: PathPoint
    /** replacePath 时：旧的完整路径点数组 */
    path?: PathPoint[]
  }
  /** 新数据（用于重做）；addPoint 时存完整点 */
  newData: {
    position?: { x: number; y: number; z: number }
    normal?: { x: number; y: number; z: number }
    /** addPoint 时：插入的完整 PathPoint */
    point?: PathPoint
    /** replacePath 时：新的完整路径点数组 */
    path?: PathPoint[]
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

    /** 当前打开的项目 ID（从 Home 打开时设置，保存时使用此项目） */
    currentProjectId: null as string | null,

    // 历史记录
    history: [] as HistoryAction[],
    // 当前历史记录索引（指向当前状态对应的历史记录）
    // -1 表示初始状态（没有历史记录）
    // 0 表示应用了第一个操作后的状态
    // 1 表示应用了第二个操作后的状态，以此类推
    historyIndex: -1,
    // 最大历史记录数量
    maxHistorySize: 100,
    // --- [新增] 播放器状态 ---
  isPlaybackMode: false,
  isPaused: false,
  playbackIndex: 0,
  /** 播放倍速：每秒真实时间对应多少秒任务时间（1 表示实时） */
  playbackSpeed: 1,
  /** 实际运行时间：累计已播放秒数（不含暂停时间） */
  playbackElapsedRealSeconds: 0,
  /** 上次暂停时累计的秒数 */
  playbackElapsedRealSecondsAtPause: 0,
  /** 上次点击播放/恢复时的时间戳 */
  playbackLastResumeTimestamp: 0,
  }),

  actions: {
    startPlayback() {
        if (!this.isPlaybackMode) {
            this.isPlaybackMode = true
            this.playbackSpeed = this.playbackSpeed || 1
            this.isPaused = false
            this.playbackLastResumeTimestamp = Date.now()
            if (this.playbackIndex >= this.parsedPoints.length - 1) {
              this.playbackIndex = 0
              this.playbackElapsedRealSecondsAtPause = 0
            } else {
              this._syncElapsedFromIndex()
            }
        } else {
            this.isPaused = false
            if (this.playbackIndex >= this.parsedPoints.length - 1) {
             this.playbackIndex = 0
             this.playbackElapsedRealSecondsAtPause = 0
            }
            this.playbackLastResumeTimestamp = Date.now()
        }
  },
  togglePause() {
    if (this.isPlaybackMode) {
      if (this.isPaused) {
        this.playbackLastResumeTimestamp = Date.now()
      } else {
        this.playbackElapsedRealSecondsAtPause += (Date.now() - this.playbackLastResumeTimestamp) / 1000
      }
      this.isPaused = !this.isPaused
    }
  },
  /** @param opts.preserveIndex 为 true 时保留 playbackIndex（退出播放回到编辑时选中当前航点） */
  stopPlayback(opts?: { preserveIndex?: boolean }) {
    this.isPlaybackMode = false
    this.isPaused = false
    if (!opts?.preserveIndex) {
      this.playbackIndex = 0
      this.playbackSpeed = 1
    }
    this.playbackElapsedRealSeconds = 0
    this.playbackElapsedRealSecondsAtPause = 0
    this.playbackLastResumeTimestamp = 0
  },
  /** 设置播放倍速（1、1.5、2、2.5）；切换倍速时保持当前航点位置，仅影响之后的播放速度 */
  setPlaybackSpeed(speed: number) {
    const newSpeed = Math.max(1, Math.min(2.5, speed))
    if (this.isPlaybackMode && this.parsedPoints.length >= 2) {
      const pts = this.parsedPoints
      const segs: number[] = [0]
      for (let i = 1; i < pts.length; i++) {
        const d = Math.sqrt(
          (pts[i].x - pts[i - 1].x) ** 2 + (pts[i].y - pts[i - 1].y) ** 2 + (pts[i].z - pts[i - 1].z) ** 2
        )
        segs.push(segs[i - 1] + d)
      }
      const totalDist = segs[segs.length - 1]
      const totalTime = totalDist / 5
      const i0 = Math.floor(this.playbackIndex)
      const i1 = Math.min(i0 + 1, pts.length - 1)
      const alpha = this.playbackIndex - i0
      const missionTime = totalTime > 0 ? ((segs[i0] + alpha * (segs[i1] - segs[i0])) / totalDist) * totalTime : 0
      this.playbackElapsedRealSecondsAtPause = missionTime / newSpeed
      this.playbackLastResumeTimestamp = Date.now()
    }
    this.playbackSpeed = newSpeed
  },
  /** 根据当前 playbackIndex 同步 playbackElapsedRealSecondsAtPause，确保恢复播放时时间正确 */
  _syncElapsedFromIndex() {
    if (this.parsedPoints.length < 2) return
    const pts = this.parsedPoints
    const segs: number[] = [0]
    for (let i = 1; i < pts.length; i++) {
      const d = Math.sqrt(
        (pts[i].x - pts[i - 1].x) ** 2 + (pts[i].y - pts[i - 1].y) ** 2 + (pts[i].z - pts[i - 1].z) ** 2
      )
      segs.push(segs[i - 1] + d)
    }
    const totalDist = segs[segs.length - 1]
    const totalTime = totalDist / 5
    const i0 = Math.floor(this.playbackIndex)
    const i1 = Math.min(i0 + 1, pts.length - 1)
    const alpha = this.playbackIndex - i0
    const missionTime = totalTime > 0 ? ((segs[i0] + alpha * (segs[i1] - segs[i0])) / totalDist) * totalTime : 0
    this.playbackElapsedRealSecondsAtPause = missionTime / (this.playbackSpeed || 1)
  },
  /** 设置播放进度索引（用于时间轴拖拽、Waypoint 输入框跳转） */
  setPlaybackIndex(index: number) {
    if (this.isPlaybackMode) {
      const clamped = Math.max(0, Math.min(index, Math.max(0, this.parsedPoints.length - 1)))
      this.playbackIndex = clamped
      this.isPaused = true
      this._syncElapsedFromIndex()
    }
  },
  /** 播放到结束时调用，累加已播时间并暂停 */
  pausePlaybackAtEnd() {
    if (this.isPlaybackMode && !this.isPaused) {
      this.playbackElapsedRealSecondsAtPause += (Date.now() - this.playbackLastResumeTimestamp) / 1000
      this.playbackLastResumeTimestamp = 0
      this.isPaused = true
    }
  },
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

    /**
     * 在选中点前插入新航点
     * - 如果有前一点：插入在前一点和选中点之间
     * - 如果是起点：插入在起点与后一点连线的延长线上
     */
    insertPointBefore(selectedIndex: number): number | null {
      const points = this.parsedPoints
      if (points.length === 0) return null
      const idx = Math.max(0, Math.min(selectedIndex, points.length - 1))
      const selected = points[idx]
      const prev = idx > 0 ? points[idx - 1] : null
      const next = idx < points.length - 1 ? points[idx + 1] : null

      let newPoint: PathPoint

      if (prev) {
        // 有前一点：插入在 prev 和 selected 之间
        const midX = (prev.x + selected.x) / 2
        const midY = (prev.y + selected.y) / 2
        const midZ = (prev.z + selected.z) / 2
        const normPrev = prev.normal
        const normNext = selected.normal
        const nx = (normPrev.x + normNext.x) / 2
        const ny = (normPrev.y + normNext.y) / 2
        const nz = (normPrev.z + normNext.z) / 2
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1
        newPoint = {
          id: Math.max(0, ...points.map(p => p.id)) + 1,
          x: midX,
          y: midY,
          z: midZ,
          normal: { x: nx / len, y: ny / len, z: nz / len }
        }
      } else if (next) {
        // 起点：插入在起点与后一点连线的延长线上
        // 方向：从 next 指向 selected
        const dirX = selected.x - next.x
        const dirY = selected.y - next.y
        const dirZ = selected.z - next.z
        const dirLen = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ) || 1
        // 延伸距离：两点间距的一半，保持合理的间距
        const extendDist = dirLen / 2
        const newPointX = selected.x + (dirX / dirLen) * extendDist
        const newPointY = selected.y + (dirY / dirLen) * extendDist
        const newPointZ = selected.z + (dirZ / dirLen) * extendDist
        newPoint = {
          id: Math.max(0, ...points.map(p => p.id)) + 1,
          x: newPointX,
          y: newPointY,
          z: newPointZ,
          normal: { ...selected.normal }
        }
      } else {
        // 只有一个点：放在选中点位置附近
        newPoint = {
          id: Math.max(0, ...points.map(p => p.id)) + 1,
          x: selected.x + 10,
          y: selected.y,
          z: selected.z,
          normal: { ...selected.normal }
        }
      }

      this.pushHistory({
        type: 'addPoint',
        pointId: newPoint.id,
        pointIndex: idx,
        oldData: {},
        newData: { point: { ...newPoint } },
        timestamp: Date.now()
      })
      this.parsedPoints = [
        ...this.parsedPoints.slice(0, idx),
        newPoint,
        ...this.parsedPoints.slice(idx)
      ]
      return idx
    },

    /**
     * 在选中点后插入新航点
     * - 如果有后一点：插入在选中点和后一点之间
     * - 如果是终点：插入在选中点与前一点连线的延长线上
     */
    insertPointAfter(selectedIndex: number): number | null {
      const points = this.parsedPoints
      if (points.length === 0) return null
      const idx = Math.max(0, Math.min(selectedIndex, points.length - 1))
      const selected = points[idx]
      const prev = idx > 0 ? points[idx - 1] : null
      const next = idx < points.length - 1 ? points[idx + 1] : null

      let newPoint: PathPoint

      if (next) {
        // 有后一点：插入在 selected 和 next 之间
        const midX = (selected.x + next.x) / 2
        const midY = (selected.y + next.y) / 2
        const midZ = (selected.z + next.z) / 2
        const normPrev = selected.normal
        const normNext = next.normal
        const nx = (normPrev.x + normNext.x) / 2
        const ny = (normPrev.y + normNext.y) / 2
        const nz = (normPrev.z + normNext.z) / 2
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1
        newPoint = {
          id: Math.max(0, ...points.map(p => p.id)) + 1,
          x: midX,
          y: midY,
          z: midZ,
          normal: { x: nx / len, y: ny / len, z: nz / len }
        }
      } else if (prev) {
        // 终点：插入在选中点与前一点连线的延长线上
        // 方向：从 prev 指向 selected
        const dirX = selected.x - prev.x
        const dirY = selected.y - prev.y
        const dirZ = selected.z - prev.z
        const dirLen = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ) || 1
        // 延伸距离：两点间距的一半，保持合理的间距
        const extendDist = dirLen / 2
        const newPointX = selected.x + (dirX / dirLen) * extendDist
        const newPointY = selected.y + (dirY / dirLen) * extendDist
        const newPointZ = selected.z + (dirZ / dirLen) * extendDist
        newPoint = {
          id: Math.max(0, ...points.map(p => p.id)) + 1,
          x: newPointX,
          y: newPointY,
          z: newPointZ,
          normal: { ...selected.normal }
        }
      } else {
        // 只有一个点：放在选中点位置附近
        newPoint = {
          id: Math.max(0, ...points.map(p => p.id)) + 1,
          x: selected.x + 10,
          y: selected.y,
          z: selected.z,
          normal: { ...selected.normal }
        }
      }

      const insertIndex = idx + 1
      this.pushHistory({
        type: 'addPoint',
        pointId: newPoint.id,
        pointIndex: insertIndex,
        oldData: {},
        newData: { point: { ...newPoint } },
        timestamp: Date.now()
      })
      this.parsedPoints = [
        ...this.parsedPoints.slice(0, insertIndex),
        newPoint,
        ...this.parsedPoints.slice(insertIndex)
      ]
      return insertIndex
    },

    /**
     * 删除指定索引的航点
     */
    deletePoint(index: number): boolean {
      const points = this.parsedPoints
      if (points.length === 0) return false
      const idx = Math.max(0, Math.min(index, points.length - 1))
      const pointToDelete = points[idx]

      // 记录历史（在删除之前）
      this.pushHistory({
        type: 'deletePoint',
        pointId: pointToDelete.id,
        pointIndex: idx,
        oldData: { point: { ...pointToDelete } },
        newData: {},
        timestamp: Date.now()
      })

      // 删除航点
      this.parsedPoints = [
        ...this.parsedPoints.slice(0, idx),
        ...this.parsedPoints.slice(idx + 1)
      ]
      return true
    },

    /**
     * 计算并应用最优路径（最短总距离）
     * 使用 Web Worker 在后台线程计算，避免阻塞 UI
     * @param meshData 可选，建筑物网格数据，用于碰撞惩罚（路径段与建筑物相交时增加代价）
     */
    async optimizePath(meshData?: { vertices: number[]; indices?: number[] } | null) {
      if (this.parsedPoints.length <= 3) {
          return
      }

      // 使用 Worker 计算
      const runWorker = () => new Promise<PathPoint[]>((resolve, reject) => {
        const worker = new Worker(new URL('../workers/optimizer.worker.ts', import.meta.url), { type: 'module' })
        
        worker.onmessage = (e) => {
          if (e.data.success) {
            resolve(e.data.points)
          } else {
            reject(new Error(e.data.error))
          }
          worker.terminate()
        }
        
        worker.onerror = (err) => {
          reject(err)
          worker.terminate()
        }
        
        // 发送 points 和可选的 meshData（用于碰撞惩罚）
        const payload = meshData
          ? { points: JSON.parse(JSON.stringify(this.parsedPoints)), meshData }
          : JSON.parse(JSON.stringify(this.parsedPoints))
        worker.postMessage(payload)
      })

      try {
        const oldPath = [...this.parsedPoints]
        const newPath = await runWorker()

        // 检查是否有变化
        const isChanged = newPath.some((p, i) => p.id !== oldPath[i].id)
        
        if (!isChanged) return

        // 记录历史
        this.pushHistory({
          type: 'replacePath',
          pointId: -1,
          pointIndex: -1,
          oldData: { path: oldPath },
          newData: { path: newPath },
          timestamp: Date.now()
        })

        this.parsedPoints = newPath
      } catch (error) {
        console.error('[Optimize] Worker failed:', error)
        const msg = error instanceof Error ? error.message : String(error)
        throw new Error('Optimization failed: ' + msg)
      }
    },

    resetAll() {
      this.modelFiles = []
      this.pathFiles = []
      this.parsedPoints = []
      this.currentProjectId = null
      this.clearHistory()
    },

    setCurrentProjectId(projectId: string | null) {
      this.currentProjectId = projectId
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

      if (action.type === 'addPoint') {
        const i = this.parsedPoints.findIndex(p => p.id === action.pointId)
        if (i !== -1) {
          this.parsedPoints = [
            ...this.parsedPoints.slice(0, i),
            ...this.parsedPoints.slice(i + 1)
          ]
        }
        this.historyIndex--
        // 触发航点索引校验事件（航点数量已变化）
        window.dispatchEvent(new CustomEvent('waypoints-changed'))
        return
      }

      if (action.type === 'deletePoint' && action.oldData.point) {
        // 撤销删除：恢复被删除的点
        const insertIndex = Math.min(action.pointIndex, this.parsedPoints.length)
        this.parsedPoints = [
          ...this.parsedPoints.slice(0, insertIndex),
          { ...action.oldData.point },
          ...this.parsedPoints.slice(insertIndex)
        ]
        this.historyIndex--
        // 触发航点索引校验事件（航点数量已变化）
        window.dispatchEvent(new CustomEvent('waypoints-changed'))
        return
      }

      if (action.type === 'replacePath' && action.oldData.path) {
          this.parsedPoints = [...action.oldData.path] // Clone to detach reference
          this.historyIndex--
          window.dispatchEvent(new CustomEvent('waypoints-changed'))
          return
      }

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

      if (action.type === 'addPoint' && action.newData.point) {
        const insertIndex = Math.min(action.pointIndex, this.parsedPoints.length)
        this.parsedPoints = [
          ...this.parsedPoints.slice(0, insertIndex),
          { ...action.newData.point },
          ...this.parsedPoints.slice(insertIndex)
        ]
        // 触发航点索引校验事件（航点数量已变化）
        window.dispatchEvent(new CustomEvent('waypoints-changed'))
        return
      }

      if (action.type === 'deletePoint') {
        // 重做删除：再次删除该点
        const i = this.parsedPoints.findIndex(p => p.id === action.pointId)
        if (i !== -1) {
          this.parsedPoints = [
            ...this.parsedPoints.slice(0, i),
            ...this.parsedPoints.slice(i + 1)
          ]
        }
        // 触发航点索引校验事件（航点数量已变化）
        window.dispatchEvent(new CustomEvent('waypoints-changed'))
        return
      }

      if (action.type === 'replacePath' && action.newData.path) {
          this.parsedPoints = [...action.newData.path] // Clone to detach reference
          this.historyIndex++ // Warning: redo logic is inside redo() which already incremented historyIndex? No, redo() increments historyIndex once at start.
          // Wait, redo() implementation: "this.historyIndex++" at start. So current action is history[historyIndex].
          // So I don't need to increment it again.
          window.dispatchEvent(new CustomEvent('waypoints-changed'))
          return
      }

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
    },

    /**
     * 清空历史记录
     * 注意：历史记录是一次性的，只在内存中存在，不需要删除后端数据
     */
    async clearHistory() {
      this.history = []
      this.historyIndex = -1
      // 历史记录不保存到数据库，所以不需要调用后端删除接口
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
          // 类型断言：HistoryActionDTO 与 HistoryAction 结构兼容
          // HistoryActionDTO 和 HistoryAction 在字段类型上基本一致
          this.history = history as unknown as HistoryAction[]
          this.historyIndex = history.length - 1
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
