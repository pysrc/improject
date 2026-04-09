<template>
  <!-- 浮动通话小窗 -->
  <div
    v-if="chatStore.callState.isMinimized && chatStore.callState.callType === 'video'"
    class="floating-call-window"
    :style="{ left: position.x + 'px', top: position.y + 'px' }"
  >
    <!-- 视频画面 -->
    <div class="floating-video-container">
      <video ref="floatingVideoRef" class="floating-video" autoplay playsinline />
    </div>

    <!-- 信息栏 -->
    <div class="floating-info">
      <span class="floating-name">{{ chatStore.callState.targetUsername }}</span>
      <span class="floating-duration">{{ formatDuration(chatStore.callWebrtcData.duration) }}</span>
    </div>

    <!-- 操作按钮 -->
    <div class="floating-actions">
      <n-button type="success" size="tiny" round @click.stop="handleRestore">
        <template #icon>
          <ExpandOutline />
        </template>
      </n-button>
      <n-button type="error" size="tiny" round @click.stop="handleHangup">
        <template #icon>
          <CloseOutline />
        </template>
      </n-button>
    </div>

    <!-- 拖动区域 -->
    <div class="floating-drag-handle" @mousedown="onMouseDown">
      <span class="drag-icon">⋮⋮</span>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, nextTick } from 'vue'
import { useChatStore } from '@/stores/chat'
import { CloseOutline, ExpandOutline } from '@vicons/ionicons5'

const chatStore = useChatStore()

const floatingVideoRef = ref(null)
const position = ref({ x: window.innerWidth - 220, y: 80 }) // 默认位置在右上角

// 拖动相关
let dragStartPos = { x: 0, y: 0 }
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

function onMouseDown(e) {
  dragStartPos = {
    x: e.clientX - position.value.x,
    y: e.clientY - position.value.y
  }
  isDragging = true

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function onMouseMove(e) {
  if (!isDragging) return

  const newX = e.clientX - dragStartPos.x
  const newY = e.clientY - dragStartPos.y

  // 边界限制
  const maxX = window.innerWidth - 200
  const maxY = window.innerHeight - 180

  position.value = {
    x: Math.max(0, Math.min(newX, maxX)),
    y: Math.max(0, Math.min(newY, maxY))
  }
}

function onMouseUp() {
  isDragging = false
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
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
  width: 180px;
  background: #1a1a1a;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  border: 2px solid rgba(255, 255, 255, 0.15);
  user-select: none;
}

.floating-video-container {
  width: 100%;
  height: 135px;
  background: #000;
}

.floating-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.floating-info {
  padding: 8px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(0, 0, 0, 0.7);
}

.floating-name {
  font-size: 13px;
  color: #fff;
  font-weight: 500;
}

.floating-duration {
  font-size: 12px;
  color: #18a058;
}

.floating-actions {
  padding: 6px 12px;
  display: flex;
  justify-content: space-around;
  background: rgba(0, 0, 0, 0.5);
}

.floating-drag-handle {
  padding: 4px;
  text-align: center;
  background: rgba(0, 0, 0, 0.3);
  cursor: move;
}

.drag-icon {
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
}
</style>