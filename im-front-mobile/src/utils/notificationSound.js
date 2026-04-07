// 消息提示音播放器
class NotificationSound {
  constructor() {
    this.audioContext = null
    this.enabled = true
  }

  // 初始化 AudioContext
  init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
    }
    return this.audioContext
  }

  // 播放提示音
  play() {
    if (!this.enabled) return

    try {
      const ctx = this.init()
      if (ctx.state === 'suspended') {
        ctx.resume()
      }

      // 创建振荡器生成简单的提示音
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      // 设置音调 (Hz)
      oscillator.frequency.setValueAtTime(800, ctx.currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1)

      // 设置音量
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2)

      // 播放
      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + 0.2)
    } catch (e) {
      console.warn('播放提示音失败:', e)
    }
  }

  // 启用/禁用提示音
  setEnabled(enabled) {
    this.enabled = enabled
  }
}

export const notificationSound = new NotificationSound()