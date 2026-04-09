<template>
  <div class="chat-container">
    <!-- 移动端侧边栏遮罩 -->
    <div v-if="showMobileSidebar" class="mobile-sidebar-overlay" @click="showMobileSidebar = false"></div>

    <!-- 左侧好友/群组列表 -->
    <div :class="['sidebar', { 'sidebar-mobile': showMobileSidebar }]">
      <div class="sidebar-header">
        <div class="user-info" @click="showProfileModal = true">
          <n-avatar round size="small" :src="getAvatarUrl(userStore.avatar)" />
          <span class="username">{{ userStore.username }}</span>
        </div>
        <n-dropdown :options="actionOptions" @select="handleActionSelect">
          <n-button size="small" secondary>
            操作
            <template #icon>
              <n-icon><EllipsisVertical /></n-icon>
            </template>
          </n-button>
        </n-dropdown>
      </div>

      <!-- Tab 切换 -->
      <n-tabs v-model:value="sidebarTab" type="line" size="small">
        <n-tab-pane name="friends" tab="好友">
          <!-- 好友申请通知 -->
          <div v-if="chatStore.friendRequests.length > 0" class="friend-requests">
            <div class="requests-header">
              <span>好友申请</span>
              <n-badge :value="chatStore.friendRequests.length" :max="99" />
            </div>
            <n-list hoverable clickable>
              <n-list-item
                v-for="request in chatStore.friendRequests"
                :key="request.requestId"
              >
                <n-thing>
                  <template #avatar>
                    <n-avatar round size="small" :src="getAvatarUrl(request.fromAvatar)" />
                  </template>
                  <template #header>
                    {{ request.fromUsername }}
                  </template>
                  <template #action>
                    <n-space>
                      <n-button size="tiny" type="primary" @click="handleAcceptRequest(request.requestId)">
                        接受
                      </n-button>
                      <n-button size="tiny" @click="handleRejectRequest(request.requestId)">
                        拒绝
                      </n-button>
                    </n-space>
                  </template>
                </n-thing>
              </n-list-item>
            </n-list>
          </div>

          <div class="friend-list">
            <div class="list-header">好友列表</div>
            <n-list hoverable clickable>
              <n-list-item
                v-for="friend in chatStore.friends"
                :key="friend.friendId"
                :class="{ active: chatStore.chatType === 'friend' && chatStore.currentFriend?.friendId === friend.friendId }"
                @click="selectFriend(friend)"
              >
                <n-thing>
                  <template #avatar>
                    <n-badge :value="chatStore.unreadCounts[friend.friendId]" :max="99" :show="chatStore.unreadCounts[friend.friendId] > 0">
                      <n-avatar round size="small" :src="getAvatarUrl(friend.avatar)" />
                    </n-badge>
                  </template>
                  <template #header>
                    {{ friend.remark || friend.username }}
                  </template>
                  <template #description>
                    {{ friend.username }}
                  </template>
                </n-thing>
              </n-list-item>
            </n-list>
          </div>
        </n-tab-pane>

        <n-tab-pane name="groups" tab="群组">
          <!-- 群邀请通知 -->
          <div v-if="chatStore.groupInvites.length > 0" class="friend-requests">
            <div class="requests-header">
              <span>待审核邀请</span>
              <n-badge :value="chatStore.groupInvites.length" :max="99" />
            </div>
            <n-list hoverable clickable>
              <n-list-item
                v-for="invite in chatStore.groupInvites"
                :key="invite.inviteId"
              >
                <n-thing>
                  <template #header>
                    {{ invite.inviterUsername }} 邀请 {{ invite.inviteeUsername }} 加入 {{ invite.groupName }}
                  </template>
                  <template #action>
                    <n-space>
                      <n-button size="tiny" type="primary" @click="handleApproveInvite(invite.inviteId, true)">
                        通过
                      </n-button>
                      <n-button size="tiny" @click="handleApproveInvite(invite.inviteId, false)">
                        拒绝
                      </n-button>
                    </n-space>
                  </template>
                </n-thing>
              </n-list-item>
            </n-list>
          </div>

          <div class="friend-list">
            <div class="list-header">群组列表</div>
            <n-list hoverable clickable>
              <n-list-item
                v-for="group in chatStore.groups"
                :key="group.groupId"
                :class="{ active: chatStore.chatType === 'group' && chatStore.currentGroup?.groupId === group.groupId }"
                @click="selectGroup(group)"
              >
                <n-thing>
                  <template #avatar>
                    <n-badge :value="chatStore.groupUnreadCounts[group.groupId]" :max="99" :show="chatStore.groupUnreadCounts[group.groupId] > 0">
                      <n-avatar round size="small" />
                    </n-badge>
                  </template>
                  <template #header>
                    {{ group.groupName }}
                  </template>
                  <template #description>
                    {{ group.role === 'owner' ? '群主' : (group.role === 'admin' ? '管理员' : '成员') }}
                  </template>
                </n-thing>
              </n-list-item>
            </n-list>
          </div>
        </n-tab-pane>
      </n-tabs>
    </div>

    <!-- 右侧聊天区域 -->
    <div class="chat-main">
      <!-- 空状态 -->
      <template v-if="!chatStore.currentFriend && !chatStore.currentGroup">
        <div class="empty-chat">
          <div class="empty-content">
            <div class="empty-icon">💬</div>
            <div class="empty-title">欢迎使用即时通讯</div>
            <div class="empty-desc">选择好友或群组开始聊天</div>
          </div>
        </div>
      </template>

      <!-- 私聊界面 -->
      <template v-else-if="chatStore.chatType === 'friend' && chatStore.currentFriend">
        <div class="chat-header">
          <n-button class="mobile-back-btn" size="small" quaternary @click="showMobileSidebar = true">
            <template #icon>
              <n-icon><EllipsisVertical /></n-icon>
            </template>
          </n-button>
          <span>{{ chatStore.currentFriend.remark || chatStore.currentFriend.username }}</span>
          <n-dropdown :options="friendOptions" @select="handleFriendAction">
            <n-button size="small">更多</n-button>
          </n-dropdown>
        </div>
        <div class="message-list" ref="messageListRef">
          <div
            v-for="msg in currentMessages"
            :key="msg.id"
            :class="['message', { 'message-self': msg.senderId === userStore.userId }]"
          >
            <!-- 文本消息 -->
            <div v-if="msg.messageType === 'text' || !msg.messageType" class="message-content">{{ msg.content }}</div>
            <!-- 图片消息 -->
            <div v-else-if="msg.messageType === 'image'" class="message-image">
              <img :src="getFileUrl(msg.fileId)" alt="图片" @click="previewImage(getFileUrl(msg.fileId))" />
            </div>
            <!-- 文件消息 -->
            <div v-else-if="msg.messageType === 'file'" class="message-file">
              <n-button text @click="downloadFile(msg.fileId, msg.fileName || msg.content)">
                <template #icon>
                  <DocumentTextOutline />
                </template>
                {{ msg.fileName || msg.content }}
                <span class="file-size">({{ formatFileSize(msg.fileSize) }})</span>
              </n-button>
            </div>
            <!-- 音频消息 -->
            <div v-else-if="msg.messageType === 'audio'" class="message-audio">
              <n-button
                :type="isPlaying(msg.fileId) ? 'primary' : 'default'"
                size="small"
                @click="playAudio(msg)"
              >
                <template #icon>
                  <MicOutline />
                </template>
                {{ isPlaying(msg.fileId) ? '暂停' : '播放' }}
              </n-button>
              <span class="audio-duration">{{ formatDuration(msg.duration || 0) }}</span>
            </div>
            <div class="message-time">{{ formatTime(msg.sendTime) }}</div>
          </div>
        </div>
        <div class="chat-input-area">
          <n-input
            v-model:value="inputMessage"
            type="textarea"
            placeholder="输入消息... (支持粘贴图片/文件)"
            :autosize="{ minRows: 2, maxRows: 5 }"
            @keyup.enter="handleSend"
            @paste="handlePaste"
          />
          <div class="chat-toolbar">
            <div class="toolbar-left">
              <n-upload
                :show-file-list="false"
                :custom-request="handleFileUpload"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
              >
                <n-button size="small" quaternary>
                  <template #icon>
                    <CloudUploadOutline />
                  </template>
                  发送图片/文件
                </n-button>
              </n-upload>
              <n-button
                :type="isRecording ? 'error' : 'default'"
                size="small"
                @mousedown="startRecording"
                @mouseup="stopRecording"
                @mouseleave="stopRecording"
              >
                <template #icon>
                  <MicOutline />
                </template>
                {{ isRecording ? `录音中 ${formatDuration(recordingDuration)}` : '按住录音' }}
              </n-button>
              <n-button size="small" quaternary @click="startAudioCall">
                <template #icon>
                  <CallOutline />
                </template>
                语音
              </n-button>
              <n-button size="small" quaternary @click="startVideoCall">
                <template #icon>
                  <VideocamOutline />
                </template>
                视频
              </n-button>
              <n-button size="small" quaternary @click="startScreenShare">
                <template #icon>
                  <TvOutline />
                </template>
                投屏
              </n-button>
            </div>
            <n-button type="primary" size="small" @click="handleSend">发送</n-button>
          </div>
        </div>
      </template>

      <!-- 群聊界面 -->
      <template v-if="chatStore.chatType === 'group' && chatStore.currentGroup">
        <div class="chat-header">
          <n-button class="mobile-back-btn" size="small" quaternary @click="showMobileSidebar = true">
            <template #icon>
              <n-icon><EllipsisVertical /></n-icon>
            </template>
          </n-button>
          <span>{{ chatStore.currentGroup.groupName }}</span>
          <n-dropdown :options="groupOptions" @select="handleGroupAction">
            <n-button size="small">群管理</n-button>
          </n-dropdown>
        </div>
        <div class="message-list" ref="messageListRef">
          <div
            v-for="msg in currentMessages"
            :key="msg.id"
            :class="['message', 'message-group', { 'message-self': msg.senderId === userStore.userId }]"
          >
            <div v-if="msg.senderId !== userStore.userId" class="message-sender">{{ msg.senderUsername }}</div>
            <!-- 文本消息 -->
            <div v-if="msg.messageType === 'text' || !msg.messageType" class="message-content">
              <span v-for="(part, idx) in parseMentionContent(msg.content, msg.mentionIds)" :key="idx">
                <span v-if="part.isMention" class="mention-highlight">@{{ part.text }}</span>
                <span v-else>{{ part.text }}</span>
              </span>
            </div>
            <!-- 图片消息 -->
            <div v-else-if="msg.messageType === 'image'" class="message-image">
              <img :src="getFileUrl(msg.fileId)" alt="图片" @click="previewImage(getFileUrl(msg.fileId))" />
            </div>
            <!-- 文件消息 -->
            <div v-else-if="msg.messageType === 'file'" class="message-file">
              <n-button text @click="downloadFile(msg.fileId, msg.fileName || msg.content)">
                <template #icon>
                  <DocumentTextOutline />
                </template>
                {{ msg.fileName || msg.content }}
                <span class="file-size">({{ formatFileSize(msg.fileSize) }})</span>
              </n-button>
            </div>
            <!-- 音频消息 -->
            <div v-else-if="msg.messageType === 'audio'" class="message-audio">
              <n-button
                :type="isPlaying(msg.fileId) ? 'primary' : 'default'"
                size="small"
                @click="playAudio(msg)"
              >
                <template #icon>
                  <MicOutline />
                </template>
                {{ isPlaying(msg.fileId) ? '暂停' : '播放' }}
              </n-button>
              <span class="audio-duration">{{ formatDuration(msg.duration || 0) }}</span>
            </div>
            <div class="message-time">{{ formatTime(msg.sendTime) }}</div>
          </div>
        </div>
        <div class="chat-input-area">
          <n-input
            v-model:value="inputMessage"
            type="textarea"
            placeholder="输入消息... (输入 @ 可提及成员)"
            :autosize="{ minRows: 2, maxRows: 5 }"
            @keyup.enter="handleGroupSend"
            @paste="handleGroupPaste"
          />
          <div class="chat-toolbar">
            <div class="toolbar-left">
              <n-upload
                :show-file-list="false"
                :custom-request="handleGroupFileUpload"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
              >
                <n-button size="small" quaternary>
                  <template #icon>
                    <CloudUploadOutline />
                  </template>
                  发送图片/文件
                </n-button>
              </n-upload>
              <n-button
                :type="isRecording ? 'error' : 'default'"
                size="small"
                @mousedown="startGroupRecording"
                @mouseup="stopGroupRecording"
                @mouseleave="stopGroupRecording"
              >
                <template #icon>
                  <MicOutline />
                </template>
                {{ isRecording ? `录音中 ${formatDuration(recordingDuration)}` : '按住录音' }}
              </n-button>
            </div>
            <n-button type="primary" size="small" @click="handleGroupSend">发送</n-button>
          </div>
          <!-- @成员选择 -->
          <div v-if="showMentionPicker && currentMembers.length > 0" class="mention-picker">
            <n-list hoverable clickable size="small">
              <n-list-item
                v-for="member in currentMembers.filter(m => m.userId !== userStore.userId)"
                :key="member.userId"
                @click="insertMention(member)"
              >
                <n-thing>
                  <template #avatar>
                    <n-avatar round size="tiny" :src="getAvatarUrl(member.avatar)" />
                  </template>
                  <template #header>
                    {{ member.username }} ({{ member.role === 'owner' ? '群主' : (member.role === 'admin' ? '管理员' : '成员') }})
                  </template>
                </n-thing>
              </n-list-item>
            </n-list>
          </div>
        </div>
      </template>
    </div>

    <!-- 添加好友弹窗 -->
    <n-modal v-model:show="showAddFriendModal" preset="dialog" title="添加好友">
      <n-input v-model:value="addFriendUsername" placeholder="输入好友用户名" />
      <template #action>
        <n-button @click="handleAddFriend">添加</n-button>
      </template>
    </n-modal>

    <!-- 创建群组弹窗 -->
    <n-modal v-model:show="showCreateGroupModal" preset="dialog" title="创建群组">
      <n-input v-model:value="createGroupName" placeholder="输入群组名称" style="margin-bottom: 12px" />
      <div class="member-selector">
        <div class="selector-label">选择成员：</div>
        <n-checkbox-group v-model:value="createGroupMembers">
          <n-space>
            <n-checkbox v-for="friend in chatStore.friends" :key="friend.friendId" :value="friend.friendId" :label="friend.remark || friend.username" />
          </n-space>
        </n-checkbox-group>
      </div>
      <template #action>
        <n-button type="primary" @click="handleCreateGroup">创建</n-button>
      </template>
    </n-modal>

    <!-- 群成员列表弹窗 -->
    <n-modal v-model:show="showGroupMembersModal" preset="card" title="群成员" style="width: 400px">
      <n-list>
        <n-list-item v-for="member in currentMembers" :key="member.userId">
          <n-thing>
            <template #avatar>
              <n-avatar round size="small" :src="getAvatarUrl(member.avatar)" />
            </template>
            <template #header>
              {{ member.username }}
            </template>
            <template #description>
              {{ member.role === 'owner' ? '群主' : (member.role === 'admin' ? '管理员' : '成员') }}
            </template>
            <template #action>
              <n-space v-if="canManageMember(member)">
                <n-button size="tiny" v-if="member.role === 'member' && chatStore.currentGroup?.role === 'owner'" @click="handleSetAdmin(member.userId, true)">设为管理员</n-button>
                <n-button size="tiny" v-if="member.role === 'admin' && chatStore.currentGroup?.role === 'owner'" @click="handleSetAdmin(member.userId, false)">取消管理员</n-button>
                <n-button size="tiny" type="error" @click="handleRemoveMember(member.userId)">移除</n-button>
              </n-space>
            </template>
          </n-thing>
        </n-list-item>
      </n-list>
      <template #footer>
        <n-space>
          <n-button @click="showInviteMemberModal = true">邀请成员</n-button>
          <n-button type="error" @click="handleQuitGroup">退出群组</n-button>
          <n-button v-if="chatStore.currentGroup?.role === 'owner'" type="warning" @click="showTransferModal = true">转让群主</n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- 邀请成员弹窗 -->
    <n-modal v-model:show="showInviteMemberModal" preset="dialog" title="邀请成员">
      <n-select
        v-model:value="inviteMemberId"
        :options="inviteOptions"
        placeholder="选择要邀请的好友"
        filterable
      />
      <template #action>
        <n-button type="primary" @click="handleInviteMember">邀请</n-button>
      </template>
    </n-modal>

    <!-- 转让群主弹窗 -->
    <n-modal v-model:show="showTransferModal" preset="dialog" title="转让群主">
      <n-select
        v-model:value="transferToUserId"
        :options="transferOptions"
        placeholder="选择新群主"
      />
      <template #action>
        <n-button type="warning" @click="handleTransferOwner">转让</n-button>
      </template>
    </n-modal>

    <!-- 修改备注弹窗 -->
    <n-modal v-model:show="showRemarkModal" preset="dialog" title="修改备注">
      <n-input v-model:value="remarkInput" placeholder="输入备注名" />
      <template #action>
        <n-button @click="handleSetRemark">保存</n-button>
      </template>
    </n-modal>

    <!-- 个人信息弹窗 -->
    <n-modal v-model:show="showProfileModal" preset="card" title="个人信息" style="width: 400px;">
      <n-tabs type="line">
        <n-tab-pane name="avatar" tab="修改头像">
          <div class="avatar-upload">
            <n-avatar :size="100" round :src="avatarPreview || getAvatarUrl(userStore.avatar)" />
            <n-upload
              :show-file-list="false"
              :custom-request="handleAvatarUpload"
              accept="image/*"
            >
              <n-button style="margin-top: 16px;">选择图片</n-button>
            </n-upload>
            <n-button
              v-if="avatarPreview"
              type="primary"
              style="margin-top: 8px;"
              @click="saveAvatar"
              :loading="avatarUploading"
            >
              保存头像
            </n-button>
          </div>
        </n-tab-pane>
        <n-tab-pane name="password" tab="修改密码">
          <n-form ref="passwordFormRef" :model="passwordForm" :rules="passwordRules">
            <n-form-item label="原密码" path="oldPassword">
              <n-input v-model:value="passwordForm.oldPassword" type="password" placeholder="请输入原密码" />
            </n-form-item>
            <n-form-item label="新密码" path="newPassword">
              <n-input v-model:value="passwordForm.newPassword" type="password" placeholder="请输入新密码" />
            </n-form-item>
            <n-form-item label="确认密码" path="confirmPassword">
              <n-input v-model:value="passwordForm.confirmPassword" type="password" placeholder="请再次输入新密码" />
            </n-form-item>
          </n-form>
          <n-button type="primary" block @click="handleChangePassword" :loading="passwordChanging">
            修改密码
          </n-button>
        </n-tab-pane>
      </n-tabs>
    </n-modal>

    <!-- 图片预览 -->
    <n-modal v-model:show="showImagePreview" preset="card" style="width: auto; max-width: 90vw; max-height: 90vh;">
      <img :src="previewImageUrl" style="max-width: 100%; max-height: 80vh; object-fit: contain;" />
    </n-modal>

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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useMessage, useDialog } from 'naive-ui'
import { DocumentTextOutline, CloudUploadOutline, MicOutline, VideocamOutline, CallOutline, TvOutline, EllipsisVertical } from '@vicons/ionicons5'
import { useUserStore } from '@/stores/user'
import { useChatStore } from '@/stores/chat'
import { fileApi } from '@/api/modules'
import api from '@/api/index'
import CallPanel from '@/components/CallPanel.vue'

