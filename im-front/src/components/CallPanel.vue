<template>
  <n-modal v-model:show="visible" :mask-closable="false" :closable="false">
    <div class="call-panel" ref="panelRef">
      <!-- 视频容器 - 始终渲染，用 v-show 控制显示 -->
      <div v-show="callState === 'connected' && (callType === 'video' || callType === 'screen')" class="video-container" ref="videoContainerRef">
        <video ref="remoteVideoRef" :class="['remote-video', { 'video-small': isMainLocal }]" autoplay playsinline @click="toggleMainVideo" />
        <!-- 投屏模式不显示本地小视频窗口 -->
        <video v-if="callType === 'video'" ref="localVideoRef" :class="['local-video', { 'video-main': isMainLocal }]" autoplay playsinline muted @click="toggleMainVideo" />
      </div>

      <!-- 正在呼叫状态 -->
      <div v-if="callState === 'calling'" class="call-calling">
        <div class="calling-info">
          <n-avatar round size="large" />
          <div class="calling-name">{{ targetUsername }}</div>
          <div class="calling-status">正在呼叫...</div>
        </div>
        <div class="call-actions">
          <n-button type="error" circle size="large" @click="handleHangup">
            <template #icon>
              <CloseOutline />
            </template>
          </n-button>
        </div>
      </div>

      <!-- 正在连接状态 -->
      <div v-else-if="callState === 'connecting'" class="call-calling">
        <div class="calling-info">
          <n-avatar round size="large" />
          <div class="calling-name">{{ targetUsername }}</div>
          <div class="calling-status">正在连接...</div>
        </div>
        <div class="call-actions">
          <n-button type="error" circle size="large" @click="handleHangup">
            <template #icon>
              <CloseOutline />
            </template>
          </n-button>
        </div>
      </div>

      <!-- 通话邀请状态 -->
      <div v-else-if="callState === 'incoming'" class="call-incoming">
        <div class="caller-info">
          <n-avatar round size="large" />
          <div class="caller-name">{{ callerUsername }}</div>
          <div class="call-type-text">
            {{ callType === 'video' ? '视频通话' : (callType === 'screen' ? '投屏通话' : '语音通话') }}
          </div>
        </div>
        <div class="call-actions">
          <n-button type="error" circle size="large" @click="handleReject">
            <template #icon>
              <CloseOutline />
            </template>
          </n-button>
          <n-button type="success" circle size="large" @click="handleAccept">
            <template #icon>
              <CallOutline />
            </template>
          </n-button>
        </div>
      </div>

      <!-- 通话进行中状态（语音通话显示） -->
      <div v-else-if="callState === 'connected' && callType === 'audio'" class="audio-container">
        <n-avatar round size="large" />
        <div class="audio-name">{{ targetUsername }}</div>
        <div class="audio-duration">{{ formatDuration(callDuration) }}</div>
      </div>

      <!-- 通话结束状态 -->
      <div v-else-if="callState === 'ended'" class="call-ended">
        <div class="ended-info">通话已结束</div>
        <div class="ended-duration">{{ formatDuration(callDuration) }}</div>
      </div>

      <!-- 通话控制按钮 -->
      <div v-show="callState === 'connected'" class="call-controls">
        <n-button :type="audioEnabled ? 'primary' : 'error'" circle @click="toggleAudio">
          <template #icon>
            <component :is="audioEnabled ? MicOutline : MicOffOutline" />
          </template>
        </n-button>
        <n-button v-if="callType === 'video'" :type="videoEnabled ? 'primary' : 'error'" circle @click="toggleVideo">
          <template #icon>
            <component :is="videoEnabled ? VideocamOutline : VideocamOffOutline" />
          </template>
        </n-button>
        <!-- 最小化按钮（仅视频通话） -->
        <n-button v-if="callType === 'video'" type="default" circle @click="handleMinimize">
          <template #icon>
            <RemoveOutline />
          </template>
        </n-button>
        <!-- 视频/投屏模式显示全屏按钮 -->
        <n-button v-if="callType === 'video' || callType === 'screen'" :type="isFullscreen ? 'warning' : 'primary'" circle @click="toggleFullscreen">
          <template #icon>
            <component :is="isFullscreen ? ContractOutline : ExpandOutline" />
          </template>
        </n-button>
        <n-button type="error" circle size="large" @click="handleHangup">
          <template #icon>
            <CloseOutline />
          </template>
        </n-button>
      </div>
    </div>
  </n-modal>
</template>

