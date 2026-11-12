import './css/style.css';
import { api, ApiError, clearToken, getToken, signIn, type StatsResponse } from './ts/api';
import { LiveMap } from './ts/map';

const REFRESH_INTERVAL_MS = 5000;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let liveMap: LiveMap | null = null;
let refreshTimer: number | undefined;

function setStatus(id: string, text: string, isError = false): void {
  const element = $(id);
  element.textContent = text;
  element.classList.toggle('error', isError);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error';
}

// ---------- Views ----------

function showLogin(): void {
  window.clearInterval(refreshTimer);
  $('login-panel').hidden = false;
  $('dashboard').hidden = true;
  $('logout').hidden = true;
}

function showDashboard(): void {
  $('login-panel').hidden = true;
  $('dashboard').hidden = false;
  $('logout').hidden = false;

  liveMap ??= new LiveMap('map', ([lat, lon]) => {
    $<HTMLInputElement>('object-lat').value = lat.toFixed(6);
    $<HTMLInputElement>('object-lon').value = lon.toFixed(6);
  });
  liveMap.map.invalidateSize();

  void refresh();
  refreshTimer = window.setInterval(refresh, REFRESH_INTERVAL_MS);
}

// ---------- Data ----------

async function refresh(): Promise<void> {
  try {
    const [{ resources }, stats] = await Promise.all([api.resources(), api.stats()]);
    liveMap?.showResources(resources);
    renderScoreboard(stats);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      clearToken();
      showLogin();
    }
  }
}

function renderScoreboard({ players, totals }: StatsResponse): void {
  $('totals').innerHTML = `
    <span>Artifacts secured <strong>${totals.artifactsSecured}</strong></span>
    <span>Artifacts collected by rivals <strong>${totals.artifactsCollected}</strong></span>
    <span>Explorers captured <strong>${totals.explorersCaptured}</strong></span>
    <span>Eaten by creatures <strong>${totals.eatenByCreatures}</strong></span>`;

  const tbody = $('scoreboard');
  tbody.replaceChildren(
    ...players.map((player) => {
      const row = document.createElement('tr');
      const status = player.active ? 'playing' : player.eliminatedBy === 'capture' ? 'captured' : 'eaten';
      for (const value of [player.id, player.role, player.objectsDone, player.captures, status]) {
        const cell = document.createElement('td');
        cell.textContent = String(value);
        row.append(cell);
      }
      return row;
    }),
  );
}

// ---------- Forms ----------

$('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus('login-error', '');
  try {
    await signIn($<HTMLInputElement>('login').value.trim(), $<HTMLInputElement>('password').value);
    showDashboard();
  } catch (error) {
    const message =
      error instanceof ApiError && error.status === 403
        ? 'This account is not a game master.'
        : error instanceof ApiError && error.status === 401
          ? 'Wrong login or password.'
          : errorMessage(error);
    setStatus('login-error', message, true);
  }
});

$('logout').addEventListener('click', () => {
  clearToken();
  showLogin();
});

$('save-zrr').addEventListener('click', async () => {
  if (!liveMap) return;
  const zrr = liveMap.visibleArea();
  try {
    await api.setZrr(zrr);
    liveMap.showZrr(zrr);
    setStatus('zrr-status', 'Game area saved.');
  } catch (error) {
    setStatus('zrr-status', errorMessage(error), true);
  }
});

$('ttl-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const seconds = Number($<HTMLInputElement>('ttl').value);
  try {
    await api.setTtl(Math.round(seconds * 1000));
    setStatus('ttl-status', `New objects will last ${seconds} s.`);
  } catch (error) {
    setStatus('ttl-status', errorMessage(error), true);
  }
});

$('object-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const type = $<HTMLSelectElement>('object-type').value;
  const lat = Number($<HTMLInputElement>('object-lat').value);
  const lon = Number($<HTMLInputElement>('object-lon').value);
  try {
    const { id } = await api.spawnObject(type, [lat, lon]);
    setStatus('object-status', `Spawned ${type} ${id}.`);
    void refresh();
  } catch (error) {
    setStatus('object-status', errorMessage(error), true);
  }
});

// ---------- Start ----------

async function start(): Promise<void> {
  if (!getToken()) return showLogin();
  showDashboard();
  try {
    liveMap?.showZrr(await api.zrr());
  } catch {
    // No game area defined yet.
  }
}

void start();
