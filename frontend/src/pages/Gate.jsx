import { useCallback, useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import toast from 'react-hot-toast'
import api, { errorMessage } from '../utils/api'
import { fmtDateTime, fmtTime, minutesToText, rupees, STATUS } from '../utils/format'
import QrScanner from '../components/gate/QrScanner'

const box = { background: 'var(--c-bg2)', border: '1px solid var(--c-border)', borderRadius: '12px', padding: '14px' }

function Modal({ title, onClose, children }) {
  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px' }}>
      <div className="card" style={{ width: '100%', maxWidth: '440px', maxHeight: '100%', overflowY: 'auto', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: '700', color: 'var(--c-text)' }}>{title}</h3>
          <button onClick={onClose} className="btn btn-ghost btn-sm" aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function CheckoutModal({ booking, onClose, onDone }) {
  const [quote, setQuote] = useState(null)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    api.get(`/gate/checkout-quote/${booking.id}`)
      .then(r => setQuote(r.data))
      .catch(e => { toast.error(errorMessage(e)); onClose() })
  }, [booking.id])

  const complete = async (method) => {
    setSaving(true)
    try {
      const res = await api.post('/gate/check-out', { booking_id: booking.id, payment_method: method })
      setResult(res.data)
      onDone()
      toast.success(`Checked out · ${rupees(res.data.final_amount)} collected`)
    } catch (e) { toast.error(errorMessage(e)) }
    finally { setSaving(false) }
  }

  const receipt = async () => {
    try {
      const res = await api.get(`/bookings/${result.id}/receipt`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      window.open(url, '_blank')
    } catch { toast.error('Receipt not available') }
  }

  const line = (l, v, strong) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: strong ? '16px' : '13px', fontWeight: strong ? 700 : 500, color: strong ? 'var(--c-text)' : 'var(--c-text2)' }}>
      <span>{l}</span><span>{v}</span>
    </div>
  )

  return (
    <Modal title={`Check out ${booking.vehicle_number}`} onClose={onClose}>
      {!quote && <div className="shimmer" style={{ height: '160px' }} />}
      {quote && !result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ ...box, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {line('Slot', booking.slot_number)}
            {line('Checked in', fmtDateTime(quote.checked_in_at))}
            {line('Parked for', minutesToText(quote.parked_minutes))}
            {line(`Billed (${rupees(booking.price_per_hour)}/hr)`, `${minutesToText(quote.billed_minutes)} · ${rupees(quote.fare)}`)}
            {quote.discount > 0 && line(`Points (${quote.points_used})`, `− ${rupees(quote.discount)}`)}
            <hr className="divider" />
            {line('Collect', rupees(quote.payable), true)}
          </div>

          {quote.payable > 0 && quote.upi_uri && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'inline-block', background: 'white', padding: '12px', borderRadius: '12px' }}>
                <QRCodeSVG value={quote.upi_uri} size={170} />
              </div>
              <p style={{ fontSize: '12px', color: 'var(--c-text3)', marginTop: '6px' }}>Customer scans with any UPI app · pays to {quote.upi_id}</p>
            </div>
          )}
          {quote.payable > 0 && !quote.upi_uri && (
            <p style={{ fontSize: '12px', color: 'var(--c-text3)' }}>Add a UPI ID to this zone to show a payment QR here.</p>
          )}

          {quote.payable > 0 ? (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-accent" disabled={saving} onClick={() => complete('cash')} style={{ flex: 1 }}>💵 Paid in cash</button>
              <button className="btn btn-primary" disabled={saving} onClick={() => complete('upi')} style={{ flex: 1 }}>📱 Paid by UPI</button>
            </div>
          ) : (
            <button className="btn btn-accent" disabled={saving} onClick={() => complete(null)}>Nothing to pay · Check out</button>
          )}
          <p style={{ fontSize: '11px', color: 'var(--c-text3)', textAlign: 'center' }}>Only confirm after the money is received. Amount is recalculated at the moment you confirm.</p>
        </div>
      )}
      {result && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '40px' }}>✅</p>
          <p style={{ color: 'var(--c-text)', fontSize: '15px', fontWeight: 600, margin: '8px 0 4px' }}>{rupees(result.final_amount)} collected</p>
          <p style={{ color: 'var(--c-text2)', fontSize: '13px', marginBottom: '18px' }}>Slot {result.slot_number} is free again.</p>
          <div style={{ display: 'flex', gap: '10px' }}>
            {result.has_receipt && <button className="btn btn-ghost" onClick={receipt} style={{ flex: 1 }}>🧾 Receipt</button>}
            <button className="btn btn-primary" onClick={onClose} style={{ flex: 1 }}>Done</button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function WalkInModal({ zoneId, onClose, onDone }) {
  const [vehicle, setVehicle] = useState('')
  const [hours, setHours] = useState(1)
  const [saving, setSaving] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await api.post('/gate/walk-in', { zone_id: zoneId, vehicle_number: vehicle, expected_hours: Number(hours) })
      toast.success(`${res.data.vehicle_number} parked in slot ${res.data.slot_number}`)
      onDone(); onClose()
    } catch (err) { toast.error(errorMessage(err)) }
    finally { setSaving(false) }
  }
  return (
    <Modal title="Walk-in car" onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label className="label">Vehicle number</label>
          <input className="input" required autoFocus value={vehicle} onChange={e => setVehicle(e.target.value.toUpperCase())} placeholder="MH01AB1234" style={{ fontFamily: 'var(--font-mono)' }} />
        </div>
        <div>
          <label className="label">Expected stay (hours)</label>
          <input className="input" type="number" min="0.5" max="24" step="0.5" value={hours} onChange={e => setHours(e.target.value)} />
          <p style={{ fontSize: '11px', color: 'var(--c-text3)', marginTop: '4px' }}>Used to pick a slot that isn't reserved soon. The customer pays for the actual time.</p>
        </div>
        <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Check in'}</button>
      </form>
    </Modal>
  )
}

