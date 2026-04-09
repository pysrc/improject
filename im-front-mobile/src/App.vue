<template>
  <router-view />
</template>

<script setup>
import { watch, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { useChatStore } from '@/stores/chat'
import { notificationSound } from '@/utils/notificationSound'

const userStore = useUserStore()
const chatStore = useChatStore()

// 组件挂载时检查是否有 token，如果有则连接 SSE
onMounted(() => {
  console.log('[App] mounted, token:', userStore.token ? 'exists' : 'none')
  if (userStore.token) {
    console.log('[App] connecting SSE on mount')
    chatStore.connectSSE(userStore.token)
  }
  // 初始化音频上下文
  notificationSound.init()
})

// 监听 token 变化
watch(() => userStore.token, (newToken, oldToken) => {
  console.log('[App] token changed:', oldToken ? 'exists' : 'none', '->', newToken ? 'exists' : 'none')
  if (newToken && !oldToken) {
    // 登录成功
    console.log('[App] login detected, connecting SSE')
    chatStore.connectSSE(newToken)
    notificationSound.init()
  } else if (!newToken && oldToken) {
    // 退出登录
    console.log('[App] logout detected, disconnecting SSE')
    chatStore.disconnectSSE()
  }
})
</script>