import { API_URL } from './config';
import type { LatLon } from './types';

const TOKEN_KEY = 'admin-token';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) throw new ApiError(response.status, data.error ?? response.statusText);
  return data as T;
}

export async function signIn(login: string, password: string): Promise<void> {
  const { token } = await request<{ token: string }>('POST', '/auth/login', { login, password });
  localStorage.setItem(TOKEN_KEY, token);
  // Make sure the account is really an admin before showing the dashboard.
  try {
    await request('GET', '/admin/stats');
  } catch (error) {
    clearToken();
    throw error;
  }
}

export const api = {
  resources: () => request<ResourcesResponse>('GET', '/game/resources'),
  stats: () => request<StatsResponse>('GET', '/admin/stats'),
  zrr: () => request<GameArea>('GET', '/game/zrr'),
  setZrr: (zrr: GameArea) => request('POST', '/admin/zrr', zrr),
  setTtl: (ttlMs: number) => request('POST', '/admin/ttl', { ttlMs }),
  spawnObject: (type: string, position: LatLon) =>
    request<{ id: string }>('POST', '/admin/objects', { type, position }),
};

export interface GameArea {
  nw: LatLon;
  ne: LatLon;
  se: LatLon;
  sw: LatLon;
}

export interface Resource {
  id: string;
  role: 'explorer' | 'rival' | 'object';
  position: LatLon;
  type?: 'artifact' | 'creature';
  ttlMs?: number;
  secured?: boolean;
  objectsDone?: number;
}

export interface ResourcesResponse {
  resources: Resource[];
}

export interface PlayerStats {
  id: string;
  role: 'explorer' | 'rival';
  objectsDone: number;
  captures: number;
  active: boolean;
  eliminatedBy: null | 'creature' | 'capture';
}

export interface StatsResponse {
  players: PlayerStats[];
  totals: {
    artifactsSecured: number;
    artifactsCollected: number;
    explorersCaptured: number;
    eatenByCreatures: number;
  };
}
