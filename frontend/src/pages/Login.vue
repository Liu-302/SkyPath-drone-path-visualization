<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from '@fesjs/fes'
import { useAuthStore } from '@/stores/auth'
import { BACKEND_CONFIG } from '@/shared/config/backend.config'
import ParticleBackground from '@/features/upload/components/ParticleBackground.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const redirectTo = computed(() => (route.query.redirect as string) || '/Home')

const email = ref('')
const password = ref('')
const regUsername = ref('')
const regEmail = ref('')
const regPassword = ref('')
const errorMsg = ref('')
const loading = ref(false)
const showRegister = ref(false)

async function handleLogin() {
  errorMsg.value = ''
  if (!email.value.trim() || !password.value) {
    errorMsg.value = 'Please enter email and password'
    return
  }
  loading.value = true
  const result = await authStore.login(email.value.trim(), password.value)
  loading.value = false
  if (result.ok) {
    router.replace(redirectTo.value)
  } else {
    errorMsg.value = result.error || 'Login failed'
  }
}

async function handleRegister() {
  errorMsg.value = ''
  if (!regUsername.value.trim() || !regEmail.value.trim() || !regPassword.value) {
    errorMsg.value = 'Please fill all fields'
    return
  }
  if (regPassword.value.length < 6) {
    errorMsg.value = 'Password must be at least 6 characters'
    return
  }
  loading.value = true
  try {
    const res = await fetch(`${BACKEND_CONFIG.BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: regUsername.value.trim(),
        email: regEmail.value.trim(),
        password: regPassword.value,
      }),
    })
    const data = await res.json()
    if (res.ok && data.token) {
      authStore.setAuth(data.token, { userId: data.userId, username: data.username, email: data.email })
      router.replace('/Home')
    } else {
      errorMsg.value = 'Email or username already exists'
    }
  } catch {
    errorMsg.value = 'Network error, please try again'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="page-wrap">
    <ParticleBackground />
    <div class="center-container">
      <div class="login-panel">
        <header class="panel-header">
          <h1>SkyPath</h1>
          <p class="subtitle">Sign in to continue</p>
        </header>

        <div v-if="showRegister" class="register-form">
          <div class="field">
            <label for="reg-username">Username</label>
            <input id="reg-username" v-model="regUsername" type="text" placeholder="Your name" :disabled="loading" />
          </div>
          <div class="field">
            <label for="reg-email">Email</label>
            <input id="reg-email" v-model="regEmail" type="email" placeholder="your@email.com" :disabled="loading" />
          </div>
          <div class="field">
            <label for="reg-password">Password (min 6 chars)</label>
            <input id="reg-password" v-model="regPassword" type="password" placeholder="At least 6 characters" :disabled="loading" />
          </div>
          <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
          <button type="button" class="btn primary full" :disabled="loading" @click="handleRegister">
            {{ loading ? 'Creating...' : 'Create Account' }}
          </button>
          <button type="button" class="btn-link" @click="showRegister = false; errorMsg = ''">Back to Sign In</button>
        </div>

        <form v-else class="login-form" @submit.prevent="handleLogin">
          <div class="field">
            <label for="email">Email</label>
            <input
              id="email"
              v-model="email"
              type="email"
              placeholder="your@email.com"
              autocomplete="email"
              :disabled="loading"
            />
          </div>
          <div class="field">
            <label for="password">Password</label>
            <input
              id="password"
              v-model="password"
              type="password"
              placeholder="Enter password"
              autocomplete="current-password"
              :disabled="loading"
            />
          </div>
          <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
          <button type="submit" class="btn primary full" :disabled="loading">
            {{ loading ? 'Signing in...' : 'Sign In' }}
          </button>
          <button type="button" class="btn-link" @click="showRegister = true; errorMsg = ''">Create Account</button>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.center-container {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 420px;
  padding: 24px;
}

.login-panel {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: 40px;
  box-shadow: var(--shadow-deep);
}

.panel-header {
  text-align: center;
  margin-bottom: 32px;
}

.panel-header h1 {
  font-size: 28px;
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin: 0 0 8px 0;
  letter-spacing: var(--letter-spacing-tight);
}

.subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
}

.login-form,
.register-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.btn-link {
  background: none;
  border: none;
  color: var(--text-tertiary);
  font-size: 13px;
  cursor: pointer;
  padding: 8px 0;
  transition: color 0.2s;
}

.btn-link:hover {
  color: var(--text-secondary);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field label {
  font-size: 13px;
  font-weight: var(--font-weight-medium);
  color: var(--text-secondary);
}

.field input {
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 15px;
  transition: border-color 0.2s, background 0.2s;
}

.field input::placeholder {
  color: var(--text-tertiary);
}

.field input:focus {
  outline: none;
  border-color: var(--glass-border-hover);
  background: rgba(255, 255, 255, 0.05);
}

.field input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  color: var(--accent-red);
  font-size: 13px;
  margin: 0;
}

.btn {
  padding: 12px 24px;
  border-radius: var(--radius-sm);
  font-size: 15px;
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: opacity 0.2s, background 0.2s;
  border: none;
}

.btn.primary {
  background: var(--gradient-accent);
  color: var(--text-primary);
  border: 1px solid var(--glass-border-hover);
}

.btn.primary:hover:not(:disabled) {
  background: var(--glass-bg-hover);
}

.btn.primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn.full {
  width: 100%;
}
</style>
