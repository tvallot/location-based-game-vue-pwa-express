<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
</script>

<template>
  <section class="card">
    <h2>Welcome, {{ auth.login }}</h2>

    <template v-if="auth.role === 'explorer'">
      <p>You are an <strong>explorer</strong>. Objects appear on the map as blurred areas.</p>
      <ul>
        <li>
          Get within 10 m of an artifact to <strong>secure</strong> it before the rivals take it.
        </li>
        <li>Rivals are invisible to you, but you are warned when one gets close to an object.</li>
        <li>Rivals can see you and capture you if they get within 5 m.</li>
      </ul>
    </template>

    <template v-else-if="auth.role === 'rival'">
      <p>
        You are a <strong>rival</strong>. You see the exact position of every object and every
        explorer.
      </p>
      <ul>
        <li>
          Get within 5 m of an artifact to <strong>collect</strong> it, unless an explorer secured
          it first.
        </li>
        <li>Get within 5 m of an explorer to <strong>capture</strong> them.</li>
      </ul>
    </template>

    <template v-else>
      <p>Game masters use the admin dashboard at <a href="/admin/">/admin</a>.</p>
    </template>

    <p class="warning">
      Some objects are sea creatures. Nobody knows which until they get close, and walking within 5
      m of one ends your game.
    </p>

    <RouterLink v-if="auth.role !== 'admin'" class="button" to="/map">Open the map</RouterLink>
  </section>
</template>

<style scoped>
ul {
  padding-left: 1.2rem;
  line-height: 1.6;
}

.warning {
  color: var(--warning);
}
</style>
