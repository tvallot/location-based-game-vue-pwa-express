<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

// Animated underwater layer drawn over the map. Rendering happens in a Web Worker
// through an OffscreenCanvas so that the main thread stays free for Leaflet.

const props = withDefaults(
  defineProps<{ bubbleCount?: number; bubbleMinRadius?: number; bubbleMaxRadius?: number }>(),
  { bubbleCount: 60, bubbleMinRadius: 2, bubbleMaxRadius: 8 },
)

const canvas = ref<HTMLCanvasElement | null>(null)
let worker: Worker | null = null

function parentSize() {
  const parent = canvas.value?.parentElement
  return { width: parent?.clientWidth ?? 0, height: parent?.clientHeight ?? 0 }
}

function onResize() {
  worker?.postMessage({ type: 'resize', ...parentSize() })
}

onMounted(() => {
  if (!canvas.value || !('transferControlToOffscreen' in canvas.value)) return

  const offscreen = canvas.value.transferControlToOffscreen()
  worker = new Worker(new URL('../workers/waterWorker.ts', import.meta.url), { type: 'module' })
  worker.postMessage(
    {
      type: 'init',
      canvas: offscreen,
      ...parentSize(),
      bubbleCount: props.bubbleCount,
      bubbleMinRadius: props.bubbleMinRadius,
      bubbleMaxRadius: props.bubbleMaxRadius,
    },
    [offscreen],
  )
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  worker?.postMessage({ type: 'stop' })
  worker?.terminate()
  worker = null
})
</script>

<template>
  <canvas ref="canvas" class="water" aria-hidden="true"></canvas>
</template>

<style scoped>
.water {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 400;
}
</style>
