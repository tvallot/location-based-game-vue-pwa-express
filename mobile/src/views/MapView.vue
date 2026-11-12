<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import GameMap from '@/components/GameMap.vue'
import { useAuthStore } from '@/stores/auth'
import { useGameStore } from '@/stores/game'
import { shareText, useScreenWakeLock } from '@/utils/device'

const auth = useAuthStore()
const game = useGameStore()
const wakeLock = useScreenWakeLock()

onMounted(() => wakeLock.start())
onBeforeUnmount(() => wakeLock.stop())

function shareScore() {
  const score = game.me?.objectsDone ?? 0
  const verb = auth.role === 'rival' ? 'collected' : 'secured'
  void shareText('Nautilus Hunt', `${auth.login} ${verb} ${score} artifact(s) in Nautilus Hunt!`)
}
</script>

<template>
  <section class="map-view">
    <div class="status">
      <span>Score: {{ game.me?.objectsDone ?? 0 }}</span>
      <span v-if="auth.role === 'rival'">Captures: {{ game.me?.captures ?? 0 }}</span>
      <span v-if="game.heading !== null">Heading: {{ game.heading.toFixed(0) }}°</span>
      <button type="button" class="secondary" @click="shareScore">Share score</button>
    </div>

    <p v-if="game.gpsError" class="hint">{{ game.gpsError }}</p>
    <p v-else-if="!game.hasGpsFix" class="hint">
      Waiting for GPS… You can also tap the map to move.
    </p>
    <p v-if="!wakeLock.supported" class="hint">Keep your screen on during the game.</p>
    <p v-if="game.error" class="error">{{ game.error }}</p>

    <div v-if="game.message" class="toast" role="status">
      <span>{{ game.message }}</span>
      <button type="button" class="secondary" @click="game.message = ''">OK</button>
    </div>

    <GameMap class="game-map" />
  </section>
</template>

<style scoped>
.map-view {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  height: calc(100dvh - 5rem);
}

.status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
}

.status button {
  margin-left: auto;
}

.hint {
  margin: 0;
  font-size: 0.9rem;
  color: var(--muted);
}

.game-map {
  flex: 1;
}

.toast {
  position: absolute;
  z-index: 1000;
  left: 50%;
  bottom: 1rem;
  transform: translateX(-50%);
  width: min(90%, 420px);
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.4);
}

.toast span {
  flex: 1;
}
</style>
