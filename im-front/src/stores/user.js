import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api/modules'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('token') || '')
  const userInfo = ref(JSON.parse(localStorage.getItem('userInfo') || 'null'))

  const isLoggedIn = computed(() => !!token.value)
  const username = computed(() => userInfo.value?.username || '')
  const userId = computed(() => userInfo.value?.id || '')
  const avatar = computed({
    get: () => userInfo.value?.avatar || '',
    set: (val) => {
      userInfo.value = { ...userInfo.value, avatar: val }
      localStorage.setItem('userInfo', JSON.stringify(userInfo.value))
    }
  })

  async function login(username, password) {
    const res = await authApi.login(username, password)
    token.value = res.data.token
    userInfo.value = res.data.user
    localStorage.setItem('token', res.data.token)
    localStorage.setItem('userInfo', JSON.stringify(res.data.user))
    return res
  }

  async function register(username, password) {
    const res = await authApi.register(username, password)
    return res
  }

  async function fetchUserInfo() {
    const res = await authApi.getUserInfo()
    userInfo.value = res.data
    localStorage.setItem('userInfo', JSON.stringify(res.data))
    return res
  }

  function logout() {
    token.value = ''
    userInfo.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('userInfo')
  }

  return {
    token,
    userInfo,
    isLoggedIn,
    username,
    userId,
    avatar,
    login,
    register,
    fetchUserInfo,
    logout
  }
})