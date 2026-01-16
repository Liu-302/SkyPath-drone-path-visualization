<template>
  <div class="particle-background">
    <canvas ref="canvasRef"></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)
let animationFrameId: number | null = null

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  opacity: number
  connectionDistance: number
}

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return
  
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  
  // 设置画布大小
  const setCanvasSize = () => {
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
  }
  setCanvasSize()
  
  // 粒子数组
  const particles: Particle[] = []
  const particleCount = 80 // 粒子数量
  
  // 创建粒子
  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3, // 慢速移动
      vy: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.5 + 0.2,
      connectionDistance: Math.random() * 100 + 100
    })
  }
  
  // 动画循环
  const animate = () => {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)' // 轻微拖尾效果
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    // 更新和绘制粒子
    particles.forEach((particle, i) => {
      // 更新位置
      particle.x += particle.vx
      particle.y += particle.vy
      
      // 边界反弹
      if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -1
      if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -1
      
      // 绘制粒子
      ctx.beginPath()
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255, 255, 255, ${particle.opacity})`
      ctx.fill()
      
      // 连接附近的粒子
      particles.slice(i + 1).forEach(otherParticle => {
        const dx = particle.x - otherParticle.x
        const dy = particle.y - otherParticle.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        
        if (distance < particle.connectionDistance) {
          const opacity = (1 - distance / particle.connectionDistance) * 0.15
          ctx.beginPath()
          ctx.moveTo(particle.x, particle.y)
          ctx.lineTo(otherParticle.x, otherParticle.y)
          ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`
          ctx.lineWidth = 0.5
          ctx.stroke()
        }
      })
    })
    
    animationFrameId = requestAnimationFrame(animate)
  }
  
  animate()
  
  // 监听窗口大小变化
  const handleResize = () => {
    setCanvasSize()
  }
  window.addEventListener('resize', handleResize)
  
  // 清理函数
  onUnmounted(() => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId)
    }
    window.removeEventListener('resize', handleResize)
  })
})
</script>

<style scoped>
.particle-background {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
