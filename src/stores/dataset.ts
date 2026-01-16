// src/stores/dataset.ts
import { defineStore } from 'pinia'

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

export const useDatasetStore = defineStore('dataset', {
  state: () => ({
    // 模型&路径支持多次导入
    modelFiles: [] as File[],
    pathFiles: [] as File[],

    // 解析出的路径点
    parsedPoints: [] as PathPoint[],
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

    resetAll() {
      this.modelFiles = []
      this.pathFiles = []
      this.parsedPoints = []
    },
  },
})
