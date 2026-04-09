<template>
  <van-popup v-model:show="visible" position="center" :style="{ width: '100%', height: '100%' }" :close-on-click-overlay="false">
    <div class="call-panel">
      <!-- 视频通话 -->
      <div v-show="callState === 'connected' && (callType === 'video' || callType === 'screen')" class="video-container" ref="videoContainerRef">
        <video ref="remoteVideoRef" :class="['remote-video', { 'video-small': isMainLocal }]" autoplay playsinline @click="toggleMainVideo" />
        <video v-if="callType === 'video'" ref="localVideoRef" :class="['local-video', { 'video-main': isMainLocal }]" autoplay playsinline muted @click="toggleMainVideo" />
      </div>

      <!-- 正在呼叫 -->
      <div v-if="callState === 'calling'" class="call-status-screen">
        <van-avatar size="80" round />
        <div class="call-name">{{ targetUsername }}</div>
        <div class="call-status-text">正在呼叫...</div>
        <van-button type="danger" round size="large" @click="handleHangup">
          <van-icon name="cross" size="24" />
        </van-button>
      </div>

      <!-- 正在连接 -->
      <div v-else-if="callState === 'connecting'" class="call-status-screen">
        <van-avatar size="80" round />
        <div class="call-name">{{ targetUsername }}</div>
        <div class="call-status-text">正在连接...</div>
        <van-button type="danger" round size="large" @click="handleHangup">
          <van-icon name="cross" size="24" />
        </van-button>
      </div>

      <!-- 来电 -->
      <div v-else-if="callState === 'incoming'" class="call-status-screen incoming-screen">
        <van-avatar size="80" round />
        <div class="call-name">{{ callerUsername }}</div>
        <div class="call-status-text">
          {{ callType === 'video' ? '视频通话' : (callType === 'screen' ? '投屏通话' : '语音通话') }}
        </div>
        <div class="incoming-actions">
          <div class="action-btn-wrapper">
            <van-button type="success" round class="accept-btn" @click="handleAccept">
              <van-icon name="phone-o" size="28" />
            </van-button>
            <span class="action-label">接听</span>
          </div>
          <div class="action-btn-wrapper">
            <van-button type="danger" round class="reject-btn" @click="handleReject">
              <van-icon name="phone-o" size="28" class="rotate-icon" />
            </van-button>
            <span class="action-label">挂断</span>
          </div>
        </div>
      </div>

      <!-- 语音通话 -->
      <div v-else-if="callState === 'connected' && callType === 'audio'" class="call-status-screen">
        <van-avatar size="80" round />
        <div class="call-name">{{ targetUsername }}</div>
        <div class="call-duration">{{ formatDuration(callDuration) }}</div>
      </div>

      <!-- 通话结束 -->
      <div v-else-if="callState === 'ended'" class="call-status-screen">
        <div class="ended-text">通话已结束</div>
        <div class="ended-duration">{{ formatDuration(callDuration) }}</div>
      </div>

      <!-- 通话控制 -->
      <div v-show="callState === 'connected'" class="call-controls safe-area-bottom">
        <!-- 静音按钮 -->
        <van-button
          :type="audioEnabled ? 'default' : 'danger'"
          round
          class="control-btn"
          @click="toggleAudio"
        >
          <van-icon :name="audioEnabled ? 'volume-o' : 'volume-discount-o'" size="24" />
          <span class="btn-label">{{ audioEnabled ? '静音' : '取消静音' }}</span>
        </van-button>
        <!-- 视频开关（仅视频通话） -->
        <van-button
          v-if="callType === 'video'"
          :type="videoEnabled ? 'default' : 'danger'"
          round
          class="control-btn"
          @click="toggleVideo"
        >
          <van-icon :name="videoEnabled ? 'video' : 'video-discount-o'" size="24" />
          <span class="btn-label">{{ videoEnabled ? '关闭视频' : '开启视频' }}</span>
        </van-button>
        <!-- 切换摄像头（仅视频通话且移动端） -->
        <van-button
          v-if="callType === 'video' && isMobile"
          type="default"
          round
          class="control-btn"
          @click="switchCamera"
        >
          <van-icon name="replay" size="24" />
          <span class="btn-label">切换摄像头</span>
        </van-button>
        <!-- 最小化按钮（仅视频通话） -->
        <van-button
          v-if="callType === 'video'"
          type="default"
          round
          class="control-btn"
          @click="handleMinimize"
        >
          <van-icon name="minus" size="24" />
          <span class="btn-label">小窗</span>
        </van-button>
        <!-- 挂断按钮 -->
        <van-button type="danger" round class="control-btn hangup-btn" @click="handleHangup">
          <van-icon name="phone-o" size="24" class="rotate-icon" />
          <span class="btn-label">挂断</span>
        </van-button>
      </div>
    </div>
  </van-popup>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { showToast } from 'vant'
