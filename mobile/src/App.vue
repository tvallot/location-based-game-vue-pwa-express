<script setup lang="ts">
import { watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useGameStore } from '@/stores/game'

const auth = useAuthStore()
const game = useGameStore()
const router = useRouter()

function logout() {
  auth.logout()
}

// Covers both a manual logout and an expired token rejected by the API.
watch(
  () => auth.isLoggedIn,
  (loggedIn) => {
    if (!loggedIn) {
      game.reset()
      void router.replace('/login')
    }
  },
)
</script>

<template>
  <header>
    <RouterLink to="/" class="brand">Nautilus Hunt</RouterLink>
    <nav v-if="auth.isLoggedIn">
      <RouterLink to="/">Briefing</RouterLink>
      <RouterLink v-if="auth.role !== 'admin'" to="/map">Map</RouterLink>
      <span class="badge" :class="auth.role">{{ auth.role }}</span>
      <button type="button" class="secondary" @click="logout">Log out</button>
    </nav>
  </header>

  <main>
    <RouterView />
  </main>
</template>

<style scoped>
header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.brand {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--text);
  text-decoration: none;
}

nav {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

nav a.router-link-exact-active {
  text-decoration: underline;
}

.badge {
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  font-size: 0.8rem;
  text-transform: capitalize;
  background: var(--border);
}

.badge.explorer {
  background: #0e7490;
}

.badge.rival {
  background: #b91c1c;
}
</style>