<script setup>
import { ref, watch, onUnmounted, onMounted, nextTick } from 'vue'
import { useMessage } from 'naive-ui'
import { CallOutline, CloseOutline, MicOutline, MicOffOutline, VideocamOutline, VideocamOffOutline, ExpandOutline, ContractOutline, RemoveOutline } from '@vicons/ionicons5'
import WebRTCManager from '@/utils/webrtc'
import { webrtcApi } from '@/api/modules'
import { ringtone } from '@/utils/ringtone'
import { useChatStore } from '@/stores/chat'

const props = defineProps({
  show: { type: Boolean, default: false },
  callType: { type: String, default: 'video' }, // 'video'、'audio' 或 'screen'
  targetUserId: { type: String, default: '' },
  targetUsername: { type: String, default: '' },
  incomingOffer: { type: Object, default: null },
  callerUsername: { type: String, default: '' }
})

const emit = defineEmits(['update:show', 'hangup', 'signal'])

const naiveMessage = useMessage()
const chatStore = useChatStore()
const visible = ref(props.show)
const callState = ref('idle') // idle/calling/incoming/connected/ended
const audioEnabled = ref(true)
const videoEnabled = ref(true)
const callDuration = ref(0)
const localVideoRef = ref(null)
const remoteVideoRef = ref(null)
const panelRef = ref(null)
const videoContainerRef = ref(null)
const isFullscreen = ref(false)
const isMainLocal = ref(false) // 主画面是否显示本地视频

let webrtc = null
let durationTimer = null

watch(() => props.show, (val) => {
  visible.value = val
  if (val) {
    // 如果有保存的webrtc数据，说明是从最小化恢复
    if (chatStore.callWebrtcData.webrtc) {
      // 恢复视频显示
      restoreVideoDisplay()
    } else {
      // 新通话，初始化
      initCall()
    }
  } else {
    // 只有当不是最小化状态时才结束通话
    if (!chatStore.callState.isMinimized) {
      endCall()
    }
  }
})

watch(visible, (val) => {
  emit('update:show', val)
})

function initCall() {
  webrtc = new WebRTCManager()

  // 设置回调
  webrtc.onRemoteStream = (stream) => {
    console.log('[WebRTC] Remote stream received')
    // 保存远程视频流
    chatStore.saveCallWebrtcData({ remoteStream: stream })
    // 使用 setTimeout 确保 DOM 已渲染
    setTimeout(() => {
      if (remoteVideoRef.value) {
        remoteVideoRef.value.srcObject = stream
        console.log('[WebRTC] Remote video srcObject set')
      } else {
        console.warn('[WebRTC] remoteVideoRef not ready')
      }
    }, 0)
  }

  webrtc.onIceCandidate = (candidate) => {
    emit('signal', {
      signalType: 'ice_candidate',
      signalData: candidate
    })
  }

  webrtc.onConnectionStateChange = (state) => {
    console.log('[WebRTC] Connection state:', state)
    if (state === 'connected') {
      callState.value = 'connected'
      // 保存webrtc实例
      chatStore.saveCallWebrtcData({ webrtc: webrtc })
      startDurationTimer()
    } else if (state === 'disconnected' || state === 'closed' || state === 'failed') {
      handleCallEnded()
    }
  }

  webrtc.onError = (msg) => {
    naiveMessage.error(msg)
    handleCallEnded()
  }

  // 投屏结束回调（用户点击浏览器停止共享按钮）
  webrtc.onScreenShareEnded = () => {
    naiveMessage.info('投屏已结束')
    handleCallEnded()
  }

  // 判断是发起通话还是接听通话
  if (props.incomingOffer) {
    // 接听通话 - 播放来电铃声
    callState.value = 'incoming'
    ringtone.start()
  } else {
    // 发起通话
    startCall()
  }
}

// 从最小化恢复时恢复视频显示
function restoreVideoDisplay() {
  callState.value = 'connected'
  // 从store恢复webrtc实例
  webrtc = chatStore.callWebrtcData.webrtc

  // 检查WebRTC连接状态
  if (webrtc?.peerConnection) {
    console.log('[CallPanel] WebRTC connection state:', webrtc.peerConnection.connectionState)
  }

  // 优先从webrtc实例获取远程流，这样更可靠
  const remoteStream = webrtc?.remoteStream || chatStore.callWebrtcData.remoteStream

  // 等待DOM准备好
  nextTick(() => {
    if (remoteStream && remoteVideoRef.value) {
      // 确保音频轨道是启用的
      remoteStream.getAudioTracks().forEach(track => {
        track.enabled = true
        console.log('[CallPanel] Audio track enabled:', track.id, track.enabled)
      })
      remoteVideoRef.value.srcObject = remoteStream
      // 确保视频元素不是静音的
      remoteVideoRef.value.muted = false
      // 触发播放（某些浏览器需要）
      remoteVideoRef.value.play().catch(e => console.log('[CallPanel] Play error:', e))
    }
    // 恢复本地视频流
    const localStream = webrtc?.localStream || chatStore.callWebrtcData.localStream
    if (localStream && localVideoRef.value) {
      localVideoRef.value.srcObject = localStream
      // 本地视频始终静音（避免回声）
      localVideoRef.value.muted = true
    }
  })

  // 恢复通话时长
  callDuration.value = chatStore.callWebrtcData.duration
  // 恢复计时器
  if (!durationTimer) {
    startDurationTimer()
  }
}

