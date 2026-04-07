<template>
  <div class="chat-page">
    <!-- 顶部导航 -->
    <van-nav-bar
      :title="chatTitle"
      left-arrow
      @click-left="goBack"
    >
      <template #right>
        <van-icon name="ellipsis" size="20" @click="showMore = true" />
      </template>
    </van-nav-bar>

    <!-- 消息列表 -->
    <div class="message-list" ref="messageListRef">
      <div
        v-for="msg in currentMessages"
        :key="msg.id"
        :class="['message-item', { 'message-self': msg.senderId === userStore.userId }]"
      >
        <!-- 对方头像 -->
        <van-avatar
          v-if="msg.senderId !== userStore.userId"
          :src="getAvatarUrl(getSenderAvatar(msg))"
          size="36"
          round
          class="message-avatar"
        />

        <!-- 消息内容 -->
        <div class="message-content">
          <!-- 群聊显示发送者名称 -->
          <div v-if="chatStore.chatType === 'group' && msg.senderId !== userStore.userId" class="message-sender">
            {{ msg.senderUsername }}
          </div>

          <!-- 文本消息 -->
          <div v-if="msg.messageType === 'text' || !msg.messageType" class="message-text">
            <span v-for="(part, idx) in parseMentionContent(msg.content, msg.mentionIds)" :key="idx">
              <span v-if="part.isMention" class="mention-highlight">@{{ part.text }}</span>
              <span v-else>{{ part.text }}</span>
            </span>
          </div>

          <!-- 图片消息 -->
          <div v-else-if="msg.messageType === 'image'" class="message-image">
            <van-image
              :src="getFileUrl(msg.fileId)"
              fit="cover"
              @click="previewImage(getFileUrl(msg.fileId))"
            />
          </div>

          <!-- 文件消息 -->
          <div v-else-if="msg.messageType === 'file'" class="message-file" @click="downloadFile(msg.fileId, msg.fileName || msg.content)">
            <van-icon name="description" size="20" />
            <span class="file-name">{{ msg.fileName || msg.content }}</span>
            <span class="file-size">({{ formatFileSize(msg.fileSize) }})</span>
          </div>

          <!-- 音频消息 -->
          <div v-else-if="msg.messageType === 'audio'" class="message-audio">
            <van-button
              :type="isPlaying(msg.fileId) ? 'primary' : 'default'"
              size="small"
              @click="playAudio(msg)"
            >
              <van-icon name="volume-o" />
              {{ isPlaying(msg.fileId) ? '暂停' : '播放' }}
            </van-button>
            <span class="audio-duration">{{ formatDuration(msg.duration || 0) }}</span>
          </div>

          <!-- 时间 -->
          <div class="message-time">{{ formatTime(msg.sendTime) }}</div>
        </div>

        <!-- 自己头像 -->
        <van-avatar
          v-if="msg.senderId === userStore.userId"
          :src="getAvatarUrl(userStore.avatar)"
          size="36"
          round
          class="message-avatar"
        />
      </div>

      <van-empty v-if="currentMessages.length === 0" description="暂无消息" />
    </div>

    <!-- 输入区域 -->
    <div class="chat-input-area safe-area-bottom">
      <van-field
        v-model="inputMessage"
        placeholder="输入消息..."
        type="textarea"
        rows="1"
        autosize
        @keyup.enter="handleSend"
      />
      <van-space>
        <van-icon name="photo-o" size="24" @click="showFilePicker = true" />
        <!-- 长按录音按钮 -->
        <div
          class="voice-btn"
          :class="{ 'voice-btn-recording': isRecording, 'voice-btn-cancel': isCancelRecording }"
          @touchstart.prevent="onVoiceTouchStart"
          @touchmove.prevent="onVoiceTouchMove"
          @touchend.prevent="onVoiceTouchEnd"
          @touchcancel.prevent="onVoiceTouchEnd"
        >
          <van-icon name="audio" size="24" />
        </div>
        <van-button type="primary" size="small" @click="handleSend">发送</van-button>
      </van-space>
    </div>

    <!-- 文件选择 -->
    <van-popup v-model:show="showFilePicker" position="bottom" round>
      <van-cell-group inset>
        <van-cell title="发送图片/文件" is-link @click="selectFile('file')" />
        <van-cell title="拍照" is-link @click="selectFile('camera')" />
      </van-cell-group>
    </van-popup>

    <!-- 更多操作 -->
    <van-action-sheet v-model:show="showMore" :actions="moreActions" @select="handleMoreAction" />

    <!-- 群成员弹窗 -->
    <van-popup v-model:show="showGroupMembers" position="bottom" round>
      <div class="group-members-popup">
        <van-cell-group inset title="群成员">
          <van-cell
            v-for="member in currentMembers"
            :key="member.userId"
            :title="member.username"
            :label="getRoleLabel(member.role)"
          >
            <template #icon>
              <van-avatar :src="getAvatarUrl(member.avatar)" size="40" round />
            </template>
            <template #right-icon>
              <van-space v-if="canManageMember(member)">
                <van-button v-if="member.role === 'member' && chatStore.currentGroup?.role === 'owner'" size="small" @click="handleSetAdmin(member.userId, true)">设管理</van-button>
                <van-button v-if="member.role === 'admin' && chatStore.currentGroup?.role === 'owner'" size="small" @click="handleSetAdmin(member.userId, false)">取消管理</van-button>
                <van-button size="small" type="danger" @click="handleRemoveMember(member.userId)">移除</van-button>
              </van-space>
            </template>
          </van-cell>
        </van-cell-group>
        <van-space direction="vertical" fill>
          <van-button type="primary" block @click="showInviteMember = true">邀请成员</van-button>
          <van-button type="danger" block @click="handleQuitGroup">退出群组</van-button>
        </van-space>
      </div>
    </van-popup>

    <!-- 邀请成员 -->
    <van-popup v-model:show="showInviteMember" position="bottom" round>
      <van-picker
        :columns="inviteOptions"
        @confirm="handleInviteConfirm"
        @cancel="showInviteMember = false"
      />
    </van-popup>

    <!-- 修改备注 -->
    <van-popup v-model:show="showRemark" position="bottom" round>
      <div class="popup-content">
        <van-field v-model="remarkInput" label="备注名" placeholder="输入备注名" />
        <van-button type="primary" block @click="handleSetRemark">保存</van-button>
      </div>
    </van-popup>

    <!-- 图片预览 -->
    <van-image-preview v-model:show="showImagePreview" :images="previewImages" />

    <!-- 隐藏的文件输入 -->
    <input
      ref="fileInputRef"
      type="file"
      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
      style="display: none"
      @change="handleFileSelect"
    />

    <!-- 通话面板 -->
    <CallPanel
      ref="callPanelRef"
      v-model:show="chatStore.callState.showCallPanel"
      :call-type="chatStore.callState.callType"
      :target-user-id="chatStore.callState.targetUserId"
      :target-username="chatStore.callState.targetUsername"
      :incoming-offer="chatStore.callState.incomingOffer"
      :caller-username="chatStore.callState.callerUsername"
      @signal="handleCallSignal"
      @hangup="chatStore.endCall"
    />

    <!-- 录音提示 -->
    <van-overlay :show="isRecording" class="recording-overlay-wrapper">
      <div class="recording-overlay">
        <div class="recording-content">
          <van-icon :name="isCancelRecording ? 'revoke' : 'audio'" size="40" color="#fff" />
          <div class="recording-text">
            {{ isCancelRecording ? '松开取消' : '录音中 ' + formatDuration(recordingDuration) }}
          </div>
          <div class="recording-tip">{{ isCancelRecording ? '上滑可取消' : '松开发送，上滑取消' }}</div>
        </div>
      </div>
    </van-overlay>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { showToast, showSuccessToast, showFailToast, showConfirmDialog } from 'vant'
