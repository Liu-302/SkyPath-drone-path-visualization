/**
 * KPI状态管理 Store
 * 
 * 文件作用：
 * - 管理KPI计算的状态和结果
 * - 提供KPI数据的存储和访问接口
 * - 协调KPI计算和可视化组件的交互
 */

import { defineStore } from 'pinia'
import type { KPIMetrics } from '@/features/kpi/types/kpi'

export const useKpiStore = defineStore('kpi', {
  state: () => ({
    /** KPI计算结果 */
    kpiMetrics: null as KPIMetrics | null,
    
    /** 计算状态 */
    calculationStatus: 'idle' as 'idle' | 'calculating' | 'completed' | 'error',
    
    /** 计算进度（0-100） */
    calculationProgress: 0,
    
    /** 计算错误信息 */
    errorMessage: null as string | null,
    
    /** 是否显示KPI面板 */
    showKpiPanel: false,
    
    /** 当前选中的KPI指标 */
    selectedKpi: null as keyof KPIMetrics | null,
  }),

  getters: {
    /** 是否有KPI计算结果 */
    hasKpiResults: (state) => state.kpiMetrics !== null,
    
    /** 是否正在计算 */
    isCalculating: (state) => state.calculationStatus === 'calculating',
    
    /** 是否计算完成 */
    isCompleted: (state) => state.calculationStatus === 'completed',
    
    /** 是否有错误 */
    hasError: (state) => state.calculationStatus === 'error',
    
    /** 获取特定KPI指标的值 */
    getKpiValue: (state) => (kpiName: keyof KPIMetrics) => {
      if (!state.kpiMetrics) return null
      return state.kpiMetrics[kpiName]
    },
    
    /** 获取格式化的KPI显示值 */
    getFormattedKpi: (state) => (kpiName: keyof KPIMetrics) => {
      if (!state.kpiMetrics) return null
      const value = state.kpiMetrics[kpiName]
      
      // 根据不同的KPI类型格式化显示
      switch (kpiName) {
        case 'coverage':
        case 'overlap':
          return `${(Number(value) * 100).toFixed(1)}%`
        case 'pathLength':
          return `${Number(value).toFixed(2)} m`
        case 'flightTime':
          return `${Number(value).toFixed(1)} s`
        case 'energy':
          return `${Number(value).toFixed(2)} Wh`
        default:
          return value
      }
    },
  },

  actions: {
    /**
     * 开始KPI计算
     */
    startCalculation() {
      this.calculationStatus = 'calculating'
      this.calculationProgress = 0
      this.errorMessage = null
      this.kpiMetrics = null
    },

    /**
     * 更新计算进度
     * @param progress 进度值（0-100）
     */
    updateProgress(progress: number) {
      this.calculationProgress = Math.max(0, Math.min(100, progress))
    },

    /**
     * 设置KPI计算结果
     * @param metrics KPI计算结果
     */
    setKpiMetrics(metrics: KPIMetrics) {
      this.kpiMetrics = metrics
      this.calculationStatus = 'completed'
      this.calculationProgress = 100
      this.showKpiPanel = true
    },

    /**
     * 设置计算错误
     * @param message 错误信息
     */
    setError(message: string) {
      this.calculationStatus = 'error'
      this.errorMessage = message
      this.kpiMetrics = null
    },

    /**
     * 重置KPI状态
     */
    reset() {
      this.kpiMetrics = null
      this.calculationStatus = 'idle'
      this.calculationProgress = 0
      this.errorMessage = null
      this.showKpiPanel = false
      this.selectedKpi = null
    },

    /**
     * 显示/隐藏KPI面板
     * @param show 是否显示
     */
    toggleKpiPanel(show?: boolean) {
      this.showKpiPanel = show !== undefined ? show : !this.showKpiPanel
    },

    /**
     * 选择KPI指标
     * @param kpiName KPI指标名称
     */
    selectKpi(kpiName: keyof KPIMetrics) {
      this.selectedKpi = kpiName
    },

    /**
     * 清除KPI选择
     */
    clearKpiSelection() {
      this.selectedKpi = null
    },
  },
})