const router = useRouter()
const naiveMessage = useMessage()
const naiveDialog = useDialog()
const userStore = useUserStore()
const chatStore = useChatStore()

const inputMessage = ref('')
const messageListRef = ref(null)
const sidebarTab = ref('friends')
const showMobileSidebar = ref(false)

// 好友相关弹窗
const showAddFriendModal = ref(false)
const addFriendUsername = ref('')
const showRemarkModal = ref(false)
const remarkInput = ref('')

// 群组相关弹窗
const showCreateGroupModal = ref(false)
const createGroupName = ref('')
const createGroupMembers = ref([])
const showGroupMembersModal = ref(false)
const showInviteMemberModal = ref(false)
const inviteMemberId = ref(null)
const showTransferModal = ref(false)
const transferToUserId = ref(null)

// 图片预览
const showImagePreview = ref(false)
const previewImageUrl = ref('')

// 个人信息相关
const showProfileModal = ref(false)
const avatarPreview = ref('')
const avatarFile = ref(null)
const avatarUploading = ref(false)
const passwordChanging = ref(false)
const passwordFormRef = ref(null)
const passwordForm = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})
const passwordRules = {
  oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码至少6位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认新密码', trigger: 'blur' },
    {
      validator: (rule, value) => {
        return value === passwordForm.value.newPassword
      },
      message: '两次密码不一致',
      trigger: 'blur'
    }
  ]
}

