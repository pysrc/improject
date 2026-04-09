// 来电铃声播放器 - 循环播放直到接听或拒绝
class Ringtone {
  constructor() {
    this.audioContext = null
    this.isPlaying = false
    this.intervalId = null
  }

  // 初始化 AudioContext
  init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
    }
    return this.audioContext
  }

  // 播放单次铃声
  playSingleRing() {
    try {
      const ctx = this.init()
      if (ctx.state === 'suspended') {
        ctx.resume()
      }

      // 创建振荡器
      const oscillator1 = ctx.createOscillator()
      const oscillator2 = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator1.connect(gainNode)
      oscillator2.connect(gainNode)
      gainNode.connect(ctx.destination)

      // 铃声频率 - 模拟电话铃声
      oscillator1.type = 'sine'
      oscillator1.frequency.setValueAtTime(440, ctx.currentTime) // A4
      oscillator1.frequency.setValueAtTime(554.37, ctx.currentTime + 0.1) // C#5
      oscillator1.frequency.setValueAtTime(659.25, ctx.currentTime + 0.2) // E5

      oscillator2.type = 'sine'
      oscillator2.frequency.setValueAtTime(880, ctx.currentTime) // A5
      oscillator2.frequency.setValueAtTime(1108.73, ctx.currentTime + 0.1) // C#6
      oscillator2.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.2) // E6

      // 音量包络
      gainNode.gain.setValueAtTime(0, ctx.currentTime)
      gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05)
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime + 0.3)
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5)

      // 播放
      oscillator1.start(ctx.currentTime)
      oscillator2.start(ctx.currentTime)
      oscillator1.stop(ctx.currentTime + 0.5)
      oscillator2.stop(ctx.currentTime + 0.5)
    } catch (e) {
      console.warn('播放铃声失败:', e)
    }
  }

  // 开始循环播放铃声
  start() {
    if (this.isPlaying) return

    this.isPlaying = true

    // 立即播放一次
    this.playSingleRing()

    // 每1.5秒播放一次（模拟电话铃声节奏）
    this.intervalId = setInterval(() => {
      this.playSingleRing()
    }, 1500)
  }

  // 停止铃声
  stop() {
    this.isPlaying = false
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }
}

export const ringtone = new Ringtone()