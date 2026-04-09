// 消息提示音播放器
class NotificationSound {
  constructor() {
    this.audioContext = null
    this.enabled = true
  }

  // 初始化 AudioContext（需要在用户交互后调用）
  init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
      console.log('[NotificationSound] AudioContext created, state:', this.audioContext.state)
    }

    // 尝试解锁 AudioContext
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().then(() => {
        console.log('[NotificationSound] AudioContext resumed')
      }).catch(err => {
        console.warn('[NotificationSound] AudioContext resume failed:', err)
      })
    }

    return this.audioContext
  }

  // 播放提示音
  play() {
    if (!this.enabled) {
      console.log('[NotificationSound] Sound disabled')
      return
    }

    try {
      const ctx = this.init()
      console.log('[NotificationSound] Playing sound, context state:', ctx.state)

      // 如果仍然是 suspended 状态，尝试 resume 后再播放
      if (ctx.state === 'suspended') {
        ctx.resume().then(() => {
          this._playSound(ctx)
        }).catch(err => {
          console.warn('[NotificationSound] Resume failed:', err)
        })
      } else {
        this._playSound(ctx)
      }
    } catch (e) {
      console.warn('[NotificationSound] Play failed:', e)
    }
  }

  // 实际播放声音
  _playSound(ctx) {
    try {
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

      console.log('[NotificationSound] Sound played successfully')
    } catch (e) {
      console.warn('[NotificationSound] _playSound failed:', e)
    }
  }

  // 启用/禁用提示音
  setEnabled(enabled) {
    this.enabled = enabled
  }
}

export const notificationSound = new NotificationSound()