// 头像上传
function handleAvatarUpload({ file }) {
  avatarFile.value = file.file
  const reader = new FileReader()
  reader.onload = (e) => {
    avatarPreview.value = e.target.result
  }
  reader.readAsDataURL(file.file)
}

async function saveAvatar() {
  if (!avatarFile.value) return

  avatarUploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', avatarFile.value)
    const res = await api.post('/user/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    userStore.avatar = res.data.avatar
    avatarPreview.value = ''
    avatarFile.value = null
    naiveMessage.success('头像更新成功')
  } catch (error) {
    naiveMessage.error(error.message || '上传失败')
  } finally {
    avatarUploading.value = false
  }
}

// 修改密码
async function handleChangePassword() {
  try {
    await passwordFormRef.value?.validate()
  } catch {
    return
  }

  passwordChanging.value = true
  try {
    await api.post('/user/change-password', {
      oldPassword: passwordForm.value.oldPassword,
      newPassword: passwordForm.value.newPassword
    })
    naiveMessage.success('密码修改成功，请重新登录')
    showProfileModal.value = false
    passwordForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' }
    // 退出登录
    handleLogout()
  } catch (error) {
    naiveMessage.error(error.message || '修改失败')
  } finally {
    passwordChanging.value = false
  }
}

// @提及相关
const showMentionPicker = ref(false)
const mentionIds = ref([])

