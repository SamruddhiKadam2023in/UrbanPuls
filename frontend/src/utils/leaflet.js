import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Dark basemap (CartoDB, based on OpenStreetMap). Free for moderate use; attribution is required.
export const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
export const TILE_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>'
export const MUMBAI = [19.076, 72.8777]

export function createMap(el, { center = MUMBAI, zoom = 12 } = {}) {
  const map = L.map(el, { zoomControl: false }).setView(center, zoom)
  L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map)
  L.control.zoom({ position: 'bottomright' }).addTo(map)
  return map
}

// Great-circle distance in km
export function distanceKm(a, b) {
  const R = 6371, rad = d => d * Math.PI / 180
  const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Opens turn-by-turn directions in Google Maps (app on phones, website on desktop). No API key needed.
export const directionsUrl = (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`

export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export default L
