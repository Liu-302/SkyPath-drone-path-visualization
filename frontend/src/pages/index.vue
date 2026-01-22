<script setup lang="ts">
import { useRouter } from '@fesjs/fes'

// 自动跳转到 /upload
const router = useRouter()
router.replace('/upload')
</script>

<template>
  <div>Redirecting...</div>
</template>
