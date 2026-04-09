<template>
  <div class="home-page">
    <!-- 顶部导航 -->
    <van-nav-bar title="IM Chat">
      <template #left>
        <van-badge :content="totalUnreadBadge" :show="totalUnread > 0">
          <van-icon name="chat-o" size="20" />
        </van-badge>
      </template>
      <template #right>
        <van-icon name="ellipsis" size="20" @click="showActions = true" />
      </template>
    </van-nav-bar>

    <!-- Tab 切换 -->
    <van-tabs v-model:active="activeTab" sticky>
      <!-- 好友列表 -->
      <van-tab title="好友">
        <!-- 好友申请 -->
        <div v-if="chatStore.friendRequests.length > 0" class="request-section">
          <van-cell-group inset title="好友申请">
            <van-cell
              v-for="request in chatStore.friendRequests"
              :key="request.requestId"
              :title="request.fromUsername"
              :label="formatTime(request.createTime)"
            >
              <template #icon>
                <van-avatar :src="getAvatarUrl(request.fromAvatar)" size="40" round />
              </template>
              <template #right-icon>
                <van-space>
                  <van-button size="small" type="primary" @click="handleAcceptRequest(request.requestId)">
                    接受
                  </van-button>
                  <van-button size="small" type="default" @click="handleRejectRequest(request.requestId)">
                    拒绝
                  </van-button>
                </van-space>
              </template>
            </van-cell>
          </van-cell-group>
        </div>

        <!-- 好友列表 -->
        <van-cell-group inset title="好友列表">
          <van-cell
            v-for="friend in chatStore.friends"
            :key="friend.friendId"
            :title="friend.remark || friend.username"
            :label="friend.username"
            is-link
            @click="goToFriendChat(friend)"
          >
            <template #icon>
              <van-badge :content="chatStore.unreadCounts[friend.friendId]" :show="chatStore.unreadCounts[friend.friendId] > 0">
                <van-avatar :src="getAvatarUrl(friend.avatar)" size="40" round />
              </van-badge>
            </template>
          </van-cell>
          <van-empty v-if="chatStore.friends.length === 0" description="暂无好友" />
        </van-cell-group>
      </van-tab>

      <!-- 群组列表 -->
      <van-tab title="群组">
        <!-- 群邀请审核 -->
        <div v-if="chatStore.groupInvites.length > 0" class="request-section">
          <van-cell-group inset title="待审核邀请">
            <van-cell
              v-for="invite in chatStore.groupInvites"
              :key="invite.inviteId"
              :title="invite.inviterUsername + ' 邀请 ' + invite.inviteeUsername"
              :label="invite.groupName"
            >
              <template #right-icon>
                <van-space>
                  <van-button size="small" type="primary" @click="handleApproveInvite(invite.inviteId, true)">
                    通过
                  </van-button>
                  <van-button size="small" type="default" @click="handleApproveInvite(invite.inviteId, false)">
                    拒绝
                  </van-button>
                </van-space>
              </template>
            </van-cell>
          </van-cell-group>
        </div>

        <!-- 群组列表 -->
        <van-cell-group inset title="群组列表">
          <van-cell
            v-for="group in chatStore.groups"
            :key="group.groupId"
            :title="group.groupName"
            :label="getRoleLabel(group.role)"
            is-link
            @click="goToGroupChat(group)"
          >
            <template #icon>
              <van-badge :content="chatStore.groupUnreadCounts[group.groupId]" :show="chatStore.groupUnreadCounts[group.groupId] > 0">
                <van-avatar size="40" round>群</van-avatar>
              </van-badge>
            </template>
          </van-cell>
          <van-empty v-if="chatStore.groups.length === 0" description="暂无群组" />
        </van-cell-group>
      </van-tab>
    </van-tabs>

    <!-- 操作菜单 -->
    <van-action-sheet
      v-model:show="showActions"
      :actions="actions"
      @select="onActionSelect"
    />

    <!-- 添加好友弹窗 -->
    <van-popup v-model:show="showAddFriend" position="bottom" round>
      <div class="popup-content">
        <van-field
          v-model="addFriendUsername"
          label="好友用户名"
          placeholder="输入好友用户名"
        />
        <van-button type="primary" block @click="handleAddFriend">添加</van-button>
      </div>
    </van-popup>

    <!-- 创建群组弹窗 -->
    <van-popup v-model:show="showCreateGroup" position="bottom" round>
      <div class="popup-content">
        <van-field
          v-model="createGroupName"
          label="群组名称"
          placeholder="输入群组名称"
        />
        <div class="member-select">
          <div class="member-select-label">选择成员：</div>
          <van-checkbox-group v-model="createGroupMembers">
            <van-cell-group>
              <van-cell
                v-for="f in chatStore.friends"
                :key="f.friendId"
                clickable
                @click="toggleMember(f.friendId)"
              >
                <template #title>
                  <van-checkbox :name="f.friendId">
                    {{ f.remark || f.username }}
                  </van-checkbox>
                </template>
              </van-cell>
            </van-cell-group>
          </van-checkbox-group>
        </div>
        <van-button type="primary" block @click="handleCreateGroup">创建</van-button>
      </div>
    </van-popup>

    <!-- 个人信息弹窗 -->
    <van-popup v-model:show="showProfile" position="bottom" round>
      <div class="popup-content profile-popup">
        <van-cell-group inset title="个人信息">
          <van-cell title="头像">
            <template #value>
              <van-uploader :show-upload="false" :after-read="handleAvatarUpload">
                <van-avatar :src="getAvatarUrl(userStore.avatar)" size="50" round />
              </van-uploader>
            </template>
          </van-cell>
          <van-cell title="用户名" :value="userStore.username" />
        </van-cell-group>

        <van-cell-group inset title="修改密码">
          <van-field v-model="passwordForm.oldPassword" type="password" label="原密码" placeholder="请输入原密码" />
          <van-field v-model="passwordForm.newPassword" type="password" label="新密码" placeholder="请输入新密码" />
          <van-field v-model="passwordForm.confirmPassword" type="password" label="确认密码" placeholder="请再次输入新密码" />
        </van-cell-group>

        <van-button type="primary" block @click="handleChangePassword">修改密码</van-button>
        <van-button type="danger" block @click="handleLogout">退出登录</van-button>
      </div>
    </van-popup>

    <!-- 通话面板 -->
    <CallPanel
      ref="callPanelRef"
      v-model:show="callPanelVisible"
      :call-type="chatStore.callState.callType"
      :target-user-id="chatStore.callState.targetUserId"
      :target-username="chatStore.callState.targetUsername"
      :incoming-offer="chatStore.callState.incomingOffer"
      :caller-username="chatStore.callState.callerUsername"
      @signal="handleCallSignal"
      @hangup="onCallHangup"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showSuccessToast, showFailToast, showConfirmDialog } from 'vant'
