/**
 * WebRTC 封装模块
 * 处理音视频通话的核心逻辑
 */

class WebRTCManager {
  constructor() {
    this.peerConnection = null
    this.localStream = null
    this.remoteStream = null
    this.iceServers = []
    this.callType = 'video' // 'video'、'audio' 或 'screen'
    this.onRemoteStream = null
    this.onIceCandidate = null
    this.onConnectionStateChange = null
    this.onError = null
    this.onScreenShareEnded = null // 投屏结束回调
    this.iceCandidateQueue = [] // ICE 候选队列
  }

  /**
   * 获取 ICE 服务器配置
   * @param {Function} getIceConfigApi - 获取 ICE 配置的 API 函数
   */
  async initIceServers(getIceConfigApi) {
    try {
      const res = await getIceConfigApi()
      this.iceServers = res.data.iceServers || []
      console.log('[WebRTC] ICE servers config:', this.iceServers)
      return this.iceServers
    } catch (err) {
      // 使用默认 STUN 服务器
      this.iceServers = [{ urls: ['stun:stun.l.google.com:19302'] }]
      console.log('[WebRTC] Using default STUN servers')
      return this.iceServers
    }
  }

  /**
   * 获取本地媒体流
   * @param {string} type - 'video'、'audio' 或 'screen'
   * @param {boolean} updateCallType - 是否更新 callType（默认 true，接收方使用 false）
   * @param {string} facingMode - 摄像头方向（'user' 前置 或 'environment' 后置），仅移动端视频通话有效
   */
  async getLocalStream(type = 'video', updateCallType = true, facingMode = 'user') {
    if (updateCallType) {
      this.callType = type
    }

    if (type === 'screen') {
      // 投屏模式：获取屏幕流
      try {
        this.localStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' },
          audio: true // 可选：共享系统音频
        })

        // 监听屏幕共享结束事件（用户点击浏览器停止共享按钮）
        this.localStream.getVideoTracks()[0].onended = () => {
          console.log('[WebRTC] Screen sharing ended by user')
          if (this.onScreenShareEnded) {
            this.onScreenShareEnded()
          }
        }

        return this.localStream
      } catch (err) {
        throw new Error(`获取屏幕共享权限失败: ${err.message}`)
      }
    }

    // 视频/语音模式
    const constraints = {
      audio: true,
      video: type === 'video' ? {
        facingMode: facingMode, // 支持移动端摄像头方向
        width: { ideal: 640 },
        height: { ideal: 480 }
      } : false
    }

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints)

      // 尝试获取特定网络接口（优先使用 192.168.x.x 网段）
      try {
        const interfaces = await navigator.mediaDevices.enumerateDevices()
        console.log('[WebRTC] Available devices:', interfaces.length)
      } catch (e) {}

      return this.localStream
    } catch (err) {
      throw new Error(`获取${type === 'video' ? '视频' : '音频'}权限失败: ${err.message}`)
    }
  }

  /**
   * 创建 PeerConnection
   */
  createPeerConnection() {
    const config = {
      iceServers: this.iceServers
    }

    this.peerConnection = new RTCPeerConnection(config)

    // 添加本地轨道
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream)
      })
    }

    // 监听远程流
    this.peerConnection.ontrack = (event) => {
      this.remoteStream = event.streams[0]
      if (this.onRemoteStream) {
        this.onRemoteStream(this.remoteStream)
      }
    }

    // 监听 ICE Candidate
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        // 打印 ICE candidate 详情
        const cand = event.candidate.candidate
        const type = cand.includes('typ host') ? 'host' :
                     cand.includes('typ srflx') ? 'srflx' :
                     cand.includes('typ relay') ? 'relay' : 'other'
        console.log(`[WebRTC] ICE candidate (${type}):`, cand)
        if (this.onIceCandidate) {
          this.onIceCandidate(event.candidate)
        }
      }
    }

    // 监听连接状态
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState
      console.log('[WebRTC] Connection state changed:', state)
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(state)
      }
      if (state === 'failed' && this.onError) {
        this.onError('连接失败')
      }
    }

    // 监听 ICE 连接状态
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection.iceConnectionState
      console.log('[WebRTC] ICE connection state:', state)
      if (state === 'failed') {
        console.error('[WebRTC] ICE connection failed')
        if (this.onError) {
          this.onError('ICE 连接失败，请检查网络或 TURN 服务器配置')
        }
      }
    }

    // 监听 ICE gathering 状态
    this.peerConnection.onicegatheringstatechange = () => {
      console.log('[WebRTC] ICE gathering state:', this.peerConnection.iceGatheringState)
    }

    return this.peerConnection
  }

  /**
   * 创建 Offer（发起方）
   */
  async createOffer() {
    if (!this.peerConnection) {
      this.createPeerConnection()
    }

    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      // 视频/投屏模式都需要接收视频（远程可能发送视频）
      offerToReceiveVideo: this.callType === 'video' || this.callType === 'screen'
    })
    await this.peerConnection.setLocalDescription(offer)
    return offer
  }

  /**
   * 处理远程 Offer（接收方）
   * @param {RTCSessionDescriptionInit} offer
   */
  async handleOffer(offer) {
    if (!this.peerConnection) {
      this.createPeerConnection()
    }

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
    console.log('[WebRTC] Remote offer set')
    // 处理队列中的 ICE 候选
    await this.processQueuedIceCandidates()
    const answer = await this.peerConnection.createAnswer()
    await this.peerConnection.setLocalDescription(answer)
    console.log('[WebRTC] Local answer created')
    return answer
  }

  /**
   * 处理远程 Answer
   * @param {RTCSessionDescriptionInit} answer
   */
  async handleAnswer(answer) {
    if (this.peerConnection) {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer))
      console.log('[WebRTC] Remote answer set')
      // 处理队列中的 ICE 候选
      await this.processQueuedIceCandidates()
    }
  }

  /**
   * 处理队列中的 ICE 候选
   */
  async processQueuedIceCandidates() {
    if (this.iceCandidateQueue.length > 0) {
      console.log('[WebRTC] Processing queued ICE candidates:', this.iceCandidateQueue.length)
      for (const candidate of this.iceCandidateQueue) {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
      }
      this.iceCandidateQueue = []
    }
  }

  /**
   * 添加 ICE Candidate
   * @param {RTCIceCandidateInit} candidate
   */
  async addIceCandidate(candidate) {
    if (this.peerConnection) {
      if (this.peerConnection.remoteDescription) {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
          console.log('[WebRTC] ICE candidate added successfully')
        } catch (err) {
          console.error('[WebRTC] Error adding ICE candidate:', err)
        }
      } else {
        console.log('[WebRTC] Remote description not set, queuing ICE candidate')
        this.iceCandidateQueue.push(candidate)
      }
    }
  }

  /**
   * 切换音频开关
   */
  toggleAudio() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        return audioTrack.enabled
      }
    }
    return false
  }

  /**
   * 切换视频开关
   */
  toggleVideo() {
    if (this.localStream && this.callType === 'video') {
      const videoTrack = this.localStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        return videoTrack.enabled
      }
    }
    return false
  }

  /**
   * 结束通话，清理资源
   */
  endCall() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop())
      this.localStream = null
    }

    if (this.peerConnection) {
      this.peerConnection.close()
      this.peerConnection = null
    }

    this.remoteStream = null
    this.iceCandidateQueue = []
  }

  /**
   * 获取当前连接状态
   */
  getConnectionState() {
    return this.peerConnection ? this.peerConnection.connectionState : 'closed'
  }
}

export default WebRTCManager