async function startCall() {
  callState.value = 'calling'

  try {
    // 获取 ICE 配置
    await webrtc.initIceServers(webrtcApi.getIceConfig)
    console.log('[WebRTC] ICE servers initialized')

    // 获取本地媒体流
    const stream = await webrtc.getLocalStream(props.callType)
    console.log('[WebRTC] Local stream obtained, tracks:', stream.getTracks().map(t => t.kind))

    // 保存本地视频流
    chatStore.saveCallWebrtcData({ localStream: stream })

    // 延迟设置本地视频，确保 DOM 已渲染
    setTimeout(() => {
      if (localVideoRef.value && props.callType === 'video') {
        localVideoRef.value.srcObject = stream
        console.log('[WebRTC] Local video srcObject set')
      }
    }, 0)

    // 创建 PeerConnection
    webrtc.createPeerConnection()
    console.log('[WebRTC] PeerConnection created')

    // 创建 Offer
    const offer = await webrtc.createOffer()
    emit('signal', {
      signalType: 'offer',
      signalData: offer,
      callType: props.callType
    })
    console.log('[WebRTC] Offer sent')
  } catch (err) {
    console.error('[WebRTC] startCall error:', err)
    naiveMessage.error(err.message)
    handleCallEnded()
  }
}

async function handleAccept() {
  ringtone.stop() // 停止铃声
  callState.value = 'connecting'

  try {
    // 获取 ICE 配置
    await webrtc.initIceServers(webrtcApi.getIceConfig)

    // 获取本地媒体流
    // 投屏通话接收方只需要音频（用于语音交流），视频通话和语音通话正常获取
    const streamType = props.callType === 'screen' ? 'audio' : props.callType
    // 接收方不更新 callType，保持为原始值以便正确显示投屏内容
    const stream = await webrtc.getLocalStream(streamType, false)
    console.log('[WebRTC] Local stream obtained, type:', streamType, 'tracks:', stream.getTracks().map(t => t.kind))

    // 保存本地视频流
    chatStore.saveCallWebrtcData({ localStream: stream })

    // 延迟设置本地视频，确保 DOM 已渲染（投屏接收方不显示本地视频）
    setTimeout(() => {
      if (localVideoRef.value && props.callType === 'video') {
        localVideoRef.value.srcObject = stream
        console.log('[WebRTC] Local video srcObject set')
      }
    }, 0)

    // 创建 PeerConnection
    webrtc.callType = props.callType // 设置正确的 callType 用于创建 Offer/Answer
    webrtc.createPeerConnection()

    // 处理 Offer 并创建 Answer
    const answer = await webrtc.handleOffer(props.incomingOffer)
    emit('signal', {
      signalType: 'answer',
      signalData: answer
    })

    console.log('[WebRTC] Answer sent, waiting for connection...')
  } catch (err) {
    console.error('[WebRTC] handleAccept error:', err)
    naiveMessage.error(err.message)
    handleCallEnded()
  }
}

function handleReject() {
  ringtone.stop() // 停止铃声
  emit('signal', { signalType: 'reject' })
  handleCallEnded()
}

function handleHangup() {
  emit('signal', { signalType: 'hangup' })
  handleCallEnded()
}

function handleCallEnded() {
  ringtone.stop() // 停止铃声
  stopDurationTimer()
  callState.value = 'ended'
  isMainLocal.value = false // 重置画面状态

  setTimeout(() => {
    visible.value = false
    callState.value = 'idle'
    callDuration.value = 0
  }, 2000)
}

// 处理远程 Answer
async function handleRemoteAnswer(answer) {
  console.log('[WebRTC] Received remote answer')
  if (webrtc) {
    await webrtc.handleAnswer(answer)
    console.log('[WebRTC] Remote answer set')
  }
}

// 处理远程 ICE Candidate
async function handleRemoteIceCandidate(candidate) {
  console.log('[WebRTC] Received remote ICE candidate')
  if (webrtc) {
    await webrtc.addIceCandidate(candidate)
    console.log('[WebRTC] Remote ICE candidate added')
  }
}