// 录音状态
const isRecording = ref(false)
const recordingDuration = ref(0)
const mediaRecorder = ref(null)
const recordingTimer = ref(null)

// 音频播放状态
const playingAudioId = ref(null)
const audioPlayer = ref(null)
const callPanelRef = ref(null)

const currentMessages = computed(() => chatStore.getCurrentMessages())
const currentMembers = computed(() => chatStore.getCurrentMembers())

// 邀请成员选项（好友列表）
const inviteOptions = computed(() => {
  return chatStore.friends
    .filter(f => !currentMembers.value.find(m => m.userId === f.friendId))
    .map(f => ({ label: f.remark || f.username, value: f.friendId }))
})

// 转让群主选项（群成员，排除自己）
const transferOptions = computed(() => {
  return currentMembers.value
    .filter(m => m.userId !== userStore.userId)
    .map(m => ({ label: `${m.username} (${m.role === 'admin' ? '管理员' : '成员'})`, value: m.userId }))
})

const friendOptions = [
  { label: '修改备注', key: 'remark' },
  { label: '清除聊天记录', key: 'clear' },
  { label: '删除好友', key: 'delete' }
]

const groupOptions = [
  { label: '查看成员', key: 'members' },
  { label: '清除聊天记录', key: 'clear' }
]

const actionOptions = [
  { label: '添加好友', key: 'addFriend' },
  { label: '创建群组', key: 'createGroup' },
  { type: 'divider', key: 'd1' },
  { label: '退出登录', key: 'logout' }
]

function handleActionSelect(key) {
  if (key === 'addFriend') {
    showAddFriendModal.value = true
  } else if (key === 'createGroup') {
    showCreateGroupModal.value = true
  } else if (key === 'logout') {
    handleLogout()
  }
}

onMounted(async () => {
  await userStore.fetchUserInfo()
  await chatStore.loadFriends()
  await chatStore.loadFriendRequests()
  await chatStore.loadUnreadCounts()
  await chatStore.loadGroups()
  await chatStore.loadGroupInvites()
  chatStore.connectSSE(userStore.token)
})

onUnmounted(() => {
  chatStore.disconnectSSE()
  stopRecordingTimer()
  if (audioPlayer.value) {
    audioPlayer.value.pause()
    audioPlayer.value = null
  }
})

