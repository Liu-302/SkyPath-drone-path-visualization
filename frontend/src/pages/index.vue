<script setup lang="ts">
import { useRouter } from '@fesjs/fes'
import { onMounted } from 'vue'

// 自动跳转到 /Home（登录后）或 /Login（未登录时由路由守卫处理）
const router = useRouter()
onMounted(() => {
    router.replace('/Home')
})
</script>

<template>
  <div>Redirecting...</div>
</template>