function toggleAudio() {
  audioEnabled.value = webrtc.toggleAudio()
}

function toggleVideo() {
  videoEnabled.value = webrtc.toggleVideo()
}

// 切换主画面（点击小窗口切换大小画面）
function toggleMainVideo() {
  if (props.callType !== 'video') return
  isMainLocal.value = !isMainLocal.value
}

// 最小化通话（切换到小窗模式）
function handleMinimize() {
  if (props.callType !== 'video') return

  // 保存当前通话时长
  chatStore.updateCallDuration(callDuration.value)

  // 最小化
  chatStore.minimizeCall()
}

function startDurationTimer() {
  durationTimer = setInterval(() => {
    callDuration.value++
    // 更新store中的通话时长
    chatStore.updateCallDuration(callDuration.value)
  }, 1000)
}

function stopDurationTimer() {
  if (durationTimer) {
    clearInterval(durationTimer)
    durationTimer = null
  }
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function endCall() {
  ringtone.stop() // 停止铃声
  if (webrtc) {
    webrtc.endCall()
    webrtc = null
  }
  stopDurationTimer()
  // 退出全屏
  if (isFullscreen.value) {
    exitFullscreen()
  }
}

// ====================== 全屏功能 ======================
function toggleFullscreen() {
  if (isFullscreen.value) {
    exitFullscreen()
  } else {
    enterFullscreen()
  }
}

function enterFullscreen() {
  const container = videoContainerRef.value
  if (container) {
    if (container.requestFullscreen) {
      container.requestFullscreen()
    } else if (container.webkitRequestFullscreen) {
      container.webkitRequestFullscreen()
    } else if (container.msRequestFullscreen) {
      container.msRequestFullscreen()
    }
  }
}

function exitFullscreen() {
  if (document.exitFullscreen) {
    document.exitFullscreen()
  } else if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen()
  } else if (document.msExitFullscreen) {
    document.msExitFullscreen()
  }
}

function handleFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
}

// 监听浮动窗口的挂断事件
function handleFloatingHangup() {
  handleHangup()
}

onMounted(() => {
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
  window.addEventListener('call-hangup-from-floating', handleFloatingHangup)
})

onUnmounted(() => {
  endCall()
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
  window.removeEventListener('call-hangup-from-floating', handleFloatingHangup)
})

// 暴露方法供外部调用
defineExpose({
  handleRemoteAnswer,
  handleRemoteIceCandidate,
  handleCallEnded
})
</script>

<style scoped>
.call-panel {
  width: 400px;
  min-width: 300px;
  max-width: 900px;
  min-height: 300px;
  background: #1a1a1a;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  resize: both;
  overflow: hidden;
}

.call-incoming, .call-calling, .call-ended {
  text-align: center;
}

.caller-info, .calling-info {
  margin-bottom: 30px;
}

.caller-name, .calling-name, .audio-name {
  font-size: 18px;
  color: #fff;
  margin-top: 10px;
}

.call-type-text, .calling-status {
  font-size: 14px;
  color: #888;
  margin-top: 5px;
}

.call-actions {
  display: flex;
  gap: 30px;
  justify-content: center;
}

.video-container {
  width: 100%;
  flex: 1;
  min-height: 200px;
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 20px;
  background: #000;
}

/* 全屏时的样式 */
.video-container:fullscreen {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
}

.video-container:-webkit-full-screen {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
}

.remote-video {
  width: 100%;
  height: 100%;
  background: #000;
  object-fit: contain;
}

/* 全屏时远程视频样式 */
.video-container:fullscreen .remote-video {
  max-width: 100%;
  max-height: 100%;
}

.local-video {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 100px;
  height: 75px;
  border-radius: 8px;
  background: #000;
  border: 2px solid #fff;
  object-fit: cover;
  transition: all 0.3s ease;
  cursor: pointer;
}

/* 本地视频变成主画面 */
.local-video.video-main {
  width: 100%;
  height: 100%;
  top: 0;
  right: 0;
  border-radius: 8px;
  z-index: 1;
}

/* 远程视频变成小画面 */
.remote-video.video-small {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 100px;
  height: 75px;
  border-radius: 8px;
  border: 2px solid #fff;
  z-index: 10;
  cursor: pointer;
}

.audio-container {
  text-align: center;
  margin-bottom: 20px;
}

.audio-duration {
  font-size: 24px;
  color: #fff;
  margin-top: 15px;
}

.call-controls {
  display: flex;
  gap: 15px;
  justify-content: center;
}

.ended-info {
  font-size: 18px;
  color: #fff;
}

.ended-duration {
  font-size: 14px;
  color: #888;
  margin-top: 10px;
}
</style>