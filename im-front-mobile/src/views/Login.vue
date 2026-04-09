<template>
  <div class="login-page">
    <div class="login-header">
      <h1>IM Chat</h1>
      <p>即时通讯 · 移动端</p>
    </div>

    <van-form @submit="handleLogin">
      <van-cell-group inset>
        <van-field
          v-model="form.username"
          name="username"
          label="用户名"
          placeholder="请输入用户名"
          :rules="[{ required: true, message: '请输入用户名' }]"
        />
        <van-field
          v-model="form.password"
          type="password"
          name="password"
          label="密码"
          placeholder="请输入密码"
          :rules="[{ required: true, message: '请输入密码' }]"
        />
      </van-cell-group>

      <div class="login-actions">
        <van-button round block type="primary" native-type="submit" :loading="loading">
          登录
        </van-button>
        <van-button round block type="default" @click="goToRegister">
          没有账号？去注册
        </van-button>
      </div>
    </van-form>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { useUserStore } from '@/stores/user'
import { notificationSound } from '@/utils/notificationSound'

const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const form = ref({
  username: '',
  password: ''
})

async function handleLogin() {
  try {
    loading.value = true
    await userStore.login(form.value.username, form.value.password)
    // 初始化音频上下文（需要用户交互后）
    notificationSound.init()
    showToast('登录成功')
    router.push('/')
  } catch (error) {
    showToast(error.message || '登录失败')
  } finally {
    loading.value = false
  }
}

function goToRegister() {
  router.push('/register')
}
</script>

<style scoped>
.login-page {
  height: 100vh;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow-x: hidden;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.login-header {
  text-align: center;
  margin-bottom: 40px;
  color: white;
}

.login-header h1 {
  font-size: 32px;
  margin-bottom: 10px;
}

.login-header p {
  font-size: 14px;
  opacity: 0.8;
}

.login-actions {
  margin-top: 30px;
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>