import { useUserStore } from '@/stores/user'
import { useChatStore } from '@/stores/chat'
import api from '@/api/index'
import CallPanel from '@/components/CallPanel.vue'

const router = useRouter()
const userStore = useUserStore()
const chatStore = useChatStore()

const activeTab = ref(0)
const showActions = ref(false)
const actions = [
  { name: '添加好友' },
  { name: '创建群组' },
  { name: '个人信息' },
  { name: '退出登录', color: '#ee0a24' }
]

// 添加好友
const showAddFriend = ref(false)
const addFriendUsername = ref('')

// 创建群组
const showCreateGroup = ref(false)
const createGroupName = ref('')
const createGroupMembers = ref([])

// 个人信息
const showProfile = ref(false)
const passwordForm = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

// 通话面板
const callPanelRef = ref(null)
const callPanelVisible = ref(false)

// 未读消息徽章
const totalUnreadBadge = computed(() => {
  const total = chatStore.totalUnread + Object.values(chatStore.groupUnreadCounts).reduce((a, b) => a + b, 0)
  return total > 99 ? '99+' : total.toString()
})

const totalUnread = computed(() => {
  return chatStore.totalUnread + Object.values(chatStore.groupUnreadCounts).reduce((a, b) => a + b, 0)
})

// 同步通话面板显示状态
watch(() => chatStore.callState.showCallPanel, (val) => {
  callPanelVisible.value = val
})

watch(callPanelVisible, (val) => {
  if (!val) {
    chatStore.endCall()
  }
})

onMounted(async () => {
  await userStore.fetchUserInfo()
  await chatStore.loadFriends()
  await chatStore.loadFriendRequests()
  await chatStore.loadUnreadCounts()
  await chatStore.loadGroups()
  await chatStore.loadGroupInvites()
})

function onActionSelect(action) {
  showActions.value = false
  if (action.name === '添加好友') {
    showAddFriend.value = true
  } else if (action.name === '创建群组') {
    showCreateGroup.value = true
  } else if (action.name === '个人信息') {
    showProfile.value = true
  } else if (action.name === '退出登录') {
    handleLogout()
  }
}

