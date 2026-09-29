import { useCallback, useEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import api, { errorMessage } from '../utils/api'
import { rupees } from '../utils/format'
import L, { createMap, MUMBAI } from '../utils/leaflet'
import { ZONE_EVENT } from '../components/common/LiveConnection'

const UPI_RE = /^[A-Za-z0-9.\-_]{2,256}@[A-Za-z]{2,64}$/

function Modal({ title, onClose, children, wide }) {
  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px' }}>
      <div className="card" style={{ width: '100%', maxWidth: wide ? '720px' : '460px', maxHeight: '100%', overflowY: 'auto', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: 700, color: 'var(--c-text)' }}>{title}</h3>
          <button onClick={onClose} className="btn btn-ghost btn-sm" aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function LocationPicker({ value, onChange }) {
  const { t } = useTranslation()
  const el = useRef(null)
  const map = useRef(null)
  const marker = useRef(null)

  const place = (latlng) => {
    if (!marker.current) marker.current = L.marker(latlng, { draggable: true, icon: L.divIcon({ className: '', html: '<div style="font-size:28px;transform:translate(-8px,-26px)">📍</div>' }) })
      .on('dragend', e => onChange([e.target.getLatLng().lat, e.target.getLatLng().lng])).addTo(map.current)
    else marker.current.setLatLng(latlng)
  }

  useEffect(() => {
    map.current = createMap(el.current, { center: value || MUMBAI, zoom: value ? 16 : 12 })
    if (value) place(value)
    map.current.on('click', e => { place(e.latlng); onChange([e.latlng.lat, e.latlng.lng]) })
    return () => map.current.remove()
  }, [])

  const useMine = () => navigator.geolocation?.getCurrentPosition(pos => {
    const ll = [pos.coords.latitude, pos.coords.longitude]
    place(ll); onChange(ll); map.current.setView(ll, 17)
  }, () => toast.error(t('map.geo_denied', 'Could not get your location. Check the browser permission.')))

  return (
    <div>
      <div ref={el} style={{ height: '240px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--c-border)' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', gap: '8px' }}>
        <span style={{ fontSize: '11px', color: 'var(--c-text3)', fontFamily: 'var(--font-mono)' }}>
          {value ? `${value[0].toFixed(5)}, ${value[1].toFixed(5)}` : t('zones.click_map', 'Click the map at the parking entrance')}
        </span>
        <button type="button" onClick={useMine} className="btn btn-ghost btn-sm">📍 {t('zones.use_location', 'Use my location')}</button>
      </div>
    </div>
  )
}

function ZoneForm({ zone, onClose, onSaved }) {
  const { t } = useTranslation()
  const [form, setForm] = useState({
    name: zone?.name || '', address: zone?.address || '',
    price_per_hour: zone?.price_per_hour ?? 20, total_slots: 20,
    two_wheeler_price_per_hour: zone?.two_wheeler_price_per_hour ?? '', two_wheeler_slots: 0,
    upi_id: zone?.upi_id || '', upi_name: zone?.upi_name || '',
  })
  const [loc, setLoc] = useState(zone ? [zone.latitude, zone.longitude] : null)
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!loc) return toast.error(t('zones.need_location', 'Pick the location on the map'))
    if (form.upi_id && !UPI_RE.test(form.upi_id.trim())) return toast.error(t('zones.bad_upi', 'UPI ID looks wrong, e.g. parking@okicici'))
    const body = {
      name: form.name.trim(), address: form.address.trim(), latitude: loc[0], longitude: loc[1],
      price_per_hour: Number(form.price_per_hour),
      two_wheeler_price_per_hour: form.two_wheeler_price_per_hour === '' ? null : Number(form.two_wheeler_price_per_hour),
      upi_id: form.upi_id.trim() || null, upi_name: form.upi_name.trim() || null,
    }
    setSaving(true)
    try {
      if (zone) await api.patch(`/zones/${zone.id}`, body)
      else await api.post('/zones/', { ...body, total_slots: Number(form.total_slots), two_wheeler_slots: Number(form.two_wheeler_slots) })
      toast.success(zone ? t('zones.saved', 'Zone updated') : t('zones.created', 'Zone created'))
      onSaved(); onClose()
    } catch (err) { toast.error(errorMessage(err)) }
    finally { setSaving(false) }
  }

  return (
    <Modal title={zone ? t('zones.edit', 'Edit zone') : t('zones.add', 'Add parking zone')} onClose={onClose} wide>
      <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div><label className="label">{t('zones.name', 'Zone name')}</label><input className="input" required maxLength={100} value={form.name} onChange={set('name')} /></div>
          <div><label className="label">{t('zones.address', 'Address')}</label><input className="input" required maxLength={200} value={form.address} onChange={set('address')} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div><label className="label">🚗 {t('zones.car_price', 'Car rate / hour (₹)')}</label><input className="input" type="number" min="1" step="0.5" required value={form.price_per_hour} onChange={set('price_per_hour')} /></div>
            {!zone && <div><label className="label">🚗 {t('zones.car_slots', 'Car slots')}</label><input className="input" type="number" min="0" max="2000" required value={form.total_slots} onChange={set('total_slots')} /></div>}
            <div><label className="label">🏍 {t('zones.bike_price', 'Two-wheeler rate / hour (₹)')}</label><input className="input" type="number" min="1" step="0.5" placeholder={t('zones.bike_price_ph', 'Same as car')} value={form.two_wheeler_price_per_hour} onChange={set('two_wheeler_price_per_hour')} /></div>
            {!zone && <div><label className="label">🏍 {t('zones.bike_slots', 'Two-wheeler slots')}</label><input className="input" type="number" min="0" max="2000" required value={form.two_wheeler_slots} onChange={set('two_wheeler_slots')} /></div>}
          </div>
          <div><label className="label">{t('zones.upi_id', 'UPI ID for payments')}</label><input className="input" placeholder="parking@okicici" value={form.upi_id} onChange={set('upi_id')} /></div>
          <div><label className="label">{t('zones.upi_name', 'Payee name (shown in UPI apps)')}</label><input className="input" maxLength={100} value={form.upi_name} onChange={set('upi_name')} /></div>
          <p style={{ fontSize: '11px', color: 'var(--c-text3)', lineHeight: 1.5 }}>{t('zones.upi_hint', 'With a UPI ID, the Gate screen shows a QR code for the exact amount. Customers pay you directly.')}</p>
        </div>
        <div>
          <label className="label">{t('zones.location', 'Location')}</label>
          <LocationPicker value={loc} onChange={setLoc} />
        </div>
        <button className="btn btn-primary" disabled={saving} style={{ gridColumn: '1 / -1' }}>{saving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}</button>
      </form>
    </Modal>
  )
}

function SlotManager({ zone, onClose, onChanged }) {
  const { t } = useTranslation()
  const [count, setCount] = useState(5)
  const [addType, setAddType] = useState('four_wheeler')
  const [busy, setBusy] = useState(false)

  const toggle = async (slot) => {
    setBusy(true)
    try { await api.patch(`/zones/${zone.id}/slots/${slot.id}`, { is_active: !slot.is_active }); onChanged() }
    catch (e) { toast.error(errorMessage(e)) }
    finally { setBusy(false) }
  }
  const clearOccupied = async (slot) => {
    if (!confirm(t('zones.clear_confirm', 'Mark {{slot}} as empty? Only do this if no car is parked there.', { slot: slot.slot_number }))) return
    try { await api.patch(`/zones/${zone.id}/slots/${slot.id}`, { is_occupied: false }); onChanged() }
    catch (e) { toast.error(errorMessage(e)) }
  }
  const add = async () => {
    setBusy(true)
    try { await api.post(`/zones/${zone.id}/slots`, { count: Number(count), vehicle_type: addType }); toast.success(t('zones.slots_added', 'Slots added')); onChanged() }
    catch (e) { toast.error(errorMessage(e)) }
    finally { setBusy(false) }
  }

  return (
    <Modal title={`${t('zones.manage_slots', 'Slots')} · ${zone.name}`} onClose={onClose} wide>
      <p style={{ fontSize: '12px', color: 'var(--c-text2)', marginBottom: '12px' }}>
        {t('zones.slots_hint', 'Tap a slot to take it out of use (e.g. repairs) or bring it back. Disabled slots cannot be booked.')}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: '6px', maxHeight: '320px', overflowY: 'auto', marginBottom: '16px' }}>
        {zone.slots.map(s => {
          const color = !s.is_active ? '#64748b' : s.is_occupied ? '#f87171' : !s.is_available_now ? '#ffd166' : '#06d6a0'
          return (
            <div key={s.id} style={{ position: 'relative' }}>
              <button disabled={busy} onClick={() => toggle(s)} title={s.is_active ? t('zones.disable', 'Disable') : t('zones.enable', 'Enable')}
                style={{ width: '100%', padding: '10px 4px', borderRadius: '8px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700,
                  background: `${color}18`, border: `1px solid ${color}55`, color, textDecoration: s.is_active ? 'none' : 'line-through' }}>
                {s.slot_number}
              </button>
              {s.is_occupied && s.is_active && (
                <button onClick={() => clearOccupied(s)} aria-label="Mark empty" title={t('zones.mark_empty', 'Mark empty')}
                  style={{ position: 'absolute', top: '-6px', right: '-6px', width: '18px', height: '18px', borderRadius: '50%', border: 'none', background: '#334155', color: '#fff', fontSize: '10px', cursor: 'pointer' }}>×</button>
              )}
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '11px', color: 'var(--c-text3)', marginBottom: '16px' }}>
        <span>🟢 {t('zones.free', 'Free')}</span><span>🟡 {t('zones.reserved', 'Reserved now')}</span><span>🔴 {t('zones.parked', 'Parked')}</span><span>⚪ {t('zones.disabled', 'Disabled')}</span>
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input className="input" type="number" min="1" max="500" value={count} onChange={e => setCount(e.target.value)} style={{ width: '90px' }} />
        <select className="input" style={{ width: 'auto' }} value={addType} onChange={e => setAddType(e.target.value)}>
          <option value="four_wheeler">🚗 {t('vehicle.four_wheeler', 'Car')}</option>
          <option value="two_wheeler">🏍 {t('vehicle.two_wheeler', 'Two-wheeler')}</option>
        </select>
        <button className="btn btn-primary" disabled={busy} onClick={add}>+ {t('zones.add_slots', 'Add slots')}</button>
      </div>
    </Modal>
  )
}

export default function Zones() {
  const { t } = useTranslation()
  const user = useSelector(s => s.auth.user)
  const [zones, setZones] = useState([])
  const [occ, setOcc] = useState({})
  const [editing, setEditing] = useState(null)     // zone, or {} for a new one
  const [slotsFor, setSlotsFor] = useState(null)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(() => {
    api.get('/zones/manage/mine').then(r => { setZones(r.data); setLoaded(true) }).catch(e => toast.error(errorMessage(e)))
    api.get('/vendors/occupancy').then(r => setOcc(Object.fromEntries(r.data.map(o => [o.zone_id, o])))).catch(() => {})
  }, [])

  useEffect(() => {
    load()
    const onChange = () => load()
    window.addEventListener(ZONE_EVENT, onChange)
    return () => window.removeEventListener(ZONE_EVENT, onChange)
  }, [load])

  const setActive = async (zone, is_active) => {
    if (!is_active && !confirm(t('zones.deactivate_confirm', 'Hide this zone from the map? Existing bookings stay valid.'))) return
    try { await api.patch(`/zones/${zone.id}`, { is_active }); load() }
    catch (e) { toast.error(errorMessage(e)) }
  }

  const slotZone = slotsFor && zones.find(z => z.id === slotsFor)

  return (
    <div className="page-wrap fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="section-header" style={{ fontSize: '26px' }}>🅿 {t('zones.title', 'My parking zones')}</h1>
          <p className="section-sub">{t('zones.subtitle', 'Live occupancy, prices, payment details and slots')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing({})}>+ {t('zones.add', 'Add parking zone')}</button>
      </div>

      {loaded && zones.length === 0 && (
        <div className="card" style={{ padding: '50px', textAlign: 'center' }}>
          <p style={{ fontSize: '40px', marginBottom: '10px' }}>🅿️</p>
          <p style={{ color: 'var(--c-text2)' }}>{t('zones.none', 'No zones yet. Add your first parking zone.')}</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
        {zones.map(z => {
          const o = occ[z.id] || { total: z.total_slots, parked: 0, reserved: 0, free: z.available_slots, occupancy_pct: 0 }
          const seg = (n, c) => o.total ? <div style={{ width: `${(n / o.total) * 100}%`, background: c }} /> : null
          return (
            <div key={z.id} className="card" style={{ padding: '18px', opacity: z.is_active ? 1 : 0.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--c-text)' }}>{z.name}</span>
                {!z.is_active && <span className="badge badge-red">{t('zones.hidden', 'Hidden')}</span>}
              </div>
              <p style={{ fontSize: '12px', color: 'var(--c-text3)', marginBottom: '12px' }}>{z.address}{user?.role === 'admin' && z.vendor_id ? ` · vendor #${z.vendor_id}` : ''}</p>

              <div style={{ display: 'flex', height: '10px', borderRadius: '5px', overflow: 'hidden', background: 'rgba(6,214,160,0.25)', marginBottom: '8px' }}>
                {seg(o.parked, '#f87171')}{seg(o.reserved, '#ffd166')}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--c-text2)', marginBottom: '14px' }}>
                <span>🔴 {o.parked} {t('zones.parked', 'parked')}</span>
                <span>🟡 {o.reserved} {t('zones.reserved_short', 'reserved')}</span>
                <span>🟢 {o.free} {t('zones.free', 'free')}</span>
                <strong style={{ color: 'var(--c-text)' }}>{o.occupancy_pct}%</strong>
              </div>

              <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--c-text2)', marginBottom: '14px', flexWrap: 'wrap' }}>
                <span>🚗 {z.slots_by_type?.four_wheeler || 0} · {rupees(z.price_per_hour)}/hr</span>
                {(z.slots_by_type?.two_wheeler || 0) > 0 && <span>🏍 {z.slots_by_type.two_wheeler} · {rupees(z.two_wheeler_price_per_hour || z.price_per_hour)}/hr</span>}
                <span>{z.upi_id ? `UPI: ${z.upi_id}` : <span style={{ color: '#ffd166' }}>{t('zones.no_upi', 'No UPI ID (cash only)')}</span>}</span>
                {z.avg_rating && <span style={{ color: '#ffd166' }}>★ {z.avg_rating} ({z.rating_count})</span>}
              </div>

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(z)}>✏️ {t('common.edit', 'Edit')}</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setSlotsFor(z.id)}>▦ {t('zones.manage_slots', 'Slots')}</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setActive(z, !z.is_active)}>
                  {z.is_active ? `🙈 ${t('zones.hide', 'Hide')}` : `👁 ${t('zones.show', 'Show')}`}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {editing && <ZoneForm zone={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={load} />}
      {slotZone && <SlotManager zone={slotZone} onClose={() => setSlotsFor(null)} onChanged={load} />}
    </div>
  )
}
