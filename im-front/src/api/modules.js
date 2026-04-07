import api from './index'

export const authApi = {
  register: (username, password) =>
    api.post('/register', { username, password }),

  login: (username, password) =>
    api.post('/login', { username, password }),

  getUserInfo: () =>
    api.get('/user/info')
}

export const friendApi = {
  getList: () =>
    api.get('/friend/list'),

  add: (friendUsername) =>
    api.post('/friend/add', { friendUsername }),

  deleteFriend: (friendId) =>
    api.post('/friend/delete', { friendId }),

  remark: (friendId, remark) =>
    api.post('/friend/remark', { friendId, remark }),

  getRequests: () =>
    api.get('/friend/requests'),

  accept: (requestId) =>
    api.post('/friend/accept', { requestId }),

  reject: (requestId) =>
    api.post('/friend/reject', { requestId })
}

export const messageApi = {
  send: (receiverId, content) =>
    api.post('/message/send', { receiverId, content }),

  getHistory: (friendId) =>
    api.get('/message/history', { params: { friendId } }),

  getUnread: () =>
    api.get('/message/unread'),

  sendFile: (receiverId, fileId) =>
    api.post('/message/send-file', { receiverId, fileId }),

  clear: (friendId) =>
    api.post('/message/clear', { friendId })
}

export const fileApi = {
  upload: (file, duration = 0) => {
    const formData = new FormData()
    formData.append('file', file)
    if (duration > 0) {
      formData.append('duration', duration)
    }
    return api.post('/file/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  getDownloadUrl: (fileId, token) =>
    `/api/file/download/${fileId}?token=${encodeURIComponent(token)}`
}

export const webrtcApi = {
  getIceConfig: () =>
    api.get('/webrtc/ice-config'),

  signal: (targetUserId, signalType, signalData, callType = 'video') =>
    api.post('/webrtc/signal', { targetUserId, signalType, signalData, callType })
}

export const groupApi = {
  // 创建群组
  create: (name, memberIds) =>
    api.post('/group/create', { name, memberIds }),

  // 获取群组列表
  getList: () =>
    api.get('/group/list'),

  // 获取群组详情
  getInfo: (groupId) =>
    api.get(`/group/${groupId}/info`),

  // 获取群成员列表
  getMembers: (groupId) =>
    api.get(`/group/${groupId}/members`),

  // 邀请成员
  invite: (groupId, inviteeId) =>
    api.post('/group/invite', { groupId, inviteeId }),

  // 获取待审核邀请列表
  getInvites: (groupId) =>
    api.get('/group/invites', { params: { groupId } }),

  // 审核邀请
  approveInvite: (inviteId, approve) =>
    api.post('/group/approve-invite', { inviteId, approve }),

  // 设置/取消管理员
  setAdmin: (groupId, memberId, isAdmin) =>
    api.post('/group/set-admin', { groupId, memberId, isAdmin }),

  // 移除成员
  removeMember: (groupId, memberId) =>
    api.post('/group/remove-member', { groupId, memberId }),

  // 退出群组
  quit: (groupId) =>
    api.post('/group/quit', { groupId }),

  // 转让群主
  transfer: (groupId, newOwnerId) =>
    api.post('/group/transfer', { groupId, newOwnerId })
}

export const groupMessageApi = {
  // 发送群消息
  send: (groupId, content, mentionIds = []) =>
    api.post('/message/send-group', { groupId, content, mentionIds }),

  // 获取群消息历史
  getHistory: (groupId) =>
    api.get('/message/group-history', { params: { groupId } }),

  // 发送群文件消息
  sendFile: (groupId, fileId, mentionIds = []) =>
    api.post('/message/send-group-file', { groupId, fileId, mentionIds })
}