async function handleAddFriend() {
  if (!addFriendUsername.value.trim()) {
    showToast('请输入好友用户名')
    return
  }

  try {
    await chatStore.addFriend(addFriendUsername.value.trim())
    showAddFriend.value = false
    addFriendUsername.value = ''
    showSuccessToast('好友申请已发送')
  } catch (error) {
    showFailToast(error.message || '发送失败')
  }
}

function toggleMember(id) {
  const index = createGroupMembers.value.indexOf(id)
  if (index > -1) {
    createGroupMembers.value.splice(index, 1)
  } else {
    createGroupMembers.value.push(id)
  }
}

async function handleCreateGroup() {
  if (!createGroupName.value.trim()) {
    showToast('请输入群组名称')
    return
  }
  if (createGroupMembers.value.length < 1) {
    showToast('至少选择一名成员')
    return
  }

  try {
    await chatStore.createGroup(createGroupName.value.trim(), createGroupMembers.value)
    showCreateGroup.value = false
    createGroupName.value = ''
    createGroupMembers.value = []
    showSuccessToast('群组创建成功')
  } catch (error) {
    showFailToast(error.message || '创建失败')
  }
}

async function handleAcceptRequest(requestId) {
  try {
    await chatStore.acceptFriendRequest(requestId)
    showSuccessToast('已接受好友申请')
  } catch (error) {
    showFailToast(error.message || '操作失败')
  }
}

async function handleRejectRequest(requestId) {
  try {
    await chatStore.rejectFriendRequest(requestId)
    showSuccessToast('已拒绝好友申请')
  } catch (error) {
    showFailToast(error.message || '操作失败')
  }
}

async function handleApproveInvite(inviteId, approve) {
  try {
    await chatStore.approveInvite(inviteId, approve)
    showSuccessToast(approve ? '已通过邀请' : '已拒绝邀请')
  } catch (error) {
    showFailToast(error.message || '操作失败')
  }
}

function goToFriendChat(friend) {
  chatStore.selectFriend(friend)
  router.push('/chat/friend/' + friend.friendId)
}

function goToGroupChat(group) {
  chatStore.selectGroup(group)
  router.push('/chat/group/' + group.groupId)
}

async function handleAvatarUpload(file) {
  try {
    const formData = new FormData()
    formData.append('file', file.file)
    const res = await api.post('/user/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    userStore.avatar = res.data.avatar
    showSuccessToast('头像更新成功')
  } catch (error) {
    showFailToast(error.message || '上传失败')
  }
}

async function handleChangePassword() {
  if (!passwordForm.value.oldPassword || !passwordForm.value.newPassword) {
    showToast('请填写完整')
    return
  }
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    showToast('两次密码不一致')
    return
  }

  try {
    await api.post('/user/change-password', {
      oldPassword: passwordForm.value.oldPassword,
      newPassword: passwordForm.value.newPassword
    })
    showSuccessToast('密码修改成功，请重新登录')
    handleLogout()
  } catch (error) {
    showFailToast(error.message || '修改失败')
  }
}

function handleLogout() {
  chatStore.disconnectSSE()
  userStore.logout()
  router.push('/login')
}

function getAvatarUrl(avatar) {
  if (!avatar || avatar === 'default-avatar.png') {
    return null
  }
  return avatar
}

function getRoleLabel(role) {
  if (role === 'owner') return '群主'
  if (role === 'admin') return '管理员'
  return '成员'
}

function formatTime(time) {
  if (!time) return ''
  const date = new Date(time)
  return date.toLocaleDateString('zh-CN')
}

async function handleCallSignal(signal) {
  await chatStore.handleCallSignal(signal.signalType, signal.signalData)
}

function onCallHangup() {
  chatStore.endCall()
}

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
</script>

<style scoped>
.home-page {
  height: 100vh;
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
  background: #f5f5f5;
}

.home-page .van-nav-bar {
  flex-shrink: 0;
}

.home-page .van-tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.home-page :deep(.van-tabs__content) {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.home-page :deep(.van-tab__pane) {
  height: 100%;
  overflow-y: auto;
}

.request-section {
  margin-bottom: 16px;
}

.popup-content {
  padding: 20px;
}

.member-select {
  margin: 16px 0;
}

.member-select-label {
  margin-bottom: 8px;
  color: #666;
}

.profile-popup {
  max-height: 80vh;
  overflow-y: auto;
}

.profile-popup .van-button {
  margin-top: 12px;
}
</style>