import { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchZones, selectZone } from '../store/slices/zonesSlice'
import { fetchHeatmap, fetchPrediction } from '../store/slices/trafficSlice'
import BookingModal from '../components/booking/BookingModal'

export default function MapPage() {
  const dispatch    = useDispatch()
  const mapRef      = useRef(null)
  const mapInstance = useRef(null)
  const markersRef  = useRef([])

  const [showBooking, setShowBooking] = useState(false)
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [selectedTab, setSelectedTab] = useState('map')
  const [searchQuery, setSearchQuery] = useState('')
  const [leafletReady, setLeafletReady] = useState(false)

  const zones      = useSelector(s => s.zones.list)
  const selected   = useSelector(s => s.zones.selected)
  const heatmap    = useSelector(s => s.traffic.heatmap)
  const prediction = useSelector(s => s.traffic.prediction)

  useEffect(() => {
    dispatch(fetchZones())
    dispatch(fetchHeatmap())
  }, [])

  // Load Leaflet CSS + JS dynamically
  useEffect(() => {
    if (window.L) { setLeafletReady(true); return }

    const link = document.createElement('link')
    link.rel  = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)

    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = () => setLeafletReady(true)
    document.head.appendChild(script)
  }, [])

  // Init map
  useEffect(() => {
    if (!leafletReady || !mapRef.current || mapInstance.current) return

    const L = window.L
    const map = L.map(mapRef.current, { zoomControl: false }).setView([19.076, 72.8777], 13)

    // Dark tile layer using CartoDB Dark Matter (completely free)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CartoDB',
      maxZoom: 19
    }).addTo(map)

    // Custom zoom control position
    L.control.zoom({ position: 'bottomright' }).addTo(map)

    mapInstance.current = map
  }, [leafletReady])

  // Add markers when zones load
  useEffect(() => {
    if (!mapInstance.current || !window.L || !zones.length) return
    const L = window.L

    // Remove old markers
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    zones.forEach(zone => {
      const avail = zone.available_slots || 0
      const color = avail > 0 ? '#06d6a0' : '#ef233c'

      // Custom circle marker
      const marker = L.circleMarker([zone.latitude, zone.longitude], {
        radius: 12,
        fillColor: color,
        fillOpacity: 1,
        color: '#ffffff',
        weight: 2.5,
      }).addTo(mapInstance.current)

      // Popup
      marker.bindPopup(`
        <div style="font-family:DM Sans,sans-serif;min-width:190px;padding:4px">
          <div style="font-weight:700;font-size:14px;color:#e2e8f0;margin-bottom:4px">${zone.name}</div>
          <div style="font-size:12px;color:#94a3b8;margin-bottom:8px">${zone.address}</div>
          <div style="display:flex;gap:12px;margin-bottom:10px">
            <span style="color:${color};font-size:12px;font-weight:600">✓ ${avail} free</span>
            <span style="color:#64748b;font-size:12px">₹${zone.price_per_hour}/hr</span>
          </div>
          <button onclick="window.__bookZone(${zone.id})"
            style="width:100%;background:linear-gradient(135deg,#3b82f6,#1d4ed8);color:white;border:none;padding:8px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600">
            🅿 Reserve
          </button>
        </div>
      `, {
        className: 'dark-popup',
        maxWidth: 220
      })

      marker.on('click', () => {
        dispatch(selectZone(zone))
        dispatch(fetchPrediction(zone.id))
      })

      markersRef.current.push(marker)
    })

    window.__bookZone = (zoneId) => {
      const zone = zones.find(z => z.id === zoneId)
      if (zone) { dispatch(selectZone(zone)); setShowBooking(true) }
    }
  }, [zones, leafletReady])

  const filteredZones = zones.filter(z =>
    z.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    z.address.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalAvail = zones.reduce((a, z) => a + (z.available_slots || 0), 0)

  return (
    <div style={{ height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column' }}>

      {/* Dark popup styles */}
      <style>{`
        .dark-popup .leaflet-popup-content-wrapper {
          background: #162035 !important;
          border: 1px solid rgba(96,165,250,0.2) !important;
          border-radius: 12px !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.6) !important;
          color: #e2e8f0 !important;
        }
        .dark-popup .leaflet-popup-tip { background: #162035 !important; }
        .dark-popup .leaflet-popup-close-button { color: #94a3b8 !important; }
        .leaflet-container { font-family: 'DM Sans', sans-serif; }
      `}</style>

      {/* Top bar */}
      <div style={{ background: 'var(--c-bg2)', borderBottom: '1px solid var(--c-border)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <input
          placeholder="🔍 Search parking zone..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ flex: 1, minWidth: '180px', padding: '8px 12px', background: 'var(--c-bg3)', border: '1px solid var(--c-border)', borderRadius: '10px', color: 'var(--c-text)', fontSize: '13px', outline: 'none', fontFamily: 'var(--font-body)' }}
        />

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', background: 'rgba(6,214,160,0.08)', border: '1px solid rgba(6,214,160,0.2)', borderRadius: '10px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#06d6a0', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: '12px', color: '#06d6a0', fontWeight: '500' }}>{totalAvail} slots free</span>
          </div>

          <div style={{ display: 'flex', gap: '4px', background: 'var(--c-bg3)', padding: '3px', borderRadius: '10px' }}>
            {[['map', '🗺 Map'], ['list', '📋 List']].map(([k, l]) => (
              <button key={k} onClick={() => setSelectedTab(k)}
                style={{ padding: '5px 14px', borderRadius: '8px', border: 'none', fontSize: '12px', fontWeight: '500', cursor: 'pointer', fontFamily: 'var(--font-body)', background: selectedTab === k ? 'var(--c-surface2)' : 'transparent', color: selectedTab === k ? 'var(--c-text)' : 'var(--c-text2)', transition: 'all 0.15s' }}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Map or List */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

          {/* Map */}
          <div ref={mapRef} style={{ width: '100%', height: '100%', display: selectedTab === 'map' ? 'block' : 'none' }} />

          {/* Loading overlay */}
          {selectedTab === 'map' && !leafletReady && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--c-bg2)', zIndex: 10 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>🗺️</div>
                <p style={{ color: 'var(--c-text2)', fontSize: '14px' }}>Loading map...</p>
              </div>
            </div>
          )}

          {/* Legend */}
          {selectedTab === 'map' && leafletReady && (
            <div style={{ position: 'absolute', bottom: '16px', left: '16px', background: 'rgba(8,13,26,0.9)', backdropFilter: 'blur(12px)', border: '1px solid var(--c-border)', borderRadius: '12px', padding: '10px 14px', display: 'flex', gap: '16px', zIndex: 500 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--c-text2)' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#06d6a0', display: 'inline-block' }} /> Available
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--c-text2)' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef233c', display: 'inline-block' }} /> Full
              </span>
              <span style={{ fontSize: '11px', color: 'var(--c-text3)' }}>© OpenStreetMap</span>
            </div>
          )}

          {/* List view */}
          {selectedTab === 'list' && (
            <div style={{ height: '100%', overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredZones.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--c-text3)' }}>No zones found</div>
              )}
              {filteredZones.map(zone => {
                const avail = zone.available_slots || 0
                const pct   = zone.total_slots ? Math.round((avail / zone.total_slots) * 100) : 0
                const color = pct > 50 ? '#06d6a0' : pct > 20 ? '#ffd166' : '#ef233c'
                return (
                  <div key={zone.id} className="card" style={{ padding: '18px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                          <span style={{ fontFamily: 'var(--font-display)', fontWeight: '600', fontSize: '15px', color: 'var(--c-text)' }}>{zone.name}</span>
                          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: `${color}20`, color, border: `1px solid ${color}40`, fontWeight: '600' }}>
                            {avail} free
                          </span>
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--c-text2)', marginBottom: '10px' }}>📍 {zone.address}</p>
                        <div style={{ height: '5px', background: 'var(--c-bg2)', borderRadius: '3px', overflow: 'hidden', marginBottom: '6px' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '3px', transition: 'width 0.5s' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '11px', color: 'var(--c-text3)' }}>₹{zone.price_per_hour}/hr</span>
                          <span style={{ fontSize: '11px', color: 'var(--c-text3)' }}>{pct}% available</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                        <button
                          onClick={() => {
                            dispatch(selectZone(zone))
                            dispatch(fetchPrediction(zone.id))
                            setSelectedTab('map')
                            if (mapInstance.current) mapInstance.current.flyTo([zone.latitude, zone.longitude], 16)
                          }}
                          className="btn btn-ghost btn-sm">
                          🗺 View
                        </button>
                        <button
                          onClick={() => { dispatch(selectZone(zone)); setShowBooking(true) }}
                          className="btn btn-primary btn-sm">
                          Reserve →
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Side panel */}
        {selected && (
          <div style={{ width: '300px', borderLeft: '1px solid var(--c-border)', background: 'var(--c-bg2)', overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '700', color: 'var(--c-text)' }}>Zone Details</h3>
              <button onClick={() => dispatch(selectZone(null))} style={{ background: 'none', border: 'none', color: 'var(--c-text3)', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>

            <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: '12px', padding: '14px' }}>
              <p style={{ fontWeight: '600', fontSize: '14px', color: 'var(--c-text)', marginBottom: '4px' }}>{selected.name}</p>
              <p style={{ fontSize: '12px', color: 'var(--c-text2)', marginBottom: '12px' }}>📍 {selected.address}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                {[
                  { label: 'Available', value: selected.available_slots || 0, color: '#06d6a0' },
                  { label: 'Total',     value: selected.total_slots,          color: 'var(--c-text)' },
                  { label: 'Price',     value: `₹${selected.price_per_hour}/hr`, color: '#3b82f6' },
                  { label: 'Zone ID',   value: `#${selected.id}`,            color: 'var(--c-text3)' },
                ].map(s => (
                  <div key={s.label} style={{ background: 'var(--c-bg2)', borderRadius: '8px', padding: '10px' }}>
                    <p style={{ fontSize: '10px', color: 'var(--c-text3)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</p>
                    <p style={{ fontSize: '16px', fontWeight: '700', color: s.color, fontFamily: 'var(--font-display)' }}>{s.value}</p>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowBooking(true)}
                className="btn btn-primary"
                style={{ width: '100%' }}>
                {(selected.available_slots || 0) === 0 ? 'Full right now · Reserve later' : '🅿 Reserve'}
              </button>
            </div>

            {/* Traffic prediction */}
            {prediction && (
              <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: '12px', padding: '14px' }}>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: '600', color: 'var(--c-text)', marginBottom: '10px' }}>📈 Traffic Prediction</p>
                <div style={{ background: 'rgba(255,209,102,0.08)', border: '1px solid rgba(255,209,102,0.2)', borderRadius: '8px', padding: '10px', marginBottom: '8px' }}>
                  <p style={{ fontSize: '11px', fontWeight: '600', color: '#ffd166', marginBottom: '4px' }}>🔴 Peak Hours</p>
                  <p style={{ fontSize: '12px', color: 'var(--c-text2)' }}>{prediction.peak_hours?.map(h => `${h}:00`).join(', ') || 'N/A'}</p>
                </div>
                <div style={{ background: 'rgba(6,214,160,0.08)', border: '1px solid rgba(6,214,160,0.2)', borderRadius: '8px', padding: '10px' }}>
                  <p style={{ fontSize: '11px', fontWeight: '600', color: '#06d6a0', marginBottom: '4px' }}>🟢 Best Travel Time</p>
                  <p style={{ fontSize: '12px', color: 'var(--c-text2)' }}>{prediction.best_travel_hours?.map(h => `${h}:00`).join(', ') || 'N/A'}</p>
                </div>
              </div>
            )}

            {/* Slot grid */}
            {selected.slots?.length > 0 && (
              <div>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: '600', color: 'var(--c-text)', marginBottom: '8px' }}>Slot Availability</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  {selected.slots.filter(s => s.is_active).slice(0, 24).map(slot => (
                    <div key={slot.id} style={{ padding: '6px 4px', borderRadius: '6px', background: !slot.is_available_now ? 'rgba(239,35,60,0.1)' : 'rgba(6,214,160,0.1)', border: `1px solid ${!slot.is_available_now ? 'rgba(239,35,60,0.3)' : 'rgba(6,214,160,0.3)'}`, textAlign: 'center', fontSize: '10px', fontWeight: '600', color: !slot.is_available_now ? '#f87171' : '#06d6a0', fontFamily: 'var(--font-mono)' }}>
                      {slot.slot_number}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showBooking && selected && (
        <BookingModal zone={selected} onClose={() => setShowBooking(false)} />
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )
}