import { useUserStore } from '@/stores/user'
import { useChatStore } from '@/stores/chat'
import { fileApi } from '@/api/modules'
import CallPanel from '@/components/CallPanel.vue'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const chatStore = useChatStore()

const inputMessage = ref('')
const messageListRef = ref(null)
const fileInputRef = ref(null)
const showFilePicker = ref(false)
const showMore = ref(false)
const showGroupMembers = ref(false)
const showInviteMember = ref(false)
const showRemark = ref(false)
const remarkInput = ref('')
const showImagePreview = ref(false)
const previewImages = ref([])
const callPanelRef = ref(null)

// 录音状态
const isRecording = ref(false)
const isCancelRecording = ref(false)
const recordingDuration = ref(0)
const mediaRecorder = ref(null)
const recordingTimer = ref(null)
const touchStartY = ref(0)

// 音频播放
const playingAudioId = ref(null)
const audioPlayer = ref(null)

// 聊天标题
const chatTitle = computed(() => {
  if (chatStore.chatType === 'friend' && chatStore.currentFriend) {
    return chatStore.currentFriend.remark || chatStore.currentFriend.username
  }
  if (chatStore.chatType === 'group' && chatStore.currentGroup) {
    return chatStore.currentGroup.groupName
  }
  return '聊天'
})

