<template>
  <n-config-provider>
    <n-message-provider>
      <n-dialog-provider>
        <router-view />
        <!-- 浮动通话小窗 -->
        <FloatingCallWindow />
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup>
import { onMounted } from 'vue'
import { NConfigProvider, NMessageProvider, NDialogProvider } from 'naive-ui'
import FloatingCallWindow from '@/components/FloatingCallWindow.vue'
import { ringtone } from '@/utils/ringtone'

// 初始化铃声
onMounted(() => {
  ringtone.init()
})
</script>