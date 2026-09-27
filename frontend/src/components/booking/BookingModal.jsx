import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import toast from 'react-hot-toast'
import api, { errorMessage } from '../../utils/api'
import { fetchZones } from '../../store/slices/zonesSlice'
import { speakBookingConfirm } from '../../utils/voice'
import { addNotification } from '../../pages/NotificationsPage'
import { fmtDateTime, localInputToISO, minutesToText, rupees, toLocalInput } from '../../utils/format'

const STEPS = ['Time & Vehicle', 'Choose Slot', 'Confirm']
const POINT_VALUE = 0.5
const GRACE_MINUTES = 15

export default function BookingModal({ zone, onClose }) {
  const dispatch = useDispatch()
  const user = useSelector(s => s.auth.user)

  const now = new Date()
  now.setSeconds(0, 0)
  const [step, setStep]       = useState(0)
  const [loading, setLoading] = useState(false)
  const [avail, setAvail]     = useState(null)   // { slots, estimated_amount, billed_minutes }
  const [booking, setBooking] = useState(null)
  const [form, setForm] = useState({
    start: toLocalInput(new Date(now.getTime() + 5 * 60000)),
    end:   toLocalInput(new Date(now.getTime() + 125 * 60000)),
    vehicle: '',
    slot: null,
    usePoints: false,
  })

  const points = user?.points || 0
  const pointsToRedeem = form.usePoints ? points : 0
  const estimate = avail?.estimated_amount || 0
  const discount = Math.min(pointsToRedeem * POINT_VALUE, estimate)

  const checkAvailability = async () => {
    const start = new Date(form.start), end = new Date(form.end)
    if (!(end > start)) return toast.error('End time must be after start time')
    if (!form.vehicle.trim()) return toast.error('Enter your vehicle number')
    setLoading(true)
    try {
      const res = await api.get(`/zones/${zone.id}/availability`, {
        params: { start: localInputToISO(form.start), end: localInputToISO(form.end) },
      })
      setAvail(res.data)
      setForm(f => ({ ...f, slot: res.data.slots[0] || null }))
      setStep(1)
    } catch (e) { toast.error(errorMessage(e)) }
    finally { setLoading(false) }
  }

  const reserve = async () => {
    setLoading(true)
    try {
      const res = await api.post('/bookings/', {
        zone_id: zone.id,
        slot_id: form.slot.id,
        start_time: localInputToISO(form.start),
        end_time: localInputToISO(form.end),
        vehicle_number: form.vehicle,
        points_to_redeem: pointsToRedeem,
      })
      setBooking(res.data)
      speakBookingConfirm(zone.name, res.data.estimated_amount, user?.preferred_lang || 'en')
      addNotification('booking', '✅ Parking reserved',
        `Slot ${res.data.slot_number} at ${zone.name}, ${fmtDateTime(res.data.start_time)}. Show code ${res.data.booking_code} at the gate.`, '/bookings')
      dispatch(fetchZones())
      setStep(3)
    } catch (e) {
      toast.error(errorMessage(e, 'Booking failed. Please try again.'))
      if (e.response?.status === 409) setStep(0)    // slot was taken meanwhile: pick again
    } finally { setLoading(false) }
  }

  const header = (
    <div style={{ padding: '20px 24px 0', borderBottom: '1px solid var(--c-border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', color: 'var(--c-text)' }}>Reserve Parking</h2>
          <p style={{ fontSize: '13px', color: 'var(--c-text2)', marginTop: '2px' }}>🏢 {zone.name} · {rupees(zone.price_per_hour)}/hr</p>
        </div>
        <button onClick={onClose} aria-label="Close" style={{ background: 'var(--c-bg3)', border: '1px solid var(--c-border)', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', color: 'var(--c-text2)', fontSize: '16px' }}>✕</button>
      </div>
      {step < 3 && (
        <div style={{ display: 'flex' }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ flex: 1, textAlign: 'center', padding: '8px 4px', borderBottom: `2px solid ${i === step ? 'var(--c-primary)' : 'transparent'}` }}>
              <span style={{ fontSize: '11px', fontWeight: '600', color: i === step ? 'var(--c-primary-light)' : i < step ? 'var(--c-accent)' : 'var(--c-text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {i < step ? '✓ ' : `${i + 1}. `}{s}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const row = (label, value, strong) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
      <span style={{ fontSize: '12px', color: 'var(--c-text2)' }}>{label}</span>
      <span style={{ fontSize: strong ? '18px' : '13px', fontWeight: strong ? '800' : '600', color: strong ? '#06d6a0' : 'var(--c-text)', textAlign: 'right' }}>{value}</span>
    </div>
  )

  let body
  if (user && !user.email_verified) {
    body = (
      <div style={{ textAlign: 'center', padding: '12px 0' }}>
        <p style={{ fontSize: '32px', marginBottom: '10px' }}>✉️</p>
        <p style={{ color: 'var(--c-text)', fontSize: '14px', marginBottom: '6px' }}>Verify your email to book parking</p>
        <p style={{ color: 'var(--c-text2)', fontSize: '13px' }}>Use the "Resend email" button at the top of the page, then open the link we send you.</p>
      </div>
    )
  } else if (step === 0) {
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label className="label">Arrive at</label>
            <input className="input" type="datetime-local" value={form.start} min={toLocalInput(now)}
              onChange={e => setForm(f => ({ ...f, start: e.target.value }))} />
          </div>
          <div>
            <label className="label">Leave by</label>
            <input className="input" type="datetime-local" value={form.end} min={form.start}
              onChange={e => setForm(f => ({ ...f, end: e.target.value }))} />
          </div>
        </div>
        <div>
          <label className="label">Vehicle number</label>
          <input className="input" placeholder="e.g. MH01AB1234" value={form.vehicle} maxLength={14}
            onChange={e => setForm(f => ({ ...f, vehicle: e.target.value.toUpperCase() }))}
            style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }} />
        </div>
        <p style={{ fontSize: '12px', color: 'var(--c-text3)', lineHeight: 1.5 }}>
          You pay at the gate for the time you actually park. Please arrive within {GRACE_MINUTES} minutes of your start time, or the slot is released.
        </p>
        <button className="btn btn-primary" onClick={checkAvailability} disabled={loading}>
          {loading ? 'Checking...' : 'Find free slots →'}
        </button>
      </div>
    )
  } else if (step === 1) {
    body = (
      <div>
        <p style={{ fontSize: '13px', color: 'var(--c-text2)', marginBottom: '14px' }}>
          {avail.slots.length} slot(s) free for the whole time you chose
        </p>
        {avail.slots.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px', background: 'rgba(239,35,60,0.05)', borderRadius: '12px', border: '1px solid rgba(239,35,60,0.2)' }}>
            <p style={{ color: '#f87171', fontWeight: '600' }}>No slots free for that time</p>
            <p style={{ fontSize: '12px', color: 'var(--c-text3)', marginTop: '4px' }}>Try a different time or another zone</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
            {avail.slots.map(slot => {
              const sel = form.slot?.id === slot.id
              return (
                <button key={slot.id} onClick={() => setForm(f => ({ ...f, slot }))}
                  style={{ padding: '12px 6px', borderRadius: '10px', border: `2px solid ${sel ? 'var(--c-primary)' : 'var(--c-border)'}`, background: sel ? 'rgba(59,130,246,0.15)' : 'var(--c-bg2)', color: sel ? '#60a5fa' : 'var(--c-text2)', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
                  {slot.slot_number}
                </button>
              )
            })}
          </div>
        )}
        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
          <button className="btn btn-ghost" onClick={() => setStep(0)} style={{ flex: 1 }}>← Back</button>
          <button className="btn btn-primary" onClick={() => setStep(2)} disabled={!form.slot} style={{ flex: 2 }}>Continue →</button>
        </div>
      </div>
    )
  } else if (step === 2) {
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ background: 'var(--c-bg2)', border: '1px solid var(--c-border)', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {row('🏢 Zone', zone.name)}
          {row('🅿 Slot', form.slot.slot_number)}
          {row('🚗 Vehicle', form.vehicle)}
          {row('⏱ Arrive', fmtDateTime(localInputToISO(form.start)))}
          {row('⏱ Leave', fmtDateTime(localInputToISO(form.end)))}
          {row('⏳ Billed time', minutesToText(avail.billed_minutes))}
          <hr className="divider" />
          {row('Estimated fee', rupees(estimate))}
          {discount > 0 && row('Points discount', `− ${rupees(discount)}`)}
          {row('Estimated total', rupees(estimate - discount), true)}
        </div>
        {points > 0 && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--c-text2)', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.usePoints} onChange={e => setForm(f => ({ ...f, usePoints: e.target.checked }))} />
            Use my {points} reward points (worth up to {rupees(points * POINT_VALUE)})
          </label>
        )}
        <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: '10px', padding: '10px 14px', fontSize: '12px', color: 'var(--c-text2)', lineHeight: 1.5 }}>
          💵 Nothing is charged now. Pay at the gate in cash or UPI. The final amount depends on how long you actually park.
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-ghost" onClick={() => setStep(1)} disabled={loading} style={{ flex: 1 }}>← Back</button>
          <button className="btn btn-accent btn-lg" onClick={reserve} disabled={loading} style={{ flex: 2 }}>
            {loading ? 'Reserving...' : '✅ Reserve slot'}
          </button>
        </div>
      </div>
    )
  } else {
    body = (
      <div style={{ textAlign: 'center' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '800', color: '#06d6a0', marginBottom: '6px' }}>Slot reserved!</h3>
        <p style={{ fontSize: '13px', color: 'var(--c-text2)', marginBottom: '16px' }}>Show this code at the gate when you arrive</p>
        <div style={{ display: 'inline-block', background: 'white', padding: '14px', borderRadius: '14px', marginBottom: '10px' }}>
          <QRCodeSVG value={booking.booking_code} size={170} />
        </div>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: '700', letterSpacing: '0.15em', color: 'var(--c-text)', marginBottom: '16px' }}>{booking.booking_code}</p>
        <div style={{ background: 'rgba(6,214,160,0.08)', border: '1px solid rgba(6,214,160,0.2)', borderRadius: '14px', padding: '14px', marginBottom: '18px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {row('Slot', booking.slot_number)}
          {row('Arrive', fmtDateTime(booking.start_time))}
          {row('Estimated fee', rupees(booking.estimated_amount))}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>Close</button>
          <Link to="/bookings" className="btn btn-primary" style={{ flex: 2 }}>My bookings →</Link>
        </div>
      </div>
    )
  }

  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px' }}
      onClick={e => { if (e.target === e.currentTarget && step !== 3) onClose() }}>
      <div style={{ width: '100%', maxWidth: '480px', maxHeight: '100%', overflowY: 'auto', background: 'var(--c-surface)', border: '1px solid var(--c-border2)', borderRadius: '20px', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
        {header}
        <div style={{ padding: '24px' }}>{body}</div>
      </div>
    </div>
  )
}
