<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ApiError } from '@/api/http'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const login = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await auth.signIn(login.value.trim(), password.value)
    await router.replace('/')
  } catch (e) {
    error.value =
      e instanceof ApiError && e.status === 401
        ? 'Wrong login or password.'
        : 'Cannot reach the server.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="card login">
    <h2>Sign in</h2>
    <form @submit.prevent="submit">
      <label for="login">Login</label>
      <input id="login" v-model="login" autocomplete="username" required />

      <label for="password">Password</label>
      <input
        id="password"
        v-model="password"
        type="password"
        autocomplete="current-password"
        required
      />

      <button type="submit" :disabled="loading">{{ loading ? 'Signing in…' : 'Sign in' }}</button>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
    </form>
  </section>
</template>

<style scoped>
.login {
  max-width: 360px;
  margin: 2rem auto;
}

form {
  display: grid;
  gap: 0.5rem;
}

button {
  margin-top: 0.75rem;
}
</style>