watch(() => chatStore.currentFriend, async (friend) => {
  if (friend) {
    await chatStore.loadMessages(friend.friendId)
    scrollToBottom()
  }
})

watch(() => chatStore.currentGroup, async (group) => {
  if (group) {
    await chatStore.loadGroupMessages(group.groupId)
    await chatStore.loadGroupMembers(group.groupId)
    scrollToBottom()
  }
})

watch(currentMessages, () => {
  nextTick(scrollToBottom)
}, { deep: true })

// 监听 store 中消息变化
watch(() => chatStore.messages, () => {
  nextTick(scrollToBottom)
}, { deep: true })

watch(() => chatStore.groupMessages, () => {
  nextTick(scrollToBottom)
}, { deep: true })

// 监听输入 @ 符号
watch(inputMessage, (val) => {
  if (chatStore.chatType === 'group' && chatStore.currentGroup && val.includes('@')) {
    // 检查最后输入的是 @ 符号
    const lastAtIndex = val.lastIndexOf('@')
    // 检查 @ 后面是否有空格或其他字符（如果有则说明已经选择了成员或取消了）
    const afterAt = val.slice(lastAtIndex + 1)
    // 如果 @ 后面没有内容，或者是刚输入的 @，显示选择器
    if (afterAt === '' || val.endsWith('@')) {
      showMentionPicker.value = true
    }
  } else {
    showMentionPicker.value = false
  }
})

function selectFriend(friend) {
  chatStore.selectFriend(friend)
  showMobileSidebar.value = false
}

function selectGroup(group) {
  chatStore.selectGroup(group)
  showMobileSidebar.value = false
}

// ====================== 群组相关方法 ======================
async function handleCreateGroup() {
  if (!createGroupName.value.trim()) {
    naiveMessage.warning('请输入群组名称')
    return
  }
  if (createGroupMembers.value.length < 1) {
    naiveMessage.warning('至少选择一名成员')
    return
  }

  try {
    await chatStore.createGroup(createGroupName.value.trim(), createGroupMembers.value)
    showCreateGroupModal.value = false
    createGroupName.value = ''
    createGroupMembers.value = []
    naiveMessage.success('群组创建成功')
  } catch (error) {
    naiveMessage.error(error.message || '创建失败')
  }
}

async function handleInviteMember() {
  if (!inviteMemberId.value) {
    naiveMessage.warning('请选择要邀请的成员')
    return
  }

  try {
    await chatStore.inviteMember(chatStore.currentGroup.groupId, inviteMemberId.value)
    showInviteMemberModal.value = false
    inviteMemberId.value = null
    naiveMessage.success('邀请已发送，等待管理员审核')
  } catch (error) {
    naiveMessage.error(error.message || '邀请失败')
  }
}

async function handleApproveInvite(inviteId, approve) {
  try {
    await chatStore.approveInvite(inviteId, approve)
    naiveMessage.success(approve ? '已通过邀请' : '已拒绝邀请')
  } catch (error) {
    naiveMessage.error(error.message || '操作失败')
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
    naiveMessage.success(isAdmin ? '已设为管理员' : '已取消管理员')
  } catch (error) {
    naiveMessage.error(error.message || '操作失败')
  }
}

async function handleRemoveMember(memberId) {
  naiveDialog.warning({
    title: '确认移除',
    content: '确定要移除该成员吗？',
    positiveText: '移除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await chatStore.removeMember(chatStore.currentGroup.groupId, memberId)
        naiveMessage.success('已移除成员')
      } catch (error) {
        naiveMessage.error(error.message || '移除失败')
      }
    }
  })
}

async function handleQuitGroup() {
  naiveDialog.warning({
    title: '确认退出',
    content: chatStore.currentGroup?.role === 'owner' ? '您是群主，退出后群主将转让给其他成员。确定要退出吗？' : '确定要退出群组吗？',
    positiveText: '退出',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await chatStore.quitGroup(chatStore.currentGroup.groupId)
        showGroupMembersModal.value = false
        naiveMessage.success('已退出群组')
      } catch (error) {
        naiveMessage.error(error.message || '退出失败')
      }
    }
  })
}

async function handleTransferOwner() {
  if (!transferToUserId.value) {
    naiveMessage.warning('请选择新群主')
    return
  }

  naiveDialog.warning({
    title: '确认转让',
    content: '转让后您将成为普通成员，确定要转让群主身份吗？',
    positiveText: '转让',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await chatStore.transferOwner(chatStore.currentGroup.groupId, transferToUserId.value)
        showTransferModal.value = false
        showGroupMembersModal.value = false
        transferToUserId.value = null
        naiveMessage.success('已转让群主身份')
      } catch (error) {
        naiveMessage.error(error.message || '转让失败')
      }
    }
  })
}

function handleGroupAction(key) {
  if (key === 'members') {
    showGroupMembersModal.value = true
  } else if (key === 'clear') {
    naiveDialog.warning({
      title: '确认清除',
      content: '确定要清除群组聊天记录吗？',
      positiveText: '清除',
      negativeText: '取消',
      onPositiveClick: async () => {
        naiveMessage.info('群组聊天记录清除功能开发中')
      }
    })
  }
}

