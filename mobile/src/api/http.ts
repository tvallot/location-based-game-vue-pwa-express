import { useAuthStore } from '@/stores/auth'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body: Record<string, unknown> = {},
  ) {
    super(message)
  }
}

/** Calls the game API (proxied under /api) with the current token. */
export async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const auth = useAuthStore()
  const headers: Record<string, string> = {}

  if (auth.token) headers.Authorization = `Bearer ${auth.token}`
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  const response = await fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    if (response.status === 401 && auth.token) auth.logout()
    throw new ApiError(response.status, data.error ?? response.statusText, data)
  }

  return data as T
}