import WebRTCManager from '@/utils/webrtc'
import { webrtcApi } from '@/api/modules'
import { ringtone } from '@/utils/ringtone'
import { useChatStore } from '@/stores/chat'

const props = defineProps({
  show: { type: Boolean, default: false },
  callType: { type: String, default: 'video' },
  targetUserId: { type: String, default: '' },
  targetUsername: { type: String, default: '' },
  incomingOffer: { type: Object, default: null },
  callerUsername: { type: String, default: '' }
})

const emit = defineEmits(['update:show', 'hangup', 'signal'])

const chatStore = useChatStore()
const visible = ref(props.show)
const callState = ref('idle')
const audioEnabled = ref(true)
const videoEnabled = ref(true)
const callDuration = ref(0)
const localVideoRef = ref(null)
const remoteVideoRef = ref(null)
const videoContainerRef = ref(null)
const isMainLocal = ref(false) // 主画面是否显示本地视频

let webrtc = null
let durationTimer = null

// 检测是否为移动设备
const isMobile = computed(() => {
  const ua = navigator.userAgent
  const result = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua)
  console.log('[CallPanel] isMobile check:', result, 'UA:', ua)
  return result
})

// 当前摄像头方向
const facingMode = ref('user')

watch(() => props.show, (val, oldVal) => {
  visible.value = val
  if (val) {
    // 如果有保存的webrtc数据，说明是从最小化恢复
    if (chatStore.callWebrtcData.webrtc) {
      restoreVideoDisplay()
    } else {
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

  webrtc.onRemoteStream = (stream) => {
    console.log('[WebRTC] Remote stream received')
    // 保存远程视频流
    chatStore.saveCallWebrtcData({ remoteStream: stream })
    setTimeout(() => {
      if (remoteVideoRef.value) {
        remoteVideoRef.value.srcObject = stream
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
    showToast(msg)
    handleCallEnded()
  }

  webrtc.onScreenShareEnded = () => {
    showToast('投屏已结束')
    handleCallEnded()
  }

  if (props.incomingOffer) {
    callState.value = 'incoming'
    ringtone.start() // 播放来电铃声
  } else {
    startCall()
  }
}

// 从最小化恢复时恢复视频显示
function restoreVideoDisplay() {
  callState.value = 'connected'
  // 从store恢复webrtc实例
  webrtc = chatStore.callWebrtcData.webrtc

  // 优先从webrtc实例获取远程流
  const remoteStream = webrtc?.remoteStream || chatStore.callWebrtcData.remoteStream

  // 等待DOM准备好
  setTimeout(() => {
    if (remoteStream && remoteVideoRef.value) {
      // 确保音频轨道是启用的
      remoteStream.getAudioTracks().forEach(track => {
        track.enabled = true
      })
      remoteVideoRef.value.srcObject = remoteStream
      // 确保视频元素不是静音的
      remoteVideoRef.value.muted = false
    }
    // 恢复本地视频流
    const localStream = webrtc?.localStream || chatStore.callWebrtcData.localStream
    if (localStream && localVideoRef.value) {
      localVideoRef.value.srcObject = localStream
      // 本地视频始终静音（避免回声）
      localVideoRef.value.muted = true
    }
  }, 50)

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
    await webrtc.initIceServers(webrtcApi.getIceConfig)
    const stream = await getLocalStream(props.callType)

    // 保存本地视频流
    chatStore.saveCallWebrtcData({ localStream: stream })

    setTimeout(() => {
      if (localVideoRef.value && props.callType === 'video') {
        localVideoRef.value.srcObject = stream
      }
    }, 0)

    webrtc.createPeerConnection()
    const offer = await webrtc.createOffer()
    emit('signal', {
      signalType: 'offer',
      signalData: offer,
      callType: props.callType
    })
  } catch (err) {
    showToast(err.message)
    handleCallEnded()
  }
}

async function getLocalStream(type) {
  if (type === 'video') {
    // 移动端视频通话 - 指定摄像头方向
    const constraints = {
      audio: true,
      video: {
        facingMode: facingMode.value,
        width: { ideal: 640 },
        height: { ideal: 480 }
      }
    }
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    // 重要：赋值给 webrtc.localStream，否则 createPeerConnection 无法添加轨道
    if (webrtc) {
      webrtc.localStream = stream
      webrtc.callType = 'video'
    }
    return stream
  }
  // 其他类型使用 webrtc 的方法，传入 facingMode
  return await webrtc.getLocalStream(type, true, facingMode.value)
}

async function handleAccept() {
  ringtone.stop() // 停止铃声
  callState.value = 'connecting'

  try {
    await webrtc.initIceServers(webrtcApi.getIceConfig)

    const streamType = props.callType === 'screen' ? 'audio' : props.callType
    const stream = await getLocalStream(streamType)

    // 保存本地视频流
    chatStore.saveCallWebrtcData({ localStream: stream })

    setTimeout(() => {
      if (localVideoRef.value && props.callType === 'video') {
        localVideoRef.value.srcObject = stream
      }
    }, 0)

    webrtc.callType = props.callType
    webrtc.createPeerConnection()

    const answer = await webrtc.handleOffer(props.incomingOffer)
    emit('signal', {
      signalType: 'answer',
      signalData: answer
    })
  } catch (err) {
    showToast(err.message)
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
    audioEnabled.value = true
    videoEnabled.value = true
  }, 2000)
}

async function handleRemoteAnswer(answer) {
  if (webrtc) {
    await webrtc.handleAnswer(answer)
  }
}

async function handleRemoteIceCandidate(candidate) {
  if (webrtc) {
    await webrtc.addIceCandidate(candidate)
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

// 切换前后摄像头
async function switchCamera() {
  if (!webrtc || props.callType !== 'video' || !webrtc.localStream) {
    showToast('无法切换摄像头')
    return
  }

  try {
    // 获取所有视频输入设备
    const devices = await navigator.mediaDevices.enumerateDevices()
    const videoDevices = devices.filter(d => d.kind === 'videoinput')

    if (videoDevices.length < 2) {
      showToast('没有其他摄像头可用')
      return
    }

    // 找到当前使用的视频轨道
    const currentTrack = webrtc.localStream.getVideoTracks()[0]
    const currentSettings = currentTrack?.getSettings() || {}
    const currentDeviceId = currentSettings.deviceId

    // 找到另一个摄像头
    const otherDevice = videoDevices.find(d => d.deviceId !== currentDeviceId)
    if (!otherDevice) {
      showToast('找不到其他摄像头')
      return
    }

    // 新的摄像头方向
    const newFacingMode = currentSettings.facingMode === 'user' ? 'environment' : 'user'

    // 先停止所有旧轨道
    webrtc.localStream.getTracks().forEach(track => track.stop())

    // 重新获取整个媒体流（音频+视频）
    const constraints = {
      audio: true,
      video: {
        facingMode: newFacingMode,
        width: { ideal: 640 },
        height: { ideal: 480 }
      }
    }

    const newStream = await navigator.mediaDevices.getUserMedia(constraints)
    webrtc.localStream = newStream

    // 替换 PeerConnection 中的所有轨道
    if (webrtc.peerConnection) {
      const senders = webrtc.peerConnection.getSenders()
      newStream.getTracks().forEach(newTrack => {
        const sender = senders.find(s => s.track.kind === newTrack.kind)
        if (sender) {
          sender.replaceTrack(newTrack)
        }
      })
    }

    // 更新本地预览
    if (localVideoRef.value) {
      localVideoRef.value.srcObject = newStream
    }

    facingMode.value = newFacingMode
    showToast('已切换摄像头')
  } catch (err) {
    showToast('切换失败: ' + (err.name || err.message || '未知错误'))
    console.error('[CallPanel] Switch camera error:', err)
  }
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
}

// 监听浮动窗口的挂断事件
function handleFloatingHangup() {
  handleHangup()
}

onMounted(() => {
  window.addEventListener('call-hangup-from-floating', handleFloatingHangup)
})

onUnmounted(() => {
  endCall()
  window.removeEventListener('call-hangup-from-floating', handleFloatingHangup)
})

defineExpose({
  handleRemoteAnswer,
  handleRemoteIceCandidate,
  handleCallEnded
})
</script>

<style scoped>
.call-panel {
  width: 100%;
  height: 100%;
  background: #1a1a1a;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.video-container {
  width: 100%;
  height: 100%;
  position: relative;
  background: #000;
}

.remote-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.local-video {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 120px;
  height: 160px;
  border-radius: 12px;
  border: 2px solid #fff;
  object-fit: cover;
  z-index: 10;
  transition: all 0.3s ease;
  cursor: pointer;
}

/* 本地视频变成主画面 */
.local-video.video-main {
  width: 100%;
  height: 100%;
  top: 0;
  right: 0;
  border-radius: 0;
  z-index: 1;
}

/* 远程视频变成小画面 */
.remote-video.video-small {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 120px;
  height: 160px;
  border-radius: 12px;
  border: 2px solid #fff;
  z-index: 10;
  cursor: pointer;
}

.call-status-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  color: #fff;
  padding: 20px;
}

.incoming-screen {
  height: 100%;
  justify-content: space-between;
  padding: 60px 20px 40px;
}

.incoming-actions {
  display: flex;
  justify-content: space-around;
  width: 100%;
  margin-top: auto;
}

.action-btn-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.accept-btn,
.reject-btn {
  width: 72px;
  height: 72px;
  border: none;
}

.accept-btn {
  background: #07c160;
}

.accept-btn:active {
  background: #06ad56;
}

.reject-btn {
  background: #ee0a24;
}

.reject-btn:active {
  background: #d60a1e;
}

.action-label {
  font-size: 14px;
  color: #fff;
}

.rotate-icon {
  transform: rotate(135deg);
}

.call-name {
  font-size: 24px;
  font-weight: 600;
}

.call-status-text {
  font-size: 16px;
  color: #888;
}

.call-duration {
  font-size: 48px;
  color: #fff;
  font-weight: 300;
}

.ended-text {
  font-size: 20px;
  color: #fff;
}

.ended-duration {
  font-size: 14px;
  color: #888;
}

.call-controls {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 30px 16px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
  display: flex;
  justify-content: space-around;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.control-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 70px;
  height: 70px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.15);
  border: none;
  color: #fff;
}

.control-btn:active {
  background: rgba(255, 255, 255, 0.25);
}

.control-btn.hangup-btn {
  background: #ee0a24;
}

.control-btn.hangup-btn:active {
  background: #d60a1e;
}

.btn-label {
  font-size: 11px;
  margin-top: 6px;
  color: #fff;
}

.rotate-icon {
  transform: rotate(135deg);
}
</style>