const currentMessages = computed(() => chatStore.getCurrentMessages())
const currentMembers = computed(() => chatStore.getCurrentMembers())

// 邀请成员选项
const inviteOptions = computed(() => {
  return chatStore.friends
    .filter(f => !currentMembers.value.find(m => m.userId === f.friendId))
    .map(f => ({ text: f.remark || f.username, value: f.friendId }))
})

// 更多操作
const moreActions = computed(() => {
  if (chatStore.chatType === 'friend') {
    return [
      { name: '语音通话', value: 'audio' },
      { name: '视频通话', value: 'video' },
      { name: '修改备注', value: 'remark' },
      { name: '清除聊天', value: 'clear' },
      { name: '删除好友', value: 'delete', color: '#ee0a24' }
    ]
  } else {
    return [
      { name: '查看成员', value: 'members' },
      { name: '清除聊天', value: 'clear' }
    ]
  }
})

onMounted(async () => {
  const chatType = route.meta.chatType
  const id = route.params.id

  // 确保 SSE 连接活跃
  if (!chatStore.sseConnection || chatStore.sseConnection.readyState === EventSource.CLOSED) {
    chatStore.connectSSE(userStore.token)
  }

  if (chatType === 'friend') {
    const friend = chatStore.friends.find(f => f.friendId === Number(id))
    if (friend) {
      chatStore.selectFriend(friend)
    } else {
      await chatStore.loadFriends()
      const loadedFriend = chatStore.friends.find(f => f.friendId === Number(id))
      if (loadedFriend) {
        chatStore.selectFriend(loadedFriend)
      }
    }
    if (chatStore.currentFriend) {
      await chatStore.loadMessages(chatStore.currentFriend.friendId)
    }
  } else if (chatType === 'group') {
    const group = chatStore.groups.find(g => g.groupId === Number(id))
    if (group) {
      chatStore.selectGroup(group)
    } else {
      await chatStore.loadGroups()
      const loadedGroup = chatStore.groups.find(g => g.groupId === Number(id))
      if (loadedGroup) {
        chatStore.selectGroup(loadedGroup)
      }
    }
    if (chatStore.currentGroup) {
      await chatStore.loadGroupMessages(chatStore.currentGroup.groupId)
      await chatStore.loadGroupMembers(chatStore.currentGroup.groupId)
    }
  }

  scrollToBottom()
})

onUnmounted(() => {
  stopRecordingTimer()
  if (audioPlayer.value) {
    audioPlayer.value.pause()
    audioPlayer.value = null
  }
})

// 监听消息变化，滚动到底部
watch(currentMessages, () => {
  nextTick(scrollToBottom)
}, { deep: true })

// 监听 store 中的消息变化
watch(
  () => chatStore.messages,
  () => {
    nextTick(scrollToBottom)
  },
  { deep: true }
)

watch(
  () => chatStore.groupMessages,
  () => {
    nextTick(scrollToBottom)
  },
  { deep: true }
)

// 监听远程信令
watch(() => chatStore.remoteSignal, (signal) => {
  if (!signal || !callPanelRef.value) return

  if (signal.type === 'answer') {
    callPanelRef.value.handleRemoteAnswer(signal.data)
  } else if (signal.type === 'ice_candidate') {
    callPanelRef.value.handleRemoteIceCandidate(signal.data)
  }

  chatStore.clearRemoteSignal()
})

