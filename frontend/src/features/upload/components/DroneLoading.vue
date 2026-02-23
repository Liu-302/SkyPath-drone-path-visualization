<template>
  <div v-if="visible" class="loading-overlay" :class="{ 'loading-overlay-dimmed': dimmed }">
    <div class="loading-container">
      <!-- 无人机主体 -->
      <div class="drone-body">
        <!-- 四个机臂 -->
        <div class="drone-arm arm-1"></div>
        <div class="drone-arm arm-2"></div>
        <div class="drone-arm arm-3"></div>
        <div class="drone-arm arm-4"></div>
        
        <!-- 四个旋翼 - 俯视圆形 -->
        <div class="rotor rotor-1">
          <div class="rotor-disc"></div>
        </div>
        <div class="rotor rotor-2">
          <div class="rotor-disc"></div>
        </div>
        <div class="rotor rotor-3">
          <div class="rotor-disc"></div>
        </div>
        <div class="rotor rotor-4">
          <div class="rotor-disc"></div>
        </div>
        
        <!-- 中心机身 -->
        <div class="drone-center"></div>
      </div>
      <p class="loading-text">{{ loadingText }}</p>
      <div v-if="showProgress" class="loading-progress-container">
        <span class="progress-text">{{ progress }}%</span>
        <div class="loading-progress">
          <div class="progress-bar-fill" :style="{ width: progress + '%' }"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  visible: boolean
  progress?: number
  /** 是否显示进度条，默认 true */
  showProgress?: boolean
  /** 加载文案，默认 "Loading Data..." */
  loadingText?: string
  /** 是否使用半透明背景（用于覆盖在场景上），默认 false */
  dimmed?: boolean
}

withDefaults(defineProps<Props>(), {
  progress: 0,
  showProgress: true,
  loadingText: 'Loading Data...',
  dimmed: false,
})
</script>

<style scoped>
/* Loading Overlay - 无人机主题 */
.loading-overlay { 
  position: fixed; 
  inset: 0; 
  display: flex; 
  flex-direction: column; 
  justify-content: center; 
  align-items: center; 
  background: #000000;
  color: var(--text-primary); 
  z-index: 9999;
}

.loading-overlay-dimmed {
  background: rgba(0, 0, 0, 0.75);
  z-index: 9998;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
}

/* 无人机主体 */
.drone-body {
  position: relative;
  width: 100px;
  height: 100px;
  animation: dronePulse 2.5s ease-in-out infinite;
}

/* 机臂 */
.drone-arm {
  position: absolute;
  width: 60px;
  height: 2px;
  background: linear-gradient(90deg, 
    rgba(255, 255, 255, 0.3), 
    rgba(255, 255, 255, 0.12), 
    rgba(255, 255, 255, 0.3)
  );
  top: 50%;
  left: 50%;
  transform-origin: center;
  z-index: 1;
}

.arm-1 { transform: translate(-50%, -50%) rotate(-45deg) translateX(-22px); }
.arm-2 { transform: translate(-50%, -50%) rotate(45deg) translateX(-22px); }
.arm-3 { transform: translate(-50%, -50%) rotate(-135deg) translateX(-22px); }
.arm-4 { transform: translate(-50%, -50%) rotate(135deg) translateX(-22px); }

/* 四个旋翼位置 - 确保在正确的位置 */
.rotor {
  position: absolute;
  width: 26px;
  height: 26px;
  z-index: 2;
}

.rotor-1 { 
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) translate(-36px, -36px);
}
.rotor-2 { 
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) translate(36px, -36px);
}
.rotor-3 { 
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) translate(-36px, 36px);
}
.rotor-4 { 
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) translate(36px, 36px);
}

/* 旋翼圆盘 - 俯视旋转效果 */
.rotor-disc {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: conic-gradient(
    from 0deg,
    rgba(255, 255, 255, 0.15) 0deg,
    rgba(255, 255, 255, 0.4) 90deg,
    rgba(255, 255, 255, 0.2) 180deg,
    rgba(255, 255, 255, 0.5) 270deg,
    rgba(255, 255, 255, 0.15) 360deg
  );
  animation: rotorSpin 0.6s linear infinite;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.rotor-disc::before {
  content: '';
  width: 10px;
  height: 10px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 0 4px rgba(255, 255, 255, 0.3);
}

/* 中心机身 - 俯视视角 */
.drone-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 36px;
  height: 52px;
  background: linear-gradient(135deg,
    rgba(255, 255, 255, 0.2) 0%,
    rgba(255, 255, 255, 0.1) 50%,
    rgba(255, 255, 255, 0.15) 100%
  );
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4),
              inset 0 2px 4px rgba(255, 255, 255, 0.2);
  z-index: 4;
}

/* 中心机身内的装饰框 */
.drone-center::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 22px;
  height: 32px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

/* 加载文字 */
.loading-text {
  font-size: 13px;
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.8);
  margin: 0;
}

/* 进度条容器 */
.loading-progress-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

/* 进度条 */
.loading-progress {
  width: 240px;
  height: 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  overflow: hidden;
  position: relative;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2);
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, 
    rgba(255, 255, 255, 0.7), 
    rgba(255, 255, 255, 0.9)
  );
  border-radius: 4px;
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.4);
  position: relative;
  overflow: hidden;
}

.progress-bar-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg,
    transparent,
    rgba(255, 255, 255, 0.3),
    transparent
  );
  animation: shimmer 1.5s infinite;
}

/* 百分比文字 */
.progress-text {
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
  color: rgba(255, 255, 255, 0.5);
  font-family: var(--font-family-mono);
  text-align: center;
}

/* 动画定义 */
@keyframes dronePulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

@keyframes rotorSpin {
  to { transform: rotate(360deg); }
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
</style>

