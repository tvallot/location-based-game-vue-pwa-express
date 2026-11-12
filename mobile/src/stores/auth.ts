import { defineStore } from 'pinia'
import { apiFetch } from '@/api/http'
import type { Role } from '@/types'

type TokenClaims = { sub?: string; species?: string; role?: string; exp?: number }

function decodeToken(token: string): TokenClaims | null {
  try {
    const payload = token.split('.')[1] ?? ''
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json) as TokenClaims
  } catch {
    return null
  }
}

function readStoredToken(): string {
  try {
    return localStorage.getItem('token') ?? ''
  } catch {
    return ''
  }
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: readStoredToken(),
  }),

  getters: {
    claims: (state) => (state.token ? decodeToken(state.token) : null),

    login(): string {
      return this.claims?.sub ?? ''
    },

    role(): Role | null {
      const role = (this.claims?.species ?? this.claims?.role ?? '').toLowerCase()
      return role === 'explorer' || role === 'rival' || role === 'admin' ? role : null
    },

    isLoggedIn(): boolean {
      const exp = this.claims?.exp
      return Boolean(this.token) && (exp === undefined || exp * 1000 > Date.now())
    },
  },

  actions: {
    async signIn(login: string, password: string) {
      const { token } = await apiFetch<{ token: string }>('/auth/login', {
        method: 'POST',
        body: { login, password },
      })
      this.token = token
      localStorage.setItem('token', token)
    },

    logout() {
      this.token = ''
      localStorage.removeItem('token')
    },
  },
})