function goBack() {
  chatStore.clearSelection()
  router.push('/')
}

function scrollToBottom() {
  if (messageListRef.value) {
    messageListRef.value.scrollTop = messageListRef.value.scrollHeight
  }
}

async function handleSend() {
  if (!inputMessage.value.trim()) return

  const content = inputMessage.value.trim()
  inputMessage.value = ''

  try {
    if (chatStore.chatType === 'friend' && chatStore.currentFriend) {
      await chatStore.sendMessage(chatStore.currentFriend.friendId, content)
    } else if (chatStore.chatType === 'group' && chatStore.currentGroup) {
      await chatStore.sendGroupMessage(chatStore.currentGroup.groupId, content, [])
    }
    scrollToBottom()
  } catch (error) {
    showFailToast(error.message || '发送失败')
  }
}

function selectFile(type) {
  showFilePicker.value = false
  if (type === 'camera') {
    fileInputRef.value.accept = 'image/*'
    fileInputRef.value.capture = 'environment'
  } else {
    fileInputRef.value.accept = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar'
    fileInputRef.value.capture = ''
  }
  fileInputRef.value.click()
}

async function handleFileSelect(event) {
  const file = event.target.files[0]
  if (!file) return

  try {
    showToast('正在上传...')
    if (chatStore.chatType === 'friend' && chatStore.currentFriend) {
      await chatStore.uploadAndSendFile(chatStore.currentFriend.friendId, file)
    } else if (chatStore.chatType === 'group' && chatStore.currentGroup) {
      await chatStore.uploadAndSendGroupFile(chatStore.currentGroup.groupId, file, [])
    }
    scrollToBottom()
    showSuccessToast('发送成功')
  } catch (error) {
    showFailToast(error.message || '上传失败')
  }

  event.target.value = ''
}

async function handleMoreAction(action) {
  showMore.value = false

  if (action.value === 'audio') {
    if (chatStore.currentFriend) {
      chatStore.startCall(chatStore.currentFriend, 'audio')
    }
  } else if (action.value === 'video') {
    if (chatStore.currentFriend) {
      chatStore.startCall(chatStore.currentFriend, 'video')
    }
  } else if (action.value === 'remark') {
    remarkInput.value = chatStore.currentFriend?.remark || ''
    showRemark.value = true
  } else if (action.value === 'clear') {
    try {
      await showConfirmDialog({
        title: '确认清除',
        message: '确定要清除聊天记录吗？'
      })
      if (chatStore.chatType === 'friend' && chatStore.currentFriend) {
        await chatStore.clearMessages(chatStore.currentFriend.friendId)
      }
      showSuccessToast('已清除')
    } catch {}
  } else if (action.value === 'delete') {
    try {
      await showConfirmDialog({
        title: '确认删除',
        message: '确定要删除该好友吗？'
      })
      await chatStore.deleteFriend(chatStore.currentFriend.friendId)
      showSuccessToast('已删除')
      goBack()
    } catch {}
  } else if (action.value === 'members') {
    showGroupMembers.value = true
  }
}

async function handleSetRemark() {
  if (!chatStore.currentFriend) return

  try {
    await chatStore.setRemark(chatStore.currentFriend.friendId, remarkInput.value)
    showRemark.value = false
    showSuccessToast('修改备注成功')
  } catch (error) {
    showFailToast(error.message || '修改失败')
  }
}

function canManageMember(member) {
  const myRole = chatStore.currentGroup?.role
  if (myRole === 'owner') return member.role !== 'owner'
  if (myRole === 'admin') return member.role === 'member'
  return false
}

async function handleSetAdmin(memberId, isAdmin) {
  try {
    await chatStore.setAdmin(chatStore.currentGroup.groupId, memberId, isAdmin)
    showSuccessToast(isAdmin ? '已设为管理员' : '已取消管理员')
  } catch (error) {
    showFailToast(error.message || '操作失败')
  }
}

async function handleRemoveMember(memberId) {
  try {
    await showConfirmDialog({
      title: '确认移除',
      message: '确定要移除该成员吗？'
    })
    await chatStore.removeMember(chatStore.currentGroup.groupId, memberId)
    showSuccessToast('已移除成员')
  } catch {}
}

