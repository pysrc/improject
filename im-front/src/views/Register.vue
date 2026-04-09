<template>
  <div class="register-container">
    <n-card title="注册" class="register-card">
      <n-form ref="formRef" :model="form" :rules="rules">
        <n-form-item path="username" label="用户名">
          <n-input v-model:value="form.username" placeholder="请输入用户名" />
        </n-form-item>
        <n-form-item path="password" label="密码">
          <n-input v-model:value="form.password" type="password" placeholder="请输入密码" />
        </n-form-item>
        <n-form-item path="confirmPassword" label="确认密码">
          <n-input
            v-model:value="form.confirmPassword"
            type="password"
            placeholder="请再次输入密码"
            @keyup.enter="handleRegister"
          />
        </n-form-item>
        <n-space vertical>
          <n-button type="primary" block :loading="loading" @click="handleRegister">
            注册
          </n-button>
          <n-button text block @click="goToLogin">
            已有账号？去登录
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

const router = useRouter()
const message = useMessage()
const userStore = useUserStore()

const formRef = ref(null)
const loading = ref(false)
const form = ref({
  username: '',
  password: '',
  confirmPassword: ''
})

const rules = {
  username: { required: true, message: '请输入用户名', trigger: 'blur' },
  password: { required: true, message: '请输入密码', trigger: 'blur' },
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    {
      validator: (rule, value) => value === form.value.password,
      message: '两次密码不一致',
      trigger: 'blur'
    }
  ]
}

async function handleRegister() {
  try {
    await formRef.value?.validate()
    loading.value = true
    await userStore.register(form.value.username, form.value.password)
    message.success('注册成功，请登录')
    router.push('/login')
  } catch (error) {
    message.error(error.message || '注册失败')
  } finally {
    loading.value = false
  }
}

function goToLogin() {
  router.push('/login')
}
</script>

<style scoped>
.register-container {
  height: 100vh;
  width: 100vw;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  overflow: hidden;
}

.register-card {
  width: 400px;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 32px);
}

@media screen and (max-width: 768px) {
  .register-card {
    width: calc(100vw - 32px);
    max-width: none;
  }
}
</style>