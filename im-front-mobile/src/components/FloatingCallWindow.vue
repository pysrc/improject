<template>
  <!-- 浮动通话小窗 -->
  <div
    v-if="chatStore.callState.isMinimized && chatStore.callState.callType === 'video'"
    class="floating-call-window"
    :style="{ left: position.x + 'px', top: position.y + 'px' }"
    @touchstart="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
  >
    <!-- 视频画面 -->
    <div class="floating-video-container">
      <video ref="floatingVideoRef" class="floating-video" autoplay playsinline muted />
    </div>

    <!-- 信息栏 -->
    <div class="floating-info">
      <span class="floating-name">{{ chatStore.callState.targetUsername }}</span>
      <span class="floating-duration">{{ formatDuration(chatStore.callWebrtcData.duration) }}</span>
    </div>

    <!-- 操作按钮 -->
    <div class="floating-actions">
      <van-button type="primary" size="mini" round @click.stop="handleRestore">
        <van-icon name="arrow-up" />
      </van-button>
      <van-button type="danger" size="mini" round @click.stop="handleHangup">
        <van-icon name="cross" />
      </van-button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, nextTick } from 'vue'
import { useChatStore } from '@/stores/chat'

const chatStore = useChatStore()

const floatingVideoRef = ref(null)
const position = ref({ x: window.innerWidth - 160, y: 20 }) // 默认位置在右上角

// 拖动相关
let touchStartPos = { x: 0, y: 0 }
let isDragging = false

// 监听最小化状态，设置视频流
watch(() => chatStore.callState.isMinimized, (isMinimized) => {
  if (isMinimized) {
    // 等DOM渲染后设置视频流
    nextTick(() => {
      if (floatingVideoRef.value && chatStore.callWebrtcData.remoteStream) {
        floatingVideoRef.value.srcObject = chatStore.callWebrtcData.remoteStream
      }
    })
  }
})

function onTouchStart(e) {
  touchStartPos = {
    x: e.touches[0].clientX - position.value.x,
    y: e.touches[0].clientY - position.value.y
  }
  isDragging = true
}

function onTouchMove(e) {
  if (!isDragging) return

  const newX = e.touches[0].clientX - touchStartPos.x
  const newY = e.touches[0].clientY - touchStartPos.y

  // 边界限制
  const maxX = window.innerWidth - 160
  const maxY = window.innerHeight - 200

  position.value = {
    x: Math.max(0, Math.min(newX, maxX)),
    y: Math.max(0, Math.min(newY, maxY))
  }
}

function onTouchEnd() {
  isDragging = false
}

function handleRestore() {
  // 清除浮动窗口的视频绑定
  if (floatingVideoRef.value) {
    floatingVideoRef.value.srcObject = null
  }
  // 恢复到全屏通话
  chatStore.restoreCall()
}

function handleHangup() {
  // 结束通话
  chatStore.endCall()
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

onMounted(() => {
  // 如果已经最小化且有视频流，立即设置
  if (chatStore.callState.isMinimized && chatStore.callWebrtcData.remoteStream && floatingVideoRef.value) {
    floatingVideoRef.value.srcObject = chatStore.callWebrtcData.remoteStream
  }
})
</script>

<style scoped>
.floating-call-window {
  position: fixed;
  z-index: 9999;
  width: 140px;
  background: #1a1a1a;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  border: 2px solid rgba(255, 255, 255, 0.2);
}

.floating-video-container {
  width: 100%;
  height: 105px;
  background: #000;
}

.floating-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.floating-info {
  padding: 6px 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(0, 0, 0, 0.8);
}

.floating-name {
  font-size: 12px;
  color: #fff;
  font-weight: 500;
}

.floating-duration {
  font-size: 11px;
  color: #07c160;
}

.floating-actions {
  padding: 6px 10px;
  display: flex;
  justify-content: space-around;
  background: rgba(0, 0, 0, 0.6);
}

.floating-actions :deep(.van-button) {
  width: 32px;
  height: 32px;
  padding: 0;
}
</style>