export default function Gate() {
  const [zones, setZones] = useState([])
  const [zoneId, setZoneId] = useState(() => Number(localStorage.getItem('tpms_gate_zone')) || null)
  const [overview, setOverview] = useState(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [checkout, setCheckout] = useState(null)
  const [walkIn, setWalkIn] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.get('/zones/manage/mine').then(r => {
      setZones(r.data)
      if (r.data.length && !r.data.some(z => z.id === zoneId)) setZoneId(r.data[0].id)
    }).catch(e => toast.error(errorMessage(e)))
  }, [])

  const refresh = useCallback(() => {
    if (!zoneId) return
    api.get('/gate/overview', { params: { zone_id: zoneId } }).then(r => setOverview(r.data)).catch(() => {})
  }, [zoneId])

  useEffect(() => {
    if (!zoneId) return
    localStorage.setItem('tpms_gate_zone', zoneId)
    refresh()
    const id = setInterval(refresh, 30000)
    return () => clearInterval(id)
  }, [zoneId, refresh])

  const lookup = async (raw) => {
    const value = raw.trim().replace(/[\s-]/g, '').toUpperCase()
    if (!value) return
    setBusy(true)
    try {
      // Booking codes are 10 characters from a fixed alphabet; anything else is treated as a vehicle number
      const isCode = /^[A-HJ-NP-Z2-9]{10}$/.test(value)
      let res
      try {
        res = await api.get('/gate/lookup', { params: isCode ? { code: value } : { vehicle: value } })
      } catch (e) {
        if (isCode && e.response?.status === 404) res = await api.get('/gate/lookup', { params: { vehicle: value } })
        else throw e
      }
      setResults(res.data)
      if (!res.data.length) toast('No active booking found', { icon: '🔍' })
    } catch (e) { toast.error(errorMessage(e)); setResults([]) }
    finally { setBusy(false) }
  }

  const checkIn = async (b) => {
    setBusy(true)
    try {
      const res = await api.post('/gate/check-in', { booking_code: b.booking_code })
      const moved = res.data.slot_id !== b.slot_id
      toast.success(`${res.data.vehicle_number} checked in → slot ${res.data.slot_number}${moved ? ' (reassigned)' : ''}`, { duration: 5000 })
      setResults(null); setQuery(''); refresh()
    } catch (e) { toast.error(errorMessage(e)); refresh() }
    finally { setBusy(false) }
  }

  const actionFor = (b) => b.status === 'reserved'
    ? <button className="btn btn-accent btn-sm" disabled={busy} onClick={() => checkIn(b)}>Check in</button>
    : b.status === 'checked_in'
      ? <button className="btn btn-primary btn-sm" onClick={() => setCheckout(b)}>Check out</button>
      : null

  const bookingRow = (b, sub) => (
    <div key={b.id} style={{ ...box, display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: '180px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--c-text)' }}>{b.vehicle_number}</span>
          <span className={`badge ${STATUS[b.status]?.badge}`}>{STATUS[b.status]?.label}</span>
          {b.is_walk_in && <span className="badge badge-yellow">Walk-in</span>}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--c-text3)', marginTop: '4px' }}>
          Slot {b.slot_number} · {b.customer_name || 'Walk-in'} · {sub}
        </div>
      </div>
      {actionFor(b)}
    </div>
  )

  if (zones.length === 0) {
    return (
      <div className="page-wrap fade-in">
        <div className="card" style={{ padding: '50px', textAlign: 'center' }}>
          <p style={{ fontSize: '40px', marginBottom: '12px' }}>🚧</p>
          <p style={{ color: 'var(--c-text2)' }}>You don't manage any parking zones yet.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-wrap fade-in">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 className="section-header" style={{ fontSize: '26px' }}>🚧 Gate</h1>
          <p className="section-sub">Check cars in and out, and record payments</p>
        </div>
        <select className="input" style={{ width: 'auto', minWidth: '220px' }} value={zoneId || ''} onChange={e => { setZoneId(Number(e.target.value)); setResults(null) }}>
          {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>
      </div>

      {overview && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          {[
            ['Free now', overview.free_now, '#06d6a0'],
            ['Parked', overview.parked.length, '#60a5fa'],
            ['Arriving (12h)', overview.upcoming.length, '#ffd166'],
          ].map(([l, v, c]) => (
            <div key={l} style={{ ...box }}>
              <div className="stat-num" style={{ color: c }}>{v}</div>
              <div className="stat-label">{l}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
        <form onSubmit={e => { e.preventDefault(); lookup(query) }} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <input className="input" style={{ flex: 1, minWidth: '200px', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}
            placeholder="Booking code or vehicle number" value={query} onChange={e => setQuery(e.target.value.toUpperCase())} />
          <button className="btn btn-primary" disabled={busy}>Find</button>
          <button type="button" className="btn btn-outline" onClick={() => setScanning(true)}>📷 Scan QR</button>
          <button type="button" className="btn btn-accent" onClick={() => setWalkIn(true)}>+ Walk-in</button>
        </form>
        {results && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '14px' }}>
            {results.map(b => bookingRow(b, b.zone_id !== zoneId ? `at ${b.zone_name}` : `booked ${fmtDateTime(b.start_time)}`))}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 600, color: '#60a5fa', marginBottom: '10px' }}>Parked now</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {overview?.parked.length === 0 && <p style={{ fontSize: '13px', color: 'var(--c-text3)' }}>No cars parked.</p>}
            {overview?.parked.map(b => bookingRow(b, `in since ${fmtTime(b.checked_in_at)}`))}
          </div>
        </div>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 600, color: '#ffd166', marginBottom: '10px' }}>Arriving soon</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {overview?.upcoming.length === 0 && <p style={{ fontSize: '13px', color: 'var(--c-text3)' }}>No reservations in the next 12 hours.</p>}
            {overview?.upcoming.map(b => bookingRow(b, `arrives ${fmtTime(b.start_time)}`))}
          </div>
        </div>
      </div>

      {scanning && <QrScanner onClose={() => setScanning(false)} onError={toast.error}
        onScan={(code) => { setScanning(false); setQuery(code); lookup(code) }} />}
      {checkout && <CheckoutModal booking={checkout} onClose={() => setCheckout(null)} onDone={() => { refresh(); setResults(null) }} />}
      {walkIn && <WalkInModal zoneId={zoneId} onClose={() => setWalkIn(false)} onDone={refresh} />}
    </div>
  )
}