// @提及功能
function insertMention(member) {
  const parts = inputMessage.value.split('@')
  parts.pop() // 移除最后的空字符串
  parts.push(`@${member.username} `)
  inputMessage.value = parts.join('')
  mentionIds.value.push(member.userId)
  showMentionPicker.value = false
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

// ====================== 群消息发送 ======================
async function handleGroupSend() {
  if (!inputMessage.value.trim() || !chatStore.currentGroup) return

  const content = inputMessage.value.trim()
  inputMessage.value = ''
  mentionIds.value = []

  try {
    await chatStore.sendGroupMessage(chatStore.currentGroup.groupId, content, mentionIds.value)
    scrollToBottom()
  } catch (error) {
    naiveMessage.error(error.message || '发送失败')
  }
}

async function handleGroupFileUpload({ file }) {
  if (!chatStore.currentGroup) {
    naiveMessage.warning('请先选择群组')
    return
  }

  try {
    naiveMessage.loading('正在上传...')
    await chatStore.uploadAndSendGroupFile(chatStore.currentGroup.groupId, file.file, mentionIds.value)
    mentionIds.value = []
    scrollToBottom()
    naiveMessage.success('发送成功')
  } catch (error) {
    naiveMessage.error(error.message || '上传失败')
  }
}

async function handleGroupPaste(event) {
  if (!chatStore.currentGroup) return

  const clipboardData = event.clipboardData || event.originalEvent?.clipboardData
  if (!clipboardData) return

  const files = clipboardData.files
  if (!files || files.length === 0) return

  event.preventDefault()

  for (const file of files) {
    const allowedTypes = ['image/', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.zip', '.rar']
    const isAllowed = allowedTypes.some(type =>
      file.type.startsWith(type) || file.name.toLowerCase().match(new RegExp(type.replace('.', '\\.') + '$'))
    )

    if (!isAllowed) {
      naiveMessage.warning(`不支持粘贴该类型文件: ${file.name}`)
      continue
    }

    try {
      naiveMessage.loading(`正在上传 ${file.name}...`)
      await chatStore.uploadAndSendGroupFile(chatStore.currentGroup.groupId, file, mentionIds.value)
      mentionIds.value = []
      scrollToBottom()
      naiveMessage.success(`${file.name} 发送成功`)
    } catch (error) {
      naiveMessage.error(error.message || `${file.name} 上传失败`)
    }
  }
}

async function startGroupRecording() {
  if (!chatStore.currentGroup) {
    naiveMessage.warning('请先选择群组')
    return
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder.value = new MediaRecorder(stream, { mimeType: 'audio/webm' })
    const chunks = []

    mediaRecorder.value.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data)
      }
    }

    mediaRecorder.value.onstop = async () => {
      const blob = new Blob(chunks, { type: 'audio/webm' })
      stream.getTracks().forEach(track => track.stop())

      if (recordingDuration.value > 0) {
        try {
          await chatStore.uploadAndSendGroupAudio(chatStore.currentGroup.groupId, blob, recordingDuration.value, mentionIds.value)
          mentionIds.value = []
          scrollToBottom()
          naiveMessage.success('录音发送成功')
        } catch (error) {
          naiveMessage.error(error.message || '录音发送失败')
        }
      }

      isRecording.value = false
      recordingDuration.value = 0
      stopRecordingTimer()
    }

    mediaRecorder.value.start()
    isRecording.value = true
    startRecordingTimer()
  } catch (err) {
    naiveMessage.error('无法获取麦克风权限')
  }
}

function stopGroupRecording() {
  if (mediaRecorder.value && mediaRecorder.value.state !== 'inactive') {
    mediaRecorder.value.stop()
  }
}

async function handleSend() {
  if (!inputMessage.value.trim() || !chatStore.currentFriend) return

  const content = inputMessage.value.trim()
  inputMessage.value = ''

  try {
    await chatStore.sendMessage(chatStore.currentFriend.friendId, content)
    scrollToBottom()
  } catch (error) {
    naiveMessage.error(error.message || '发送失败')
  }
}

async function handleFileUpload({ file }) {
  if (!chatStore.currentFriend) {
    naiveMessage.warning('请先选择好友')
    return
  }

  try {
    naiveMessage.loading('正在上传...')
    await chatStore.uploadAndSendFile(chatStore.currentFriend.friendId, file.file)
    scrollToBottom()
    naiveMessage.success('发送成功')
  } catch (error) {
    naiveMessage.error(error.message || '上传失败')
  }
}

async function handlePaste(event) {
  if (!chatStore.currentFriend) {
    return
  }

  const clipboardData = event.clipboardData || event.originalEvent?.clipboardData
  if (!clipboardData) return

  const files = clipboardData.files
  if (!files || files.length === 0) return

  // 阻止默认粘贴行为（如果是文件）
  event.preventDefault()

  // 处理粘贴的文件
  for (const file of files) {
    // 检查文件类型是否支持
    const allowedTypes = ['image/', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.zip', '.rar']
    const isAllowed = allowedTypes.some(type =>
      file.type.startsWith(type) || file.name.toLowerCase().match(new RegExp(type.replace('.', '\\.') + '$'))
    )

    if (!isAllowed) {
      naiveMessage.warning(`不支持粘贴该类型文件: ${file.name}`)
      continue
    }

    try {
      naiveMessage.loading(`正在上传 ${file.name}...`)
      await chatStore.uploadAndSendFile(chatStore.currentFriend.friendId, file)
      scrollToBottom()
      naiveMessage.success(`${file.name} 发送成功`)
    } catch (error) {
      naiveMessage.error(error.message || `${file.name} 上传失败`)
    }
  }
}

function getFileUrl(fileId) {
  return fileApi.getDownloadUrl(fileId, userStore.token)
}

function previewImage(url) {
  // 使用图片预览模态框
  previewImageUrl.value = url
  showImagePreview.value = true
}

// 获取头像URL，处理默认头像
function getAvatarUrl(avatar) {
  if (!avatar || avatar === 'default-avatar.png') {
    return null
  }
  return avatar
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

function formatFileSize(size) {
  if (!size) return ''
  if (size < 1024) return size + ' B'
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB'
  return (size / 1024 / 1024).toFixed(1) + ' MB'
}

function scrollToBottom() {
  if (messageListRef.value) {
    // 使用 setTimeout 确保 DOM 已更新
    setTimeout(() => {
      if (messageListRef.value) {
        messageListRef.value.scrollTop = messageListRef.value.scrollHeight
      }
    }, 50)
  }
}

function formatTime(time) {
  if (!time) return ''
  const date = new Date(time)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

async function handleAddFriend() {
  if (!addFriendUsername.value.trim()) return

  try {
    await chatStore.addFriend(addFriendUsername.value.trim())
    showAddFriendModal.value = false
    addFriendUsername.value = ''
    naiveMessage.success('好友申请已发送')
  } catch (error) {
    naiveMessage.error(error.message || '发送失败')
  }
}

async function handleAcceptRequest(requestId) {
  try {
    await chatStore.acceptFriendRequest(requestId)
    naiveMessage.success('已接受好友申请')
  } catch (error) {
    naiveMessage.error(error.message || '操作失败')
  }
}

async function handleRejectRequest(requestId) {
  try {
    await chatStore.rejectFriendRequest(requestId)
    naiveMessage.success('已拒绝好友申请')
  } catch (error) {
    naiveMessage.error(error.message || '操作失败')
  }
}

function handleFriendAction(key) {
  if (key === 'remark') {
    remarkInput.value = chatStore.currentFriend?.remark || ''
    showRemarkModal.value = true
  } else if (key === 'clear') {
    naiveDialog.warning({
      title: '确认清除',
      content: '确定要清除与该好友的聊天记录吗？清除后将无法恢复，相关文件也会被删除。',
      positiveText: '清除',
      negativeText: '取消',
      onPositiveClick: async () => {
        try {
          await chatStore.clearMessages(chatStore.currentFriend.friendId)
          naiveMessage.success('聊天记录已清除')
        } catch (error) {
          naiveMessage.error(error.message || '清除失败')
        }
      }
    })
  } else if (key === 'delete') {
    naiveDialog.warning({
      title: '确认删除',
      content: '确定要删除该好友吗？',
      positiveText: '删除',
      negativeText: '取消',
      onPositiveClick: async () => {
        try {
          await chatStore.deleteFriend(chatStore.currentFriend.friendId)
          naiveMessage.success('删除成功')
        } catch (error) {
          naiveMessage.error(error.message || '删除失败')
        }
      }
    })
  }
}

async function handleSetRemark() {
  if (!chatStore.currentFriend) return

  try {
    await chatStore.setRemark(chatStore.currentFriend.friendId, remarkInput.value)
    showRemarkModal.value = false
    naiveMessage.success('修改备注成功')
  } catch (error) {
    naiveMessage.error(error.message || '修改失败')
  }
}

function handleLogout() {
  chatStore.disconnectSSE()
  userStore.logout()
  router.push('/login')
}

// ====================== 录音相关 ======================
async function startRecording() {
  if (!chatStore.currentFriend) {
    naiveMessage.warning('请先选择好友')
    return
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder.value = new MediaRecorder(stream, { mimeType: 'audio/webm' })
    const chunks = []

    mediaRecorder.value.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data)
      }
    }

    mediaRecorder.value.onstop = async () => {
      const blob = new Blob(chunks, { type: 'audio/webm' })
      stream.getTracks().forEach(track => track.stop())

      if (recordingDuration.value > 0) {
        try {
          await chatStore.uploadAndSendAudio(
            chatStore.currentFriend.friendId,
            blob,
            recordingDuration.value
          )
          scrollToBottom()
          naiveMessage.success('录音发送成功')
        } catch (error) {
          naiveMessage.error(error.message || '录音发送失败')
        }
      }

      isRecording.value = false
      recordingDuration.value = 0
      stopRecordingTimer()
    }

    mediaRecorder.value.start()
    isRecording.value = true
    startRecordingTimer()
  } catch (err) {
    naiveMessage.error('无法获取麦克风权限')
  }
}

