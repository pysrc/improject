<template>
  <div class="register-page">
    <div class="register-header">
      <h1>注册账号</h1>
      <p>IM Chat · 移动端</p>
    </div>

    <van-form @submit="handleRegister">
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
        <van-field
          v-model="form.confirmPassword"
          type="password"
          name="confirmPassword"
          label="确认密码"
          placeholder="请再次输入密码"
          :rules="[
            { required: true, message: '请确认密码' },
            { validator: validateConfirmPassword, message: '两次密码不一致' }
          ]"
        />
      </van-cell-group>

      <div class="register-actions">
        <van-button round block type="primary" native-type="submit" :loading="loading">
          注册
        </van-button>
        <van-button round block type="default" @click="goToLogin">
          已有账号？去登录
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

const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const form = ref({
  username: '',
  password: '',
  confirmPassword: ''
})

function validateConfirmPassword() {
  return form.value.confirmPassword === form.value.password
}

async function handleRegister() {
  try {
    loading.value = true
    await userStore.register(form.value.username, form.value.password)
    showToast('注册成功，请登录')
    router.push('/login')
  } catch (error) {
    showToast(error.message || '注册失败')
  } finally {
    loading.value = false
  }
}

function goToLogin() {
  router.push('/login')
}
</script>

<style scoped>
.register-page {
  height: 100vh;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow-x: hidden;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.register-header {
  text-align: center;
  margin-bottom: 40px;
  color: white;
}

.register-header h1 {
  font-size: 32px;
  margin-bottom: 10px;
}

.register-header p {
  font-size: 14px;
  opacity: 0.8;
}

.register-actions {
  margin-top: 30px;
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>