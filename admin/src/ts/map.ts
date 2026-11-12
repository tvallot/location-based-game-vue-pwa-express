import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { GameArea, Resource } from './api';
import type { LatLon } from './types';

const DEFAULT_CENTER: LatLon = [45.782, 4.8656];

const COLORS = {
  explorer: '#0891b2',
  rival: '#dc2626',
  artifact: '#f59e0b',
  secured: '#16a34a',
  creature: '#7c3aed',
};

export class LiveMap {
  readonly map: L.Map;
  private markers = new Map<string, L.CircleMarker>();
  private zrrLayer: L.Polygon | null = null;
  private spawnMarker: L.CircleMarker | null = null;

  constructor(elementId: string, onPick: (position: LatLon) => void) {
    this.map = L.map(elementId, { center: DEFAULT_CENTER, zoom: 17 });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);

    this.map.on('click', (event: L.LeafletMouseEvent) => {
      const position: LatLon = [event.latlng.lat, event.latlng.lng];
      this.showSpawnPosition(position);
      onPick(position);
    });
  }

  visibleArea(): GameArea {
    const bounds = this.map.getBounds();
    const north = bounds.getNorth();
    const south = bounds.getSouth();
    const east = bounds.getEast();
    const west = bounds.getWest();
    return { nw: [north, west], ne: [north, east], se: [south, east], sw: [south, west] };
  }

  showZrr(zrr: GameArea | null): void {
    this.zrrLayer?.remove();
    this.zrrLayer = zrr
      ? L.polygon([zrr.nw, zrr.ne, zrr.se, zrr.sw], { color: '#facc15', fill: false }).addTo(this.map)
      : null;
  }

  showSpawnPosition(position: LatLon): void {
    this.spawnMarker?.remove();
    this.spawnMarker = L.circleMarker(position, { radius: 6, color: '#fff', dashArray: '3' }).addTo(this.map);
  }

  /** Updates markers in place so popups stay open across refreshes. */
  showResources(resources: Resource[]): void {
    const ids = new Set(resources.map((resource) => resource.id));
    for (const [id, marker] of this.markers) {
      if (!ids.has(id)) {
        marker.remove();
        this.markers.delete(id);
      }
    }

    for (const resource of resources) {
      const color = colorOf(resource);
      const popup = popupOf(resource);
      const existing = this.markers.get(resource.id);

      if (existing) {
        existing.setLatLng(resource.position).setStyle({ color, fillColor: color }).setPopupContent(popup);
      } else {
        const marker = L.circleMarker(resource.position, { radius: 8, color, fillColor: color, fillOpacity: 0.8 })
          .bindPopup(popup)
          .addTo(this.map);
        this.markers.set(resource.id, marker);
      }
    }
  }
}

function colorOf(resource: Resource): string {
  if (resource.role !== 'object') return COLORS[resource.role];
  if (resource.type === 'creature') return COLORS.creature;
  return resource.secured ? COLORS.secured : COLORS.artifact;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function popupOf(resource: Resource): string {
  if (resource.role === 'object') {
    const seconds = Math.ceil((resource.ttlMs ?? 0) / 1000);
    const status = resource.type === 'creature' ? 'creature' : resource.secured ? 'secured' : 'available';
    return `<strong>${escapeHtml(resource.id)}</strong><br>${status}<br>disappears in ${seconds} s`;
  }
  return `<strong>${escapeHtml(resource.id)}</strong><br>${resource.role}<br>score: ${resource.objectsDone ?? 0}`;
}
