/**
 * Auth store - user login state and token
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { BACKEND_CONFIG } from '@/shared/config/backend.config'
import { useDatasetStore } from './dataset'
import { useKpiStore } from './kpi'

const TOKEN_KEY = 'skypath_token'
const USER_KEY = 'skypath_user'

interface UserInfo {
  userId: string
  username: string
  email: string
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY))
  function loadUser(): UserInfo | null {
    try {
      const raw = localStorage.getItem(USER_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }
  const user = ref<UserInfo | null>(loadUser())

  const isLoggedIn = computed(() => !!token.value)

  function setAuth(t: string, u: UserInfo) {
    token.value = t
    user.value = u
    localStorage.setItem(TOKEN_KEY, t)
    localStorage.setItem(USER_KEY, JSON.stringify(u))
  }

  function clearAuth() {
    token.value = null
    user.value = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }

  async function login(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch(`${BACKEND_CONFIG.BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        return { ok: false, error: 'Invalid email or password' }
      }
      const data = await res.json()
      setAuth(data.token, {
        userId: data.userId,
        username: data.username,
        email: data.email,
      })
      return { ok: true }
    } catch (e) {
      return { ok: false, error: 'Network error, please try again' }
    }
  }

  function logout() {
    clearAuth()
    useDatasetStore().resetAll()
    useDatasetStore().stopPlayback()
    useKpiStore().reset()
  }

  /** Authorization header for API requests */
  function getAuthHeader(): Record<string, string> {
    if (token.value) {
      return { Authorization: `Bearer ${token.value}` }
    }
    return {}
  }

  return {
    token,
    user,
    isLoggedIn,
    login,
    logout,
    setAuth,
    clearAuth,
    getAuthHeader,
  }
})