function stopRecording() {
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

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// ====================== 音频播放相关 ======================
function playAudio(msg) {
  const fileId = msg.fileId

  if (playingAudioId.value === fileId && audioPlayer.value) {
    // 当前正在播放，停止播放
    audioPlayer.value.pause()
    audioPlayer.value = null
    playingAudioId.value = null
    return
  }

  // 播放新的音频
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
    naiveMessage.error('音频播放失败')
    playingAudioId.value = null
    audioPlayer.value = null
  }

  audioPlayer.value.play()
}

function isPlaying(fileId) {
  return playingAudioId.value === fileId
}

// ====================== 通话相关 ======================
function startVideoCall() {
  if (!chatStore.currentFriend) {
    naiveMessage.warning('请先选择好友')
    return
  }
  chatStore.startCall(chatStore.currentFriend, 'video')
}

function startAudioCall() {
  if (!chatStore.currentFriend) {
    naiveMessage.warning('请先选择好友')
    return
  }
  chatStore.startCall(chatStore.currentFriend, 'audio')
}

function startScreenShare() {
  if (!chatStore.currentFriend) {
    naiveMessage.warning('请先选择好友')
    return
  }
  chatStore.startCall(chatStore.currentFriend, 'screen')
}

async function handleCallSignal(signal) {
  await chatStore.handleCallSignal(signal.signalType, signal.signalData)
}

// 监听远程信令并传递给 CallPanel
watch(() => chatStore.remoteSignal, (signal) => {
  if (!signal) return
  if (!callPanelRef.value) {
    console.warn('[Call] CallPanel ref not available')
    return
  }

  console.log('[Call] Processing remote signal:', signal.type)

  if (signal.type === 'answer') {
    callPanelRef.value.handleRemoteAnswer(signal.data)
  } else if (signal.type === 'ice_candidate') {
    callPanelRef.value.handleRemoteIceCandidate(signal.data)
  }

  chatStore.clearRemoteSignal()
})
</script>

<style scoped>
.chat-container {
  height: 100vh;
  width: 100vw;
  display: flex;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  overflow: hidden;
}

.sidebar {
  width: 300px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-right: none;
  display: flex;
  flex-direction: column;
  box-shadow: 2px 0 20px rgba(0, 0, 0, 0.1);
}

.sidebar-header {
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.sidebar-header .username {
  color: white;
}

.sidebar-header .n-button {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
}

.sidebar-header .n-button:hover {
  background: rgba(255, 255, 255, 0.3);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 12px;
  transition: all 0.3s ease;
}

.user-info:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.02);
}

.username {
  font-weight: 600;
  font-size: 15px;
}

.friend-requests {
  padding: 12px 16px;
  background: linear-gradient(135deg, #fff5f5 0%, #fff0f0 100%);
  border-bottom: none;
  max-height: 200px;
  overflow-y: auto;
}

.requests-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  font-weight: 600;
  color: #e74c3c;
}

.list-header {
  padding: 12px 20px;
  font-weight: 600;
  color: #667eea;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.friend-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px;
}

.friend-list .n-list-item {
  border-radius: 12px;
  margin: 4px 0;
  transition: all 0.3s ease;
}

.friend-list .n-list-item:hover {
  background: linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%);
  transform: translateX(4px);
}

.friend-list .n-list-item.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.friend-list .n-list-item.active .n-thing__header {
  color: white;
}

.friend-list .n-list-item.active .n-thing__description {
  color: rgba(255, 255, 255, 0.8);
}

