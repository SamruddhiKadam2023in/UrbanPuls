import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const OSM_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

// Map background tiles.
// - With VITE_MAPTILER_KEY set (see frontend/.env.example): MapTiler's dark map. Use this in production.
// - Without a key: the free OpenStreetMap tiles, darkened with a CSS filter (fine for development
//   and light use; OpenStreetMap's usage policy does not allow heavy production traffic).
const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY
const MAPTILER_STYLE = import.meta.env.VITE_MAPTILER_STYLE || 'streets-v2-dark'

export const TILES = MAPTILER_KEY
  ? {
      url: `https://api.maptiler.com/maps/${MAPTILER_STYLE}/256/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`,
      attribution: '<a href="https://www.maptiler.com/copyright/">© MapTiler</a> ' + OSM_ATTRIBUTION,
      className: '',
    }
  : {
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: OSM_ATTRIBUTION,
      className: 'tpms-osm-dark',
    }
export const MUMBAI = [19.076, 72.8777]

export function createMap(el, { center = MUMBAI, zoom = 12 } = {}) {
  const map = L.map(el, { zoomControl: false }).setView(center, zoom)
  L.tileLayer(TILES.url, { attribution: TILES.attribution, className: TILES.className, maxZoom: 19 }).addTo(map)
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
