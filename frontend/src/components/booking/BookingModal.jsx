import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import toast from 'react-hot-toast'
import api, { errorMessage } from '../../utils/api'
import { fetchZones } from '../../store/slices/zonesSlice'
import { speakBookingConfirm } from '../../utils/voice'
import { fmtDateTime, localInputToISO, minutesToText, rupees, toLocalInput } from '../../utils/format'

const POINT_VALUE = 0.5
const GRACE_MINUTES = 15

export default function BookingModal({ zone, onClose }) {
  const dispatch = useDispatch()
  const user = useSelector(s => s.auth.user)
  const { t } = useTranslation()
  const STEPS = [t('booking.step_time', 'Time & vehicle'), t('booking.step_slot', 'Choose slot'), t('booking.step_confirm', 'Confirm')]

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
    if (!(end > start)) return toast.error(t('booking.err_end', 'End time must be after start time'))
    if (!form.vehicle.trim()) return toast.error(t('booking.err_vehicle', 'Enter your vehicle number'))
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
      dispatch(fetchZones())
      setStep(3)
    } catch (e) {
      toast.error(errorMessage(e, t('booking.failed', 'Booking failed. Please try again.')))
      if (e.response?.status === 409) setStep(0)    // slot was taken meanwhile: pick again
    } finally { setLoading(false) }
  }

  const header = (
    <div style={{ padding: '20px 24px 0', borderBottom: '1px solid var(--c-border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', color: 'var(--c-text)' }}>{t('booking.title', 'Reserve parking')}</h2>
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
        <p style={{ color: 'var(--c-text)', fontSize: '14px', marginBottom: '6px' }}>{t('booking.verify_title', 'Verify your email to book parking')}</p>
        <p style={{ color: 'var(--c-text2)', fontSize: '13px' }}>{t('booking.verify_body', 'Use the "Resend email" button at the top of the page, then open the link we send you.')}</p>
      </div>
    )
  } else if (step === 0) {
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label className="label">{t('booking.arrive', 'Arrive at')}</label>
            <input className="input" type="datetime-local" value={form.start} min={toLocalInput(now)}
              onChange={e => setForm(f => ({ ...f, start: e.target.value }))} />
          </div>
          <div>
            <label className="label">{t('booking.leave', 'Leave by')}</label>
            <input className="input" type="datetime-local" value={form.end} min={form.start}
              onChange={e => setForm(f => ({ ...f, end: e.target.value }))} />
          </div>
        </div>
        <div>
          <label className="label">{t('booking.vehicle', 'Vehicle number')}</label>
          <input className="input" placeholder={t('booking.vehicle_ph', 'e.g. MH01AB1234')} value={form.vehicle} maxLength={14}
            onChange={e => setForm(f => ({ ...f, vehicle: e.target.value.toUpperCase() }))}
            style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }} />
        </div>
        <p style={{ fontSize: '12px', color: 'var(--c-text3)', lineHeight: 1.5 }}>
          {t('booking.rules', 'You pay at the gate for the time you actually park. Please arrive within {{n}} minutes of your start time, or the slot is released.', { n: GRACE_MINUTES })}
        </p>
        <button className="btn btn-primary" onClick={checkAvailability} disabled={loading}>
          {loading ? t('booking.checking', 'Checking...') : t('booking.find_slots', 'Find free slots →')}
        </button>
      </div>
    )
  } else if (step === 1) {
    body = (
      <div>
        <p style={{ fontSize: '13px', color: 'var(--c-text2)', marginBottom: '14px' }}>
          {t('booking.slots_free', '{{n}} slot(s) free for the whole time you chose', { n: avail.slots.length })}
        </p>
        {avail.slots.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px', background: 'rgba(239,35,60,0.05)', borderRadius: '12px', border: '1px solid rgba(239,35,60,0.2)' }}>
            <p style={{ color: '#f87171', fontWeight: '600' }}>{t('booking.no_slots', 'No slots free for that time')}</p>
            <p style={{ fontSize: '12px', color: 'var(--c-text3)', marginTop: '4px' }}>{t('booking.no_slots_hint', 'Try a different time or another zone')}</p>
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
          <button className="btn btn-ghost" onClick={() => setStep(0)} style={{ flex: 1 }}>{t('common.back', '← Back')}</button>
          <button className="btn btn-primary" onClick={() => setStep(2)} disabled={!form.slot} style={{ flex: 2 }}>{t('common.continue', 'Continue →')}</button>
        </div>
      </div>
    )
  } else if (step === 2) {
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ background: 'var(--c-bg2)', border: '1px solid var(--c-border)', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {row(`🏢 ${t('booking.zone', 'Zone')}`, zone.name)}
          {row(`🅿 ${t('booking.slot', 'Slot')}`, form.slot.slot_number)}
          {row(`🚗 ${t('booking.vehicle_short', 'Vehicle')}`, form.vehicle)}
          {row(`⏱ ${t('booking.arrive_short', 'Arrive')}`, fmtDateTime(localInputToISO(form.start)))}
          {row(`⏱ ${t('booking.leave_short', 'Leave')}`, fmtDateTime(localInputToISO(form.end)))}
          {row(`⏳ ${t('booking.billed_time', 'Billed time')}`, minutesToText(avail.billed_minutes))}
          <hr className="divider" />
          {row(t('booking.est_fee', 'Estimated fee'), rupees(estimate))}
          {discount > 0 && row(t('booking.points_discount', 'Points discount'), `− ${rupees(discount)}`)}
          {row(t('booking.est_total', 'Estimated total'), rupees(estimate - discount), true)}
        </div>
        {points > 0 && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--c-text2)', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.usePoints} onChange={e => setForm(f => ({ ...f, usePoints: e.target.checked }))} />
            {t('booking.use_points', 'Use my {{points}} reward points (worth up to {{value}})', { points, value: rupees(points * POINT_VALUE) })}
          </label>
        )}
        <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: '10px', padding: '10px 14px', fontSize: '12px', color: 'var(--c-text2)', lineHeight: 1.5 }}>
          💵 {t('booking.pay_note', 'Nothing is charged now. Pay at the gate in cash or UPI. The final amount depends on how long you actually park.')}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-ghost" onClick={() => setStep(1)} disabled={loading} style={{ flex: 1 }}>{t('common.back', '← Back')}</button>
          <button className="btn btn-accent btn-lg" onClick={reserve} disabled={loading} style={{ flex: 2 }}>
            {loading ? t('booking.reserving', 'Reserving...') : `✅ ${t('booking.reserve', 'Reserve slot')}`}
          </button>
        </div>
      </div>
    )
  } else {
    body = (
      <div style={{ textAlign: 'center' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '800', color: '#06d6a0', marginBottom: '6px' }}>{t('booking.reserved', 'Slot reserved!')}</h3>
        <p style={{ fontSize: '13px', color: 'var(--c-text2)', marginBottom: '16px' }}>{t('booking.show_code', 'Show this code at the gate when you arrive')}</p>
        <div style={{ display: 'inline-block', background: 'white', padding: '14px', borderRadius: '14px', marginBottom: '10px' }}>
          <QRCodeSVG value={booking.booking_code} size={170} />
        </div>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: '700', letterSpacing: '0.15em', color: 'var(--c-text)', marginBottom: '16px' }}>{booking.booking_code}</p>
        <div style={{ background: 'rgba(6,214,160,0.08)', border: '1px solid rgba(6,214,160,0.2)', borderRadius: '14px', padding: '14px', marginBottom: '18px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {row(t('booking.slot', 'Slot'), booking.slot_number)}
          {row(t('booking.arrive_short', 'Arrive'), fmtDateTime(booking.start_time))}
          {row(t('booking.est_fee', 'Estimated fee'), rupees(booking.estimated_amount))}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>{t('common.close', 'Close')}</button>
          <Link to="/bookings" className="btn btn-primary" style={{ flex: 2 }}>{t('booking.my_bookings', 'My bookings →')}</Link>
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