.chat-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
}

.chat-header {
  padding: 20px 24px;
  background: linear-gradient(135deg, #f8f9ff 0%, #fff 100%);
  border-bottom: none;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 20px rgba(0, 0, 0, 0.05);
}

.chat-header span {
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.mobile-back-btn {
  display: none;
}

.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: linear-gradient(180deg, #f8f9ff 0%, #fff 100%);
}

.message {
  max-width: 65%;
  padding: 14px 18px;
  border-radius: 20px;
  background: white;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  animation: messageIn 0.3s ease;
}

@keyframes messageIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-self {
  align-self: flex-end;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-bottom-right-radius: 6px;
}

.message:not(.message-self) {
  border-bottom-left-radius: 6px;
}

.message-content {
  word-break: break-word;
  line-height: 1.6;
  font-size: 15px;
}

.message-self .message-content {
  color: white;
}

.message-image {
  max-width: 240px;
}

.message-image img {
  max-width: 100%;
  border-radius: 12px;
  cursor: pointer;
  transition: transform 0.3s ease;
}

.message-image img:hover {
  transform: scale(1.02);
}

.message-file {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 10px;
}

.message-self .message-file {
  background: rgba(255, 255, 255, 0.15);
}

.message-file .file-size {
  color: #999;
  font-size: 12px;
  margin-left: 8px;
}

.message-self .file-size {
  color: rgba(255, 255, 255, 0.7);
}

.message-audio {
  display: flex;
  align-items: center;
  gap: 12px;
}

.message-audio .audio-duration {
  color: #666;
  font-size: 13px;
}

.message-self .audio-duration {
  color: rgba(255, 255, 255, 0.8);
}

.message-time {
  font-size: 11px;
  color: #aaa;
  margin-top: 6px;
  text-align: right;
}

.message-self .message-time {
  color: rgba(255, 255, 255, 0.6);
}

.chat-input-area {
  background: white;
  padding: 16px 20px;
  border-top: none;
  position: relative;
  box-shadow: 0 -2px 20px rgba(0, 0, 0, 0.05);
}

.chat-input-area .n-input {
  background-color: #f5f7fa;
  font-size: 15px;
  border-radius: 16px;
  border: 2px solid transparent;
  transition: all 0.3s ease;
}

.chat-input-area .n-input:focus-within {
  border-color: #667eea;
  background: white;
  box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
}

.chat-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  gap: 8px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 4px;
}

.toolbar-left .n-button {
  border-radius: 10px;
  transition: all 0.3s ease;
  font-size: 13px;
}

.toolbar-left .n-button:hover {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.chat-toolbar .n-upload {
  display: inline-flex;
}

.chat-toolbar .n-button[type="primary"] {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 12px;
  padding: 8px 24px;
  font-weight: 600;
  transition: all 0.3s ease;
}

.chat-toolbar .n-button[type="primary"]:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.empty-chat {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, #f8f9ff 0%, #fff 100%);
}

.empty-content {
  text-align: center;
  padding: 40px;
}

.empty-icon {
  font-size: 80px;
  margin-bottom: 20px;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.empty-title {
  font-size: 24px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.empty-desc {
  font-size: 16px;
  color: #999;
}

/* 群聊消息样式 */
.message-group {
  position: relative;
}

.message-sender {
  font-size: 12px;
  font-weight: 600;
  color: #667eea;
  margin-bottom: 6px;
  padding-left: 4px;
}

.mention-highlight {
  color: #667eea;
  background: linear-gradient(135deg, #f0f4ff 0%, #e8edff 100%);
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.message-self .mention-highlight {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.mention-picker {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  background: white;
  border: none;
  border-radius: 16px;
  max-height: 240px;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  z-index: 10;
  margin-bottom: 8px;
}

.mention-picker .n-list-item {
  border-radius: 10px;
  margin: 4px 8px;
}

.member-selector {
  margin-top: 16px;
}

.member-selector .selector-label {
  margin-bottom: 12px;
  color: #666;
  font-weight: 500;
}

/* Tab 样式调整 */
.sidebar .n-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.sidebar .n-tabs .n-tabs-nav {
  background: #f8f9ff;
  padding: 0 16px;
}

.sidebar .n-tabs .n-tabs-tab {
  font-weight: 600;
  color: #999;
  transition: all 0.3s ease;
}

.sidebar .n-tabs .n-tabs-tab--active {
  color: #667eea;
}

.sidebar .n-tabs .n-tabs-pane-wrapper {
  flex: 1;
  overflow-y: auto;
}

.sidebar .n-tabs .n-tab-pane {
  padding: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.avatar-upload {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 0;
}

.avatar-upload .n-avatar {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  border: 3px solid #667eea;
}

/* 好友申请/群邀请动画 */
.friend-requests .n-list-item,
.n-list-item {
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* 滚动条美化 */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
}

/* 移动端适配 */
@media screen and (max-width: 768px) {
  .chat-container {
    border-radius: 0;
  }

  .sidebar {
    position: fixed;
    left: -300px;
    top: 0;
    height: 100vh;
    z-index: 1000;
    transition: left 0.3s ease;
    border-radius: 0;
  }

  .sidebar-mobile {
    left: 0;
  }

  .mobile-sidebar-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 999;
  }

  .chat-main {
    width: 100vw;
  }

  .chat-header {
    padding: 12px 16px;
  }

  .chat-header span {
    font-size: 16px;
  }

  .mobile-back-btn {
    display: flex;
  }

  .message-list {
    padding: 12px;
    gap: 8px;
  }

  .message {
    max-width: 85%;
    padding: 10px 14px;
  }

  .message-image {
    max-width: 180px;
  }

  .chat-input-area {
    padding: 12px;
  }

  .chat-toolbar {
    flex-wrap: wrap;
  }

  .toolbar-left {
    flex-wrap: wrap;
    gap: 4px;
  }

  .toolbar-left .n-button {
    padding: 4px 8px;
    font-size: 12px;
  }

  .chat-toolbar .n-button[type="primary"] {
    padding: 6px 16px;
  }

  .empty-icon {
    font-size: 60px;
  }

  .empty-title {
    font-size: 18px;
  }

  .empty-desc {
    font-size: 14px;
  }

  .empty-content {
    padding: 20px;
  }
}
</style>