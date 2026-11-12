<script setup lang="ts">
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import WaterOverlay from '@/components/WaterOverlay.vue'
import { useGameStore } from '@/stores/game'
import type { GameObject, LatLon, Player } from '@/types'
import { distanceMeters } from '@/utils/geo'

const REFRESH_INTERVAL_MS = 10_000
const INITIAL_ZOOM = 16

const game = useGameStore()
const container = ref<HTMLDivElement | null>(null)

let map: L.Map | null = null
let zrrLayer: L.Polygon | null = null
let meMarker: L.Marker | null = null
const playerMarkers = new Map<string, L.Marker>()
const objectLayers = new Map<string, { marker: L.Marker; circle: L.Circle }>()
let refreshTimer: number | undefined
let ttlTimer: number | undefined
let redrawFrame: number | null = null

const icon = (file: string) =>
  L.icon({ iconUrl: `/${file}`, iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] })
const icons = {
  me: icon('current-player.png'),
  explorer: icon('explorer.png'),
  rival: icon('rival.png'),
  object: icon('object.png'),
}

const formatDistance = (position: LatLon) =>
  `${distanceMeters(game.position, position).toFixed(0)} m`

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)

function playerPopup(player: Player) {
  return `<strong>${escapeHtml(player.id)}</strong> (${player.role})<br>Score: ${player.objectsDone}<br>Distance: ${formatDistance(player.position)}`
}

function objectPopup(object: GameObject) {
  const lines = [
    `<strong>${object.secured ? 'Secured artifact' : 'Unknown object'}</strong>`,
    `Distance: ${formatDistance(object.position)}`,
    `Disappears in: ${Math.ceil(object.ttlMs / 1000)} s`,
  ]
  if (object.approxRadius) lines.push(`Somewhere within ${object.approxRadius} m`)
  return lines.join('<br>')
}

/** Updates markers in place instead of clearing the map on every refresh. */
function syncPlayers() {
  const ids = new Set(game.players.map((player) => player.id))
  for (const [id, marker] of playerMarkers) {
    if (!ids.has(id)) {
      marker.remove()
      playerMarkers.delete(id)
    }
  }

  for (const player of game.players) {
    const existing = playerMarkers.get(player.id)
    if (existing) {
      existing.setLatLng(player.position).setPopupContent(playerPopup(player))
    } else {
      const marker = L.marker(player.position, {
        icon: icons[player.role === 'rival' ? 'rival' : 'explorer'],
      })
      playerMarkers.set(player.id, marker.bindPopup(playerPopup(player)).addTo(map!))
    }
  }
}

function syncObjects() {
  const ids = new Set(game.objects.map((object) => object.id))
  for (const [id, layers] of objectLayers) {
    if (!ids.has(id)) {
      layers.marker.remove()
      layers.circle.remove()
      objectLayers.delete(id)
    }
  }

  for (const object of game.objects) {
    const color = object.secured ? '#22c55e' : object.rivalNearby ? '#f97316' : '#38bdf8'
    const radius = object.approxRadius ?? 5
    const existing = objectLayers.get(object.id)

    if (existing) {
      existing.marker.setLatLng(object.position).setPopupContent(objectPopup(object))
      existing.circle.setLatLng(object.position).setRadius(radius).setStyle({ color })
    } else {
      objectLayers.set(object.id, {
        circle: L.circle(object.position, { radius, color, interactive: false }).addTo(map!),
        marker: L.marker(object.position, { icon: icons.object })
          .bindPopup(objectPopup(object))
          .addTo(map!),
      })
    }
  }
}

function syncZrr() {
  zrrLayer?.remove()
  zrrLayer = null
  if (game.zrr) {
    const { nw, ne, se, sw } = game.zrr
    zrrLayer = L.polygon([nw, ne, se, sw], {
      color: '#facc15',
      fill: false,
      interactive: false,
    }).addTo(map!)
  }
}

function draw() {
  if (!map) return
  syncZrr()
  syncPlayers()
  syncObjects()
  meMarker?.setLatLng(game.position)
}

/** Batches redraws to the next animation frame. */
function scheduleDraw() {
  if (redrawFrame !== null) return
  redrawFrame = requestAnimationFrame(() => {
    redrawFrame = null
    draw()
  })
}

async function refresh() {
  await game.sendPosition()
  await game.fetchResources()
  await game.actOnSurroundings()
  scheduleDraw()
}

onMounted(async () => {
  map = L.map(container.value!, { center: game.position, zoom: INITIAL_ZOOM })
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map)
  meMarker = L.marker(game.position, { icon: icons.me, zIndexOffset: 1000 })
    .bindPopup('You')
    .addTo(map)

  // Tapping the map moves the player: handy to play or demo without walking around.
  map.on('click', async (event: L.LeafletMouseEvent) => {
    await game.sendPosition([event.latlng.lat, event.latlng.lng])
    await game.fetchResources()
    await game.actOnSurroundings()
    scheduleDraw()
  })

  game.startGps()
  await game.fetchZrr()
  await refresh()

  refreshTimer = window.setInterval(refresh, REFRESH_INTERVAL_MS)
  ttlTimer = window.setInterval(() => game.tickTtls(1000), 1000)
})

// Center the map on the first real GPS fix.
watch(
  () => game.hasGpsFix,
  (hasFix) => {
    if (hasFix) map?.setView(game.position, INITIAL_ZOOM)
  },
)
watch(() => game.position, scheduleDraw)

onBeforeUnmount(() => {
  game.stopGps()
  window.clearInterval(refreshTimer)
  window.clearInterval(ttlTimer)
  if (redrawFrame !== null) cancelAnimationFrame(redrawFrame)
  map?.remove()
  map = null
  playerMarkers.clear()
  objectLayers.clear()
})
</script>

<template>
  <div class="map-wrapper">
    <div ref="container" class="leaflet-host"></div>
    <WaterOverlay />
  </div>
</template>

<style scoped>
.map-wrapper {
  position: relative;
  height: 100%;
  min-height: 60vh;
  border-radius: 12px;
  overflow: hidden;
}

.leaflet-host {
  position: absolute;
  inset: 0;
}
</style>