async function handleQuitGroup() {
  try {
    await showConfirmDialog({
      title: '确认退出',
      message: chatStore.currentGroup?.role === 'owner' ? '您是群主，退出后群主将转让给其他成员。确定要退出吗？' : '确定要退出群组吗？'
    })
    await chatStore.quitGroup(chatStore.currentGroup.groupId)
    showGroupMembers.value = false
    showSuccessToast('已退出群组')
    goBack()
  } catch {}
}

async function handleInviteConfirm({ selectedOptions }) {
  const selectedValue = selectedOptions[0].value
  try {
    await chatStore.inviteMember(chatStore.currentGroup.groupId, selectedValue)
    showInviteMember.value = false
    showSuccessToast('邀请已发送，等待管理员审核')
  } catch (error) {
    showFailToast(error.message || '邀请失败')
  }
}

function getFileUrl(fileId) {
  return fileApi.getDownloadUrl(fileId, userStore.token)
}

function previewImage(url) {
  previewImages.value = [url]
  showImagePreview.value = true
}

function downloadFile(fileId, fileName) {
  const url = getFileUrl(fileId)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function getAvatarUrl(avatar) {
  if (!avatar || avatar === 'default-avatar.png') {
    return null
  }
  return avatar
}

function getSenderAvatar(msg) {
  if (chatStore.chatType === 'friend') {
    return chatStore.currentFriend?.avatar
  }
  const member = currentMembers.value.find(m => m.userId === msg.senderId)
  return member?.avatar
}

function formatFileSize(size) {
  if (!size) return ''
  if (size < 1024) return size + ' B'
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB'
  return (size / 1024 / 1024).toFixed(1) + ' MB'
}

function formatTime(time) {
  if (!time) return ''
  const date = new Date(time)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function getRoleLabel(role) {
  if (role === 'owner') return '群主'
  if (role === 'admin') return '管理员'
  return '成员'
}

function parseMentionContent(content, mentionIds) {
  if (!mentionIds || mentionIds.length === 0) {
    return [{ text: content, isMention: false }]
  }

  const result = []
  const regex = /@(\S+)/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      result.push({ text: content.slice(lastIndex, match.index), isMention: false })
    }
    result.push({ text: match[1], isMention: true })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < content.length) {
    result.push({ text: content.slice(lastIndex), isMention: false })
  }

  return result
}

// ==================== 长按录音功能 ====================
let recordingChunks = []

async function onVoiceTouchStart(e) {
  touchStartY.value = e.touches[0].clientY
  isCancelRecording.value = false

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder.value = new MediaRecorder(stream, { mimeType: 'audio/webm' })
    recordingChunks = []

    mediaRecorder.value.ondataavailable = (e) => {
      if (e.data.size > 0) {
        recordingChunks.push(e.data)
      }
    }

    mediaRecorder.value.onstop = async () => {
      stream.getTracks().forEach(track => track.stop())

      if (!isCancelRecording.value && recordingDuration.value > 0) {
        const blob = new Blob(recordingChunks, { type: 'audio/webm' })
        try {
          if (chatStore.chatType === 'friend' && chatStore.currentFriend) {
            await chatStore.uploadAndSendAudio(chatStore.currentFriend.friendId, blob, recordingDuration.value)
          } else if (chatStore.chatType === 'group' && chatStore.currentGroup) {
            await chatStore.uploadAndSendGroupAudio(chatStore.currentGroup.groupId, blob, recordingDuration.value, [])
          }
          scrollToBottom()
          showSuccessToast('发送成功')
        } catch (error) {
          showFailToast(error.message || '发送失败')
        }
      } else if (isCancelRecording.value) {
        showToast('已取消')
      }

      isRecording.value = false
      isCancelRecording.value = false
      recordingDuration.value = 0
      stopRecordingTimer()
    }

    mediaRecorder.value.start()
    isRecording.value = true
    recordingDuration.value = 0
    startRecordingTimer()
  } catch (err) {
    showFailToast('无法获取麦克风权限')
  }
}

