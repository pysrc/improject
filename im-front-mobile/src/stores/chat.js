import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { friendApi, messageApi, fileApi, webrtcApi, groupApi, groupMessageApi } from '@/api/modules'
import { notificationSound } from '@/utils/notificationSound'

export const useChatStore = defineStore('chat', () => {
  // 好友相关状态
  const friends = ref([])
  const messages = ref({})
  const currentFriend = ref(null)
  const friendRequests = ref([])
  const unreadCounts = ref({})

  // 群组相关状态
  const groups = ref([])
  const groupMessages = ref({})
  const currentGroup = ref(null)
  const groupMembers = ref({})
  const groupInvites = ref([])
  const groupUnreadCounts = ref({})

  // 当前聊天类型：'friend' 或 'group'
  const chatType = ref('friend')

  const sseConnection = ref(null)

  // 通话状态
  const callState = ref({
    showCallPanel: false,
    callType: 'video',
    targetUserId: '',
    targetUsername: '',
    incomingOffer: null,
    callerUsername: ''
  })

  // 远程信令（用于传递给 CallPanel）
  const remoteSignal = ref(null)

  // 总未读消息数
  const totalUnread = computed(() => {
    return Object.values(unreadCounts.value).reduce((sum, count) => sum + count, 0)
  })

  async function loadFriends() {
    const res = await friendApi.getList()
    friends.value = res.data || []
  }

  async function loadUnreadCounts() {
    const res = await messageApi.getUnread()
    unreadCounts.value = res.data || {}
  }

  async function loadFriendRequests() {
    const res = await friendApi.getRequests()
    friendRequests.value = res.data || []
  }

  async function addFriend(username) {
    const res = await friendApi.add(username)
    return res
  }

  async function acceptFriendRequest(requestId) {
    const res = await friendApi.accept(requestId)
    await loadFriends()
    await loadFriendRequests()
    return res
  }

  async function rejectFriendRequest(requestId) {
    const res = await friendApi.reject(requestId)
    await loadFriendRequests()
    return res
  }

  async function deleteFriend(friendId) {
    const res = await friendApi.deleteFriend(friendId)
    await loadFriends()
    // 清除该好友的未读计数
    delete unreadCounts.value[friendId]
    if (currentFriend.value?.friendId === friendId) {
      currentFriend.value = null
    }
    return res
  }

  async function setRemark(friendId, remark) {
    const res = await friendApi.remark(friendId, remark)
    await loadFriends()
    return res
  }

  function selectFriend(friend) {
    currentFriend.value = friend
    // 选中好友时清除未读计数
    if (unreadCounts.value[friend.friendId]) {
      delete unreadCounts.value[friend.friendId]
    }
  }

  async function loadMessages(friendId) {
    const res = await messageApi.getHistory(friendId)
    messages.value[friendId] = res.data || []
    // 加载消息后清除未读（后端会标记已读）
    if (unreadCounts.value[friendId]) {
      delete unreadCounts.value[friendId]
    }
  }

  async function sendMessage(receiverId, content) {
    const res = await messageApi.send(receiverId, content)
    if (!messages.value[receiverId]) {
      messages.value[receiverId] = []
    }
    messages.value[receiverId].push(res.data)
    return res
  }

  async function uploadAndSendFile(receiverId, file) {
    // 上传文件
    const uploadRes = await fileApi.upload(file)
    // 发送文件消息
    const res = await messageApi.sendFile(receiverId, uploadRes.data.fileId)
    if (!messages.value[receiverId]) {
      messages.value[receiverId] = []
    }
    messages.value[receiverId].push(res.data)
    return res
  }

  async function uploadAndSendAudio(receiverId, audioBlob, duration) {
    // 上传音频文件（带时长）
    const uploadRes = await fileApi.upload(audioBlob, duration)
    // 发送文件消息
    const res = await messageApi.sendFile(receiverId, uploadRes.data.fileId)
    if (!messages.value[receiverId]) {
      messages.value[receiverId] = []
    }
    messages.value[receiverId].push(res.data)
    return res
  }

  async function clearMessages(friendId) {
    const res = await messageApi.clear(friendId)
    // 清除本地消息记录
    messages.value[friendId] = []
    return res
  }

  // 发起通话
  function startCall(friend, callType) {
    callState.value = {
      showCallPanel: true,
      callType,
      targetUserId: friend.friendId,
      targetUsername: friend.username,
      incomingOffer: null,
      callerUsername: ''
    }
  }

  // 处理通话信令
  async function handleCallSignal(signalType, signalData) {
    const targetUserId = callState.value.targetUserId
    if (!targetUserId) {
      console.warn('[Call] No target user for signal')
      return
    }

    console.log('[Call] Sending signal:', signalType, 'to:', targetUserId)
    await webrtcApi.signal(targetUserId, signalType, signalData, callState.value.callType)
  }

  // 结束通话
  function endCall() {
    callState.value = {
      showCallPanel: false,
      callType: 'video',
      targetUserId: '',
      targetUsername: '',
      incomingOffer: null,
      callerUsername: ''
    }
    remoteSignal.value = null
  }

  // 清除远程信令（CallPanel 处理后调用）
  function clearRemoteSignal() {
    remoteSignal.value = null
  }

  function receiveMessage(msg) {
    const friendId = msg.senderId
    // 使用响应式方式更新消息
    if (!messages.value[friendId]) {
      messages.value[friendId] = []
    }
    // 创建新数组触发响应式更新
    messages.value[friendId] = [...messages.value[friendId], msg]
    // 如果不是当前选中的好友，增加未读计数并播放提示音
    if (!currentFriend.value || currentFriend.value.friendId !== friendId) {
      unreadCounts.value[friendId] = (unreadCounts.value[friendId] || 0) + 1
      notificationSound.play()
    }
  }

  function getCurrentMessages() {
    if (chatType.value === 'group' && currentGroup.value) {
      return groupMessages.value[currentGroup.value.groupId] || []
    }
    if (chatType.value === 'friend' && currentFriend.value) {
      return messages.value[currentFriend.value.friendId] || []
    }
    return []
  }

  function handleSSEEvent(data) {
    console.log('SSE event received:', data)
    if (data.type === 'message') {
      receiveMessage(data.data)
    } else if (data.type === 'group_message') {
      receiveGroupMessage(data.data)
    } else if (data.type === 'friend_request') {
      friendRequests.value.unshift(data.data)
    } else if (data.type === 'friend_request_accepted') {
      loadFriends()
      loadFriendRequests()
    } else if (data.type === 'group_invite_pending') {
      groupInvites.value.unshift(data.data)
    } else if (data.type === 'group_invite_approved') {
      loadGroups()
    } else if (data.type === 'group_member_joined') {
      // 刷新群成员列表
      if (currentGroup.value?.groupId === data.data.groupId) {
        loadGroupMembers(data.data.groupId)
      }
    } else if (data.type === 'group_member_removed' || data.type === 'group_member_quit') {
      if (currentGroup.value?.groupId === data.data.groupId) {
        loadGroupMembers(data.data.groupId)
      }
    } else if (data.type === 'group_removed') {
      // 被移出群组
      loadGroups()
      if (currentGroup.value?.groupId === data.data.groupId) {
        currentGroup.value = null
        chatType.value = 'friend'
      }
    } else if (data.type.startsWith('call_')) {
      handleCallEvent(data)
    }
  }

  function handleCallEvent(data) {
    const signalType = data.type.replace('call_', '')
    const { senderId, senderUsername, signalData, callType } = data.data

    console.log('[Call] Received signal:', signalType, 'from:', senderUsername)

    if (signalType === 'offer') {
      // 收到通话邀请
      callState.value = {
        showCallPanel: true,
        callType: callType || 'video',
        targetUserId: senderId,
        targetUsername: senderUsername,
        incomingOffer: signalData,
        callerUsername: senderUsername
      }
    } else if (signalType === 'answer') {
      // 收到 Answer，通知 CallPanel 处理
      remoteSignal.value = { type: 'answer', data: signalData }
    } else if (signalType === 'ice_candidate') {
      // 收到 ICE Candidate，通知 CallPanel 处理
      remoteSignal.value = { type: 'ice_candidate', data: signalData }
    } else if (signalType === 'hangup' || signalType === 'reject') {
      // 对方挂断或拒绝
      endCall()
    }
  }

  function connectSSE(token) {
    if (sseConnection.value) {
      sseConnection.value.close()
    }

    // 使用完整 URL 确保代理正确
    const url = `/api/sse/connect?token=${encodeURIComponent(token)}`
    console.log('Connecting SSE:', url)

    const eventSource = new EventSource(url)

    eventSource.onopen = () => {
      console.log('SSE connection opened')
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        handleSSEEvent(data)
      } catch (e) {
        console.error('SSE parse error:', e)
      }
    }

    eventSource.onerror = (error) => {
      console.error('SSE error:', error)
      // 尝试重连
      if (eventSource.readyState === EventSource.CLOSED) {
        console.log('SSE connection closed, will retry in 3s')
        setTimeout(() => {
          if (token) {
            connectSSE(token)
          }
        }, 3000)
      }
    }

    sseConnection.value = eventSource
  }

  function disconnectSSE() {
    if (sseConnection.value) {
      sseConnection.value.close()
      sseConnection.value = null
    }
  }

  // ====================== 群组相关方法 ======================
  async function loadGroups() {
    const res = await groupApi.getList()
    groups.value = res.data || []
  }

  async function loadGroupMembers(groupId) {
    const res = await groupApi.getMembers(groupId)
    // 使用展开运算符确保响应式更新
    groupMembers.value = { ...groupMembers.value, [groupId]: res.data || [] }
  }

  async function loadGroupInvites() {
    // 获取所有群组的待审核邀请
    const invites = []
    for (const group of groups.value) {
      if (group.role === 'owner' || group.role === 'admin') {
        const res = await groupApi.getInvites(group.groupId)
        if (res.data) {
          invites.push(...res.data)
        }
      }
    }
    groupInvites.value = invites
  }

  async function createGroup(name, memberIds) {
    const res = await groupApi.create(name, memberIds)
    await loadGroups()
    return res
  }

  async function inviteMember(groupId, inviteeId) {
    const res = await groupApi.invite(groupId, inviteeId)
    return res
  }

  async function approveInvite(inviteId, approve) {
    const res = await groupApi.approveInvite(inviteId, approve)
    await loadGroupInvites()
    return res
  }

  async function removeMember(groupId, memberId) {
    const res = await groupApi.removeMember(groupId, memberId)
    await loadGroupMembers(groupId)
    return res
  }

  async function quitGroup(groupId) {
    const res = await groupApi.quit(groupId)
    await loadGroups()
    if (currentGroup.value?.groupId === groupId) {
      currentGroup.value = null
      chatType.value = 'friend'
    }
    return res
  }

  async function setAdmin(groupId, memberId, isAdmin) {
    const res = await groupApi.setAdmin(groupId, memberId, isAdmin)
    await loadGroupMembers(groupId)
    return res
  }

  async function transferOwner(groupId, newOwnerId) {
    const res = await groupApi.transfer(groupId, newOwnerId)
    await loadGroups()
    await loadGroupMembers(groupId)
    return res
  }

  function selectGroup(group) {
    currentGroup.value = group
    chatType.value = 'group'
    // 清除群组未读
    if (groupUnreadCounts.value[group.groupId]) {
      delete groupUnreadCounts.value[group.groupId]
    }
  }

  function selectFriend(friend) {
    currentFriend.value = friend
    chatType.value = 'friend'
    // 选中好友时清除未读计数
    if (unreadCounts.value[friend.friendId]) {
      delete unreadCounts.value[friend.friendId]
    }
  }

  function clearSelection() {
    currentFriend.value = null
    currentGroup.value = null
    chatType.value = 'friend'
  }

  async function loadGroupMessages(groupId) {
    const res = await groupMessageApi.getHistory(groupId)
    groupMessages.value[groupId] = res.data || []
    // 清除未读
    if (groupUnreadCounts.value[groupId]) {
      delete groupUnreadCounts.value[groupId]
    }
  }

  async function sendGroupMessage(groupId, content, mentionIds = []) {
    const res = await groupMessageApi.send(groupId, content, mentionIds)
    if (!groupMessages.value[groupId]) {
      groupMessages.value[groupId] = []
    }
    groupMessages.value[groupId].push(res.data)
    return res
  }

  async function uploadAndSendGroupFile(groupId, file, mentionIds = []) {
    const uploadRes = await fileApi.upload(file)
    const res = await groupMessageApi.sendFile(groupId, uploadRes.data.fileId, mentionIds)
    if (!groupMessages.value[groupId]) {
      groupMessages.value[groupId] = []
    }
    groupMessages.value[groupId].push(res.data)
    return res
  }

  async function uploadAndSendGroupAudio(groupId, audioBlob, duration, mentionIds = []) {
    const uploadRes = await fileApi.upload(audioBlob, duration)
    const res = await groupMessageApi.sendFile(groupId, uploadRes.data.fileId, mentionIds)
    if (!groupMessages.value[groupId]) {
      groupMessages.value[groupId] = []
    }
    groupMessages.value[groupId].push(res.data)
    return res
  }

  function receiveGroupMessage(msg) {
    const groupId = msg.groupId
    if (!groupMessages.value[groupId]) {
      groupMessages.value[groupId] = []
    }
    // 创建新数组触发响应式更新
    groupMessages.value[groupId] = [...groupMessages.value[groupId], msg]
    // 如果不是当前选中的群组，增加未读计数并播放提示音
    if (!currentGroup.value || currentGroup.value.groupId !== groupId) {
      groupUnreadCounts.value[groupId] = (groupUnreadCounts.value[groupId] || 0) + 1
      notificationSound.play()
    }
  }

  function getCurrentMembers() {
    if (currentGroup.value) {
      return groupMembers.value[currentGroup.value.groupId] || []
    }
    return []
  }

  return {
    // 好友相关
    friends,
    messages,
    currentFriend,
    friendRequests,
    unreadCounts,
    totalUnread,
    loadFriends,
    loadUnreadCounts,
    loadFriendRequests,
    addFriend,
    acceptFriendRequest,
    rejectFriendRequest,
    deleteFriend,
    setRemark,
    selectFriend,
    loadMessages,
    sendMessage,
    uploadAndSendFile,
    uploadAndSendAudio,
    clearMessages,
    receiveMessage,
    getCurrentMessages,

    // 群组相关
    groups,
    groupMessages,
    currentGroup,
    groupMembers,
    groupInvites,
    groupUnreadCounts,
    chatType,
    loadGroups,
    loadGroupMembers,
    loadGroupInvites,
    createGroup,
    inviteMember,
    approveInvite,
    removeMember,
    quitGroup,
    setAdmin,
    transferOwner,
    selectGroup,
    loadGroupMessages,
    sendGroupMessage,
    uploadAndSendGroupFile,
    uploadAndSendGroupAudio,
    receiveGroupMessage,
    getCurrentMembers,
    clearSelection,

    // 通话相关
    callState,
    remoteSignal,
    startCall,
    handleCallSignal,
    endCall,
    clearRemoteSignal,
    handleSSEEvent,
    handleCallEvent,

    // SSE 连接
    sseConnection,
    connectSSE,
    disconnectSSE
  }
})