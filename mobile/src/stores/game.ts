import { defineStore } from 'pinia'
import { apiFetch, ApiError } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import type { GameArea, GameObject, LatLon, Me, Player, ResourcesResponse } from '@/types'
import { notify, vibrate } from '@/utils/device'
import { bearingDegrees, distanceMeters } from '@/utils/geo'

// Must match the server rules (api/src/game/rules.js).
const RANGE = { explorerSecure: 10, rivalCollect: 5, capture: 5 }

// Lyon 1 campus, used until the first GPS fix.
const DEFAULT_POSITION: LatLon = [45.782, 4.8656]

export const useGameStore = defineStore('game', {
  state: () => ({
    me: null as Me | null,
    players: [] as Player[],
    objects: [] as GameObject[],
    zrr: null as GameArea | null,

    position: DEFAULT_POSITION as LatLon,
    hasGpsFix: false,
    heading: null as number | null,
    gpsWatchId: null as number | null,
    gpsError: '',

    message: '',
    error: '',

    // Avoid sending the same action twice while a request is in flight,
    // and notifying twice about the same thing.
    pending: new Set<string>(),
    alerted: new Set<string>(),
  }),

  getters: {
    role: () => useAuthStore().role,
    isEliminated: (state) => state.me?.active === false,
  },

  actions: {
    async announce(title: string, body: string, vibration?: number[]) {
      this.message = body
      if (vibration) vibrate(vibration)
      await notify(title, body)
    },

    // ---------- Position ----------

    setPosition(position: LatLon) {
      if (distanceMeters(this.position, position) > 0.5) {
        this.heading = bearingDegrees(this.position, position)
      }
      this.position = position
    },

    startGps() {
      if (this.gpsWatchId !== null) return
      if (!('geolocation' in navigator)) {
        this.gpsError = 'Geolocation is not available on this device. Tap the map to move.'
        return
      }

      this.gpsWatchId = navigator.geolocation.watchPosition(
        ({ coords }) => {
          this.hasGpsFix = true
          this.gpsError = ''
          this.setPosition([coords.latitude, coords.longitude])
        },
        () => {
          this.gpsError = 'GPS position unavailable. Tap the map to move.'
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 60_000 },
      )
    },

    stopGps() {
      if (this.gpsWatchId !== null) navigator.geolocation.clearWatch(this.gpsWatchId)
      this.gpsWatchId = null
    },

    async sendPosition(position?: LatLon) {
      position ??= this.position
      this.setPosition(position)
      if (this.isEliminated) return

      try {
        const result = await apiFetch<{ ok: boolean; eliminatedBy?: string }>('/game/position', {
          method: 'POST',
          body: { position },
        })
        if (result.eliminatedBy === 'creature') await this.fetchResources()
      } catch (error) {
        this.handleError(error)
      }
    },

    // ---------- Game data ----------

    async fetchZrr() {
      try {
        this.zrr = await apiFetch<GameArea>('/game/zrr')
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) this.zrr = null
        else this.handleError(error)
      }
    },

    async fetchResources() {
      // User Timing marks: used to measure the client-side cost of a refresh (see docs/performance.md).
      performance.mark('resources-fetch-start')

      try {
        const data = await apiFetch<ResourcesResponse>('/game/resources')
        performance.mark('resources-response-received')

        this.me = data.me
        this.players = data.resources.filter((r): r is Player => r.role !== 'object')
        this.objects = data.resources.filter((r): r is GameObject => r.role === 'object')
        this.error = ''

        performance.mark('resources-processed')
        performance.measure(
          'resources-fetch',
          'resources-fetch-start',
          'resources-response-received',
        )
        performance.measure(
          'resources-processing',
          'resources-response-received',
          'resources-processed',
        )

        await this.checkElimination()
        await this.checkAlerts()
      } catch (error) {
        this.handleError(error)
      }
    },

    /** Local countdown between two refreshes. */
    tickTtls(elapsedMs: number) {
      for (const object of this.objects) object.ttlMs = Math.max(0, object.ttlMs - elapsedMs)
      this.objects = this.objects.filter((object) => object.ttlMs > 0)
    },

    async checkElimination() {
      if (!this.isEliminated || this.alerted.has('eliminated')) return
      this.alerted.add('eliminated')
      this.players = []
      this.objects = []

      const body =
        this.me?.eliminatedBy === 'creature'
          ? 'A sea creature had you for lunch. Your mission ends here.'
          : 'A rival caught you. Your mission ends here.'
      await this.announce('You are out!', body, [500, 200, 500])
    },

    /** Explorers are warned when a rival gets close to an object. */
    async checkAlerts() {
      for (const object of this.objects) {
        const key = `rival-near-${object.id}`
        if (!object.rivalNearby || object.secured || this.alerted.has(key)) continue
        this.alerted.add(key)
        await this.announce(
          'Rival nearby',
          'A rival is approaching an object near you. Hurry up!',
          [100, 50, 100],
        )
      }
    },

    // ---------- Actions ----------

    /**
     * Called after each refresh: triggers the actions the player is close enough to perform.
     * The server checks the real distances, the client only avoids pointless requests.
     */
    async actOnSurroundings() {
      if (this.isEliminated || !this.me) return

      for (const object of this.objects) {
        if (object.secured) continue
        const distance = distanceMeters(this.position, object.position)
        // Explorers only know the object is somewhere inside the uncertainty circle.
        const reach =
          this.role === 'explorer'
            ? RANGE.explorerSecure + (object.approxRadius ?? 0)
            : RANGE.rivalCollect
        if (distance <= reach) await this.treatObject(object.id)
      }

      if (this.role === 'rival') {
        for (const player of this.players) {
          if (player.role !== 'explorer') continue
          if (distanceMeters(this.position, player.position) <= RANGE.capture) {
            await this.captureExplorer(player.id)
          }
        }
      }
    },

    async treatObject(objectId: string) {
      const key = `treat-${objectId}`
      if (this.pending.has(key)) return
      this.pending.add(key)

      try {
        const { result } = await apiFetch<{ result: 'secured' | 'collected' | 'creature' }>(
          `/game/objects/${encodeURIComponent(objectId)}/treat`,
          { method: 'POST' },
        )

        if (result === 'creature') {
          if (!this.alerted.has(`creature-${objectId}`)) {
            this.alerted.add(`creature-${objectId}`)
            await this.announce('Danger', 'This is a sea creature. Keep at least 5 m away!', [800])
          }
        } else if (result === 'secured') {
          await this.announce(
            'Artifact secured',
            'The rivals can no longer take this artifact.',
            [200, 100, 200],
          )
        } else {
          await this.announce(
            'Artifact collected',
            'You got the artifact before the explorers.',
            [200, 100, 200],
          )
        }
        await this.fetchResources()
      } catch (error) {
        // 403 "too far" is expected when the uncertainty circle is wide.
        if (!(error instanceof ApiError && (error.status === 403 || error.status === 409))) {
          this.handleError(error)
        }
      } finally {
        this.pending.delete(key)
      }
    },

    async captureExplorer(explorerId: string) {
      const key = `capture-${explorerId}`
      if (this.pending.has(key)) return
      this.pending.add(key)

      try {
        await apiFetch(`/game/explorers/${encodeURIComponent(explorerId)}/capture`, {
          method: 'POST',
        })
        await this.announce('Capture', `You captured ${explorerId}.`, [300, 100, 300])
        await this.fetchResources()
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 403)) this.handleError(error)
      } finally {
        this.pending.delete(key)
      }
    },

    handleError(error: unknown) {
      if (error instanceof ApiError && error.status === 401) return
      this.error = navigator.onLine ? 'Could not reach the game server.' : 'You are offline.'
      console.error(error)
    },

    reset() {
      this.stopGps()
      this.$reset()
      this.pending = new Set()
      this.alerted = new Set()
    },
  },
})