function onVoiceTouchMove(e) {
  if (!isRecording.value) return

  const currentY = e.touches[0].clientY
  const diff = touchStartY.value - currentY

  // 上滑超过 100px 触发取消
  isCancelRecording.value = diff > 100
}

function onVoiceTouchEnd() {
  if (mediaRecorder.value && mediaRecorder.value.state !== 'inactive') {
    mediaRecorder.value.stop()
  }
}

function startRecordingTimer() {
  recordingTimer.value = setInterval(() => {
    recordingDuration.value++
  }, 1000)
}

function stopRecordingTimer() {
  if (recordingTimer.value) {
    clearInterval(recordingTimer.value)
    recordingTimer.value = null
  }
}

// 音频播放
function playAudio(msg) {
  const fileId = msg.fileId

  if (playingAudioId.value === fileId && audioPlayer.value) {
    audioPlayer.value.pause()
    audioPlayer.value = null
    playingAudioId.value = null
    return
  }

  if (audioPlayer.value) {
    audioPlayer.value.pause()
  }

  const url = getFileUrl(fileId)
  audioPlayer.value = new Audio(url)
  playingAudioId.value = fileId

  audioPlayer.value.onended = () => {
    playingAudioId.value = null
    audioPlayer.value = null
  }

  audioPlayer.value.onerror = () => {
    showFailToast('音频播放失败')
    playingAudioId.value = null
    audioPlayer.value = null
  }

  audioPlayer.value.play()
}

function isPlaying(fileId) {
  return playingAudioId.value === fileId
}

async function handleCallSignal(signal) {
  await chatStore.handleCallSignal(signal.signalType, signal.signalData)
}
</script>

<style scoped>
.chat-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
}

.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.message-self {
  flex-direction: row-reverse;
}

.message-avatar {
  flex-shrink: 0;
}

.message-content {
  max-width: 70%;
  padding: 10px 14px;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.message-self .message-content {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.message-sender {
  font-size: 12px;
  color: #667eea;
  margin-bottom: 4px;
}

.message-text {
  word-break: break-word;
  line-height: 1.5;
}

.mention-highlight {
  color: #667eea;
  background: #f0f4ff;
  padding: 2px 4px;
  border-radius: 4px;
}

.message-self .mention-highlight {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.message-image {
  max-width: 200px;
}

.message-image .van-image {
  border-radius: 4px;
}

.message-file {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
}

.message-self .message-file {
  background: rgba(255, 255, 255, 0.15);
}

.file-name {
  flex: 1;
}

.file-size {
  color: #999;
  font-size: 12px;
}

.message-self .file-size {
  color: rgba(255, 255, 255, 0.7);
}

.message-audio {
  display: flex;
  align-items: center;
  gap: 8px;
}

.audio-duration {
  color: #666;
  font-size: 12px;
}

.message-self .audio-duration {
  color: rgba(255, 255, 255, 0.8);
}

.message-time {
  font-size: 11px;
  color: #aaa;
  margin-top: 4px;
}

.message-self .message-time {
  color: rgba(255, 255, 255, 0.6);
}

.chat-input-area {
  background: #fff;
  padding: 10px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-top: 1px solid #eee;
}

.chat-input-area .van-field {
  flex: 1;
  background: #f5f5f5;
  border-radius: 8px;
}

/* 录音按钮样式 */
.voice-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s;
}

.voice-btn:active {
  background: #f0f0f0;
}

.voice-btn-recording {
  background: #ee0a24;
}

.voice-btn-recording .van-icon {
  color: #fff;
}

.voice-btn-cancel {
  background: #999;
}

.voice-btn-cancel .van-icon {
  color: #fff;
}

.group-members-popup {
  padding: 16px;
  max-height: 60vh;
  overflow-y: auto;
}

.popup-content {
  padding: 16px;
}

/* 录音提示样式 */
.recording-overlay-wrapper {
  pointer-events: none;
}

.recording-overlay {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
}

.recording-content {
  background: rgba(0, 0, 0, 0.7);
  padding: 30px 50px;
  border-radius: 12px;
  text-align: center;
}

.recording-text {
  color: #fff;
  font-size: 18px;
  margin-top: 16px;
}

.recording-tip {
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  margin-top: 8px;
}
</style>