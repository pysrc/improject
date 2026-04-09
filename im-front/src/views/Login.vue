<template>
  <div class="login-container">
    <n-card title="登录" class="login-card">
      <n-form ref="formRef" :model="form" :rules="rules">
        <n-form-item path="username" label="用户名">
          <n-input v-model:value="form.username" placeholder="请输入用户名" />
        </n-form-item>
        <n-form-item path="password" label="密码">
          <n-input
            v-model:value="form.password"
            type="password"
            placeholder="请输入密码"
            @keyup.enter="handleLogin"
          />
        </n-form-item>
        <n-space vertical>
          <n-button type="primary" block :loading="loading" @click="handleLogin">
            登录
          </n-button>
          <n-button text block @click="goToRegister">
            没有账号？去注册
          </n-button>
        </n-space>
      </n-form>
    </n-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import { useUserStore } from '@/stores/user'
import { useChatStore } from '@/stores/chat'

const router = useRouter()
const message = useMessage()
const userStore = useUserStore()
const chatStore = useChatStore()

const formRef = ref(null)
const loading = ref(false)
const form = ref({
  username: '',
  password: ''
})

const rules = {
  username: { required: true, message: '请输入用户名', trigger: 'blur' },
  password: { required: true, message: '请输入密码', trigger: 'blur' }
}

async function handleLogin() {
  try {
    await formRef.value?.validate()
    loading.value = true
    await userStore.login(form.value.username, form.value.password)
    chatStore.connectSSE(userStore.token)
    message.success('登录成功')
    router.push('/')
  } catch (error) {
    message.error(error.message || '登录失败')
  } finally {
    loading.value = false
  }
}

function goToRegister() {
  router.push('/register')
}
</script>

<style scoped>
.login-container {
  height: 100vh;
  width: 100vw;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  overflow: hidden;
}

.login-card {
  width: 400px;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 32px);
}

@media screen and (max-width: 768px) {
  .login-card {
    width: calc(100vw - 32px);
    max-width: none;
  }
}
</style>