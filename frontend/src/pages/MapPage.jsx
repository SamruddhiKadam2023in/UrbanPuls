import { useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { fetchZones, selectZone } from '../store/slices/zonesSlice'
import { fetchPrediction } from '../store/slices/trafficSlice'
import BookingModal from '../components/booking/BookingModal'
import L, { createMap, directionsUrl, distanceKm, escapeHtml } from '../utils/leaflet'
import api from '../utils/api'
import { rupees } from '../utils/format'

// "🚗 12 · 🏍 8" when a lot has both kinds of slots
const freeByType = (z) => {
  const b = z.available_by_type || {}
  return (z.slots_by_type?.two_wheeler || 0) > 0 ? `🚗 ${b.four_wheeler || 0} · 🏍 ${b.two_wheeler || 0}` : null
}
const priceText = (z) => z.two_wheeler_price_per_hour && (z.slots_by_type?.two_wheeler || 0) > 0
  ? `🚗 ₹${z.price_per_hour} · 🏍 ₹${z.two_wheeler_price_per_hour}/hr` : `₹${z.price_per_hour}/hr`

const Stars = ({ avg, count }) => avg
  ? <span style={{ fontSize: '12px', color: '#ffd166' }}>★ {avg.toFixed(1)} <span style={{ color: 'var(--c-text3)' }}>({count})</span></span>
  : null

export default function MapPage() {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const mapEl = useRef(null)
  const map = useRef(null)
  const layer = useRef(null)
  const meMarker = useRef(null)
  const zonesRef = useRef([])

  const [showBooking, setShowBooking] = useState(false)
  const [tab, setTab] = useState('map')
  const [query, setQuery] = useState('')
  const [me, setMe] = useState(null)          // [lat, lng] once the user shares location
  const [locating, setLocating] = useState(false)
  const [reviews, setReviews] = useState([])

  const zones = useSelector(s => s.zones.list)
  const selected = useSelector(s => s.zones.selected)
  const prediction = useSelector(s => s.traffic.prediction)

  zonesRef.current = zones

  // Keep the side panel in sync when live updates refresh the zone list
  useEffect(() => {
    if (selected) {
      const fresh = zones.find(z => z.id === selected.id)
      if (fresh && fresh !== selected) dispatch(selectZone(fresh))
    }
  }, [zones])

  useEffect(() => { dispatch(fetchZones()) }, [])

  useEffect(() => {
    if (!selected) return
    api.get(`/zones/${selected.id}/ratings`).then(r => setReviews(r.data)).catch(() => setReviews([]))
  }, [selected?.id])

  const openZone = (zone, fly = false) => {
    dispatch(selectZone(zone))
    dispatch(fetchPrediction(zone.id))
    if (fly && map.current) map.current.flyTo([zone.latitude, zone.longitude], 16)
  }

  // Map setup (once)
  useEffect(() => {
    map.current = createMap(mapEl.current)
    layer.current = L.layerGroup().addTo(map.current)
    // Popup buttons are plain HTML, so wire them up when a popup opens
    map.current.on('popupopen', (e) => {
      const btn = e.popup.getElement()?.querySelector('[data-book-zone]')
      if (!btn) return
      btn.addEventListener('click', () => {
        const zone = zonesRef.current.find(z => z.id === Number(btn.dataset.bookZone))
        if (zone) { dispatch(selectZone(zone)); setShowBooking(true) }
      })
    })
    return () => { map.current.remove(); map.current = null }
  }, [])

  // Markers
  useEffect(() => {
    if (!layer.current) return
    layer.current.clearLayers()
    zones.forEach(zone => {
      const avail = zone.available_slots || 0
      const color = avail > 0 ? '#06d6a0' : '#ef233c'
      const marker = L.circleMarker([zone.latitude, zone.longitude], {
        radius: 12, fillColor: color, fillOpacity: 1, color: '#ffffff', weight: 2.5,
      })
      marker.bindPopup(`
        <div style="font-family:DM Sans,sans-serif;min-width:190px;padding:4px">
          <div style="font-weight:700;font-size:14px;color:#e2e8f0;margin-bottom:4px">${escapeHtml(zone.name)}</div>
          <div style="font-size:12px;color:#94a3b8;margin-bottom:8px">${escapeHtml(zone.address)}</div>
          <div style="display:flex;gap:12px;margin-bottom:10px;font-size:12px">
            <span style="color:${color};font-weight:600">${escapeHtml(freeByType(zone) || `${avail} ${t('map.free_now', 'free now')}`)}</span>
            <span style="color:#64748b">${escapeHtml(priceText(zone))}</span>
            ${zone.avg_rating ? `<span style="color:#ffd166">★ ${zone.avg_rating.toFixed(1)}</span>` : ''}
          </div>
          <div style="display:flex;gap:6px">
            <button data-book-zone="${zone.id}" style="flex:2;background:linear-gradient(135deg,#3b82f6,#1d4ed8);color:white;border:none;padding:8px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600">🅿 ${escapeHtml(t('map.reserve', 'Reserve'))}</button>
            <a href="${directionsUrl(zone.latitude, zone.longitude)}" target="_blank" rel="noopener" style="flex:1;text-align:center;background:#1c2a44;color:#e2e8f0;padding:8px;border-radius:8px;font-size:13px;text-decoration:none">🧭</a>
          </div>
        </div>`, { className: 'dark-popup', maxWidth: 240 })
      marker.on('click', () => openZone(zone))
      marker.addTo(layer.current)
    })
  }, [zones])

  const locate = () => {
    if (!navigator.geolocation) return toast.error(t('map.no_geo', 'Location is not available on this device'))
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = [pos.coords.latitude, pos.coords.longitude]
        setMe(here); setLocating(false); setTab('list')
        if (map.current) {
          meMarker.current?.remove()
          meMarker.current = L.circleMarker(here, { radius: 8, color: '#fff', weight: 2, fillColor: '#3b82f6', fillOpacity: 1 })
            .bindTooltip(t('map.you_are_here', 'You are here')).addTo(map.current)
        }
      },
      () => { setLocating(false); toast.error(t('map.geo_denied', 'Could not get your location. Check the browser permission.')) },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    let items = zones.filter(z => !q || z.name.toLowerCase().includes(q) || z.address.toLowerCase().includes(q))
      .map(z => ({ ...z, distance: me ? distanceKm(me, [z.latitude, z.longitude]) : null }))
    if (me) items.sort((a, b) => a.distance - b.distance)
    return items
  }, [zones, query, me])

  const totalAvail = zones.reduce((a, z) => a + (z.available_slots || 0), 0)

  return (
    <div style={{ height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        .dark-popup .leaflet-popup-content-wrapper { background:#162035 !important; border:1px solid rgba(96,165,250,0.2) !important; border-radius:12px !important; color:#e2e8f0 !important; }
        .dark-popup .leaflet-popup-tip { background:#162035 !important; }
        .dark-popup .leaflet-popup-close-button { color:#94a3b8 !important; }
        .leaflet-container { font-family:'DM Sans',sans-serif; background:#0d1425; }
      `}</style>

      <div style={{ background: 'var(--c-bg2)', borderBottom: '1px solid var(--c-border)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <input placeholder={`🔍 ${t('map.search', 'Search parking zone...')}`} value={query} onChange={e => setQuery(e.target.value)}
          className="input" style={{ flex: 1, minWidth: '180px', padding: '8px 12px' }} />
        <button onClick={locate} disabled={locating} className="btn btn-outline btn-sm">
          📍 {locating ? t('map.locating', 'Locating...') : t('map.near_me', 'Near me')}
        </button>
        <span className="badge badge-green">{totalAvail} {t('map.slots_free', 'slots free')}</span>
        <div style={{ display: 'flex', gap: '4px', background: 'var(--c-bg3)', padding: '3px', borderRadius: '10px' }}>
          {[['map', t('map.map_view', '🗺 Map')], ['list', t('map.list_view', '📋 List')]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              style={{ padding: '5px 14px', borderRadius: '8px', border: 'none', fontSize: '12px', cursor: 'pointer', background: tab === k ? 'var(--c-surface2)' : 'transparent', color: tab === k ? 'var(--c-text)' : 'var(--c-text2)' }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <div ref={mapEl} style={{ width: '100%', height: '100%', visibility: tab === 'map' ? 'visible' : 'hidden' }} />

          {tab === 'list' && (
            <div style={{ position: 'absolute', inset: 0, background: 'var(--c-bg)', overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 500 }}>
              {list.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: 'var(--c-text3)' }}>{t('map.no_zones', 'No zones found')}</div>}
              {list.map(zone => {
                const avail = zone.available_slots || 0
                const pct = zone.total_slots ? Math.round((avail / zone.total_slots) * 100) : 0
                const color = pct > 50 ? '#06d6a0' : pct > 20 ? '#ffd166' : '#ef233c'
                return (
                  <div key={zone.id} className="card" style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '15px', color: 'var(--c-text)' }}>{zone.name}</span>
                          <span className="badge" style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}>{freeByType(zone) || `${avail} ${t('map.free_now', 'free now')}`}</span>
                          <Stars avg={zone.avg_rating} count={zone.rating_count} />
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--c-text2)', marginBottom: '8px' }}>
                          📍 {zone.address}{zone.distance != null && <strong style={{ color: 'var(--c-primary-light)' }}> · {zone.distance < 1 ? `${Math.round(zone.distance * 1000)} m` : `${zone.distance.toFixed(1)} km`}</strong>}
                        </p>
                        <div style={{ height: '5px', background: 'var(--c-bg2)', borderRadius: '3px', overflow: 'hidden', marginBottom: '6px' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: color }} />
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--c-text3)' }}>{priceText(zone)}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <button onClick={() => { dispatch(selectZone(zone)); setShowBooking(true) }} className="btn btn-primary btn-sm">{t('map.reserve', 'Reserve')} →</button>
                        <button onClick={() => { setTab('map'); openZone(zone, true) }} className="btn btn-ghost btn-sm">🗺 {t('map.view', 'View')}</button>
                        <a href={directionsUrl(zone.latitude, zone.longitude)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">🧭 {t('map.directions', 'Directions')}</a>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {tab === 'map' && (
            <div style={{ position: 'absolute', bottom: '16px', left: '16px', background: 'rgba(8,13,26,0.9)', border: '1px solid var(--c-border)', borderRadius: '12px', padding: '8px 14px', display: 'flex', gap: '16px', zIndex: 500, fontSize: '12px', color: 'var(--c-text2)' }}>
              <span>🟢 {t('map.available', 'Available')}</span><span>🔴 {t('map.full', 'Full')}</span>
            </div>
          )}
        </div>

        {selected && (
          <aside style={{ width: 'min(320px, 100%)', borderLeft: '1px solid var(--c-border)', background: 'var(--c-bg2)', overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', position: window.innerWidth < 700 ? 'absolute' : 'relative', right: 0, top: 0, bottom: 0, zIndex: 600 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 700, color: 'var(--c-text)' }}>{t('map.zone_details', 'Zone details')}</h3>
              <button onClick={() => dispatch(selectZone(null))} aria-label="Close" style={{ background: 'none', border: 'none', color: 'var(--c-text3)', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>

            <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: '12px', padding: '14px' }}>
              <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--c-text)', marginBottom: '4px' }}>{selected.name}</p>
              <p style={{ fontSize: '12px', color: 'var(--c-text2)', marginBottom: '6px' }}>📍 {selected.address}</p>
              <div style={{ marginBottom: '12px' }}><Stars avg={selected.avg_rating} count={selected.rating_count} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                {[
                  [t('map.free_now', 'Free now'), selected.available_slots || 0, '#06d6a0'],
                  [t('map.total', 'Total'), selected.total_slots, 'var(--c-text)'],
                  [t('map.price', 'Price'), priceText(selected), '#3b82f6'],
                ].map(([l, v, c]) => (
                  <div key={l} style={{ background: 'var(--c-bg2)', borderRadius: '8px', padding: '10px' }}>
                    <p style={{ fontSize: '10px', color: 'var(--c-text3)', marginBottom: '3px', textTransform: 'uppercase' }}>{l}</p>
                    <p style={{ fontSize: '16px', fontWeight: 700, color: c, fontFamily: 'var(--font-display)' }}>{v}</p>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setShowBooking(true)} className="btn btn-primary" style={{ flex: 2 }}>🅿 {t('map.reserve', 'Reserve')}</button>
                <a href={directionsUrl(selected.latitude, selected.longitude)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ flex: 1 }}>🧭</a>
              </div>
            </div>

            {prediction && prediction.zone_id === selected.id && prediction.peak_hours?.length > 0 && (
              <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: '12px', padding: '14px' }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--c-text)', marginBottom: '10px' }}>📈 {t('map.traffic_pred', 'Traffic prediction')}</p>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#ffd166' }}>🔴 {t('map.peak', 'Busiest hours')}</p>
                <p style={{ fontSize: '12px', color: 'var(--c-text2)', marginBottom: '8px' }}>{prediction.peak_hours.map(h => `${h}:00`).join(', ')}</p>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#06d6a0' }}>🟢 {t('map.best', 'Quietest hours')}</p>
                <p style={{ fontSize: '12px', color: 'var(--c-text2)' }}>{prediction.best_travel_hours.map(h => `${h}:00`).join(', ')}</p>
              </div>
            )}

            {selected.slots?.length > 0 && (
              <div>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--c-text)', marginBottom: '8px' }}>{t('map.slot_avail', 'Slots right now')}</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  {selected.slots.filter(s => s.is_active).slice(0, 40).map(slot => (
                    <div key={slot.id} style={{ padding: '6px 4px', borderRadius: '6px', textAlign: 'center', fontSize: '10px', fontWeight: 600, fontFamily: 'var(--font-mono)', background: slot.is_available_now ? 'rgba(6,214,160,0.1)' : 'rgba(239,35,60,0.1)', border: `1px solid ${slot.is_available_now ? 'rgba(6,214,160,0.3)' : 'rgba(239,35,60,0.3)'}`, color: slot.is_available_now ? '#06d6a0' : '#f87171' }}>
                      {slot.slot_number}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {reviews.length > 0 && (
              <div>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--c-text)', marginBottom: '8px' }}>{t('map.reviews', 'Recent reviews')}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {reviews.slice(0, 5).map((r, i) => (
                    <div key={i} style={{ background: 'var(--c-surface)', borderRadius: '8px', padding: '10px' }}>
                      <p style={{ fontSize: '12px', color: '#ffd166' }}>{'★'.repeat(r.stars)}<span style={{ color: 'var(--c-text3)' }}>{'★'.repeat(5 - r.stars)}</span> <span style={{ color: 'var(--c-text3)' }}>· {r.by}</span></p>
                      {r.comment && <p style={{ fontSize: '12px', color: 'var(--c-text2)', marginTop: '4px' }}>{r.comment}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {showBooking && selected && <BookingModal zone={selected} onClose={() => setShowBooking(false)} />}
    </div>
  )
}
