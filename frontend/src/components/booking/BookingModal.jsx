import { useState } from 'react'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import api from '../../utils/api'
import { speakBookingConfirm } from '../../utils/voice'
import { addNotification } from '../../pages/NotificationsPage'

const STEPS = ['Select Slot', 'Time & Vehicle', 'Payment', 'Confirmed']

export default function BookingModal({ zone, onClose }) {
  const user = useSelector(s => s.auth.user)
  const availableSlots = zone.slots?.filter(s => !s.is_occupied) || []

  const now = new Date()
  const pad = n => String(n).padStart(2, '0')
  const toLocal = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`

  const [step, setStep]     = useState(0)
  const [loading, setLoading] = useState(false)
  const [bookingId, setBookingId] = useState(null)
  const [form, setForm] = useState({
    slot_id:        availableSlots[0]?.id || '',
    slot_number:    availableSlots[0]?.slot_number || '',
    start_time:     toLocal(now),
    end_time:       toLocal(new Date(now.getTime() + 2 * 3600000)),
    vehicle_number: ''
  })

  const hours = Math.max(0.5, (new Date(form.end_time) - new Date(form.start_time)) / 3600000)
  const total = (hours * zone.price_per_hour).toFixed(2)

  const handleBook = async () => {
    if (!form.slot_id) return toast.error('Please select a slot')
    if (new Date(form.end_time) <= new Date(form.start_time)) return toast.error('End time must be after start time')
    if (!form.vehicle_number.trim()) return toast.error('Please enter your vehicle number')
    setLoading(true)
    try {
      const orderRes = await api.post('/bookings/create-order', {
        slot_id:        Number(form.slot_id),
        zone_id:        zone.id,
        start_time:     form.start_time,
        end_time:       form.end_time,
        vehicle_number: form.vehicle_number
      })
      const { booking_id, razorpay_order_id } = orderRes.data
      await api.post('/bookings/verify-payment', {
        razorpay_order_id,
        razorpay_payment_id: 'PAY_DEMO_' + Date.now(),
        razorpay_signature:  'SIG_DEMO',
        booking_id
      })
      setBookingId(booking_id)
      speakBookingConfirm(zone.name, total, user?.preferred_lang || 'en')
      addNotification('booking', '✅ Booking Confirmed!', `Slot ${form.slot_number} at ${zone.name} — ₹${total} paid. Booking ID: #${booking_id}`, '/bookings')
      setStep(3)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Booking failed. Please try again.')
    } finally { setLoading(false) }
  }

  const selectSlot = (slot) => {
    setForm(f => ({ ...f, slot_id: slot.id, slot_number: slot.slot_number }))
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }}
      onClick={e => { if (e.target === e.currentTarget && step !== 3) onClose() }}>

      <div style={{ width: '100%', maxWidth: '480px', background: 'var(--c-surface)', border: '1px solid var(--c-border2)', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 0', borderBottom: '1px solid var(--c-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', color: 'var(--c-text)' }}>Book Parking Slot</h2>
              <p style={{ fontSize: '13px', color: 'var(--c-text2)', marginTop: '2px' }}>🏢 {zone.name}</p>
            </div>
            {step < 3 && (
              <button onClick={onClose} style={{ background: 'var(--c-bg3)', border: '1px solid var(--c-border)', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', color: 'var(--c-text2)', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            )}
          </div>

          {/* Step indicator */}
          {step < 3 && (
            <div style={{ display: 'flex', gap: '0', marginBottom: '0' }}>
              {STEPS.slice(0, 3).map((s, i) => (
                <div key={i} style={{ flex: 1, textAlign: 'center', padding: '8px 4px', borderBottom: `2px solid ${i === step ? 'var(--c-primary)' : 'transparent'}` }}>
                  <span style={{ fontSize: '11px', fontWeight: '600', color: i === step ? 'var(--c-primary-light)' : i < step ? 'var(--c-accent)' : 'var(--c-text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {i < step ? '✓ ' : `${i+1}. `}{s}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>

          {/* Step 0 — Select slot */}
          {step === 0 && (
            <div>
              <p style={{ fontSize: '13px', color: 'var(--c-text2)', marginBottom: '14px' }}>
                {availableSlots.length} slots available — tap to select
              </p>
              {availableSlots.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', background: 'rgba(239,35,60,0.05)', borderRadius: '12px', border: '1px solid rgba(239,35,60,0.2)' }}>
                  <p style={{ fontSize: '32px', marginBottom: '8px' }}>😔</p>
                  <p style={{ color: '#f87171', fontWeight: '600' }}>No slots available</p>
                  <p style={{ fontSize: '12px', color: 'var(--c-text3)', marginTop: '4px' }}>All slots are currently occupied</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
                  {availableSlots.map(slot => (
                    <button key={slot.id} onClick={() => selectSlot(slot)}
                      style={{ padding: '12px 6px', borderRadius: '10px', border: `2px solid ${form.slot_id === slot.id ? 'var(--c-primary)' : 'var(--c-border)'}`, background: form.slot_id === slot.id ? 'rgba(59,130,246,0.15)' : 'var(--c-bg2)', color: form.slot_id === slot.id ? '#60a5fa' : 'var(--c-text2)', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s' }}>
                      {slot.slot_number}
                    </button>
                  ))}
                </div>
              )}
              <button className="btn btn-primary" onClick={() => setStep(1)} disabled={!form.slot_id || availableSlots.length === 0}
                style={{ width: '100%', marginTop: '16px' }}>
                Continue →
              </button>
            </div>
          )}

          {/* Step 1 — Time & Vehicle */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '10px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>🅿</span>
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--c-text3)' }}>Selected Slot</p>
                  <p style={{ fontSize: '15px', fontWeight: '700', color: '#60a5fa', fontFamily: 'var(--font-mono)' }}>{form.slot_number}</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="label">Start Time</label>
                  <input className="input" type="datetime-local" value={form.start_time}
                    onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
                </div>
                <div>
                  <label className="label">End Time</label>
                  <input className="input" type="datetime-local" value={form.end_time}
                    onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="label">Vehicle Number</label>
                <input className="input" placeholder="e.g. MH01AB1234" value={form.vehicle_number}
                  onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value.toUpperCase() }))}
                  style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }} />
              </div>

              <div style={{ background: 'rgba(6,214,160,0.08)', border: '1px solid rgba(6,214,160,0.2)', borderRadius: '12px', padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--c-text2)' }}>Duration</span>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--c-text)' }}>{hours.toFixed(1)} hours</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--c-text2)' }}>Rate</span>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--c-text)' }}>₹{zone.price_per_hour}/hr</span>
                </div>
                <hr style={{ border: 'none', borderTop: '1px solid rgba(6,214,160,0.2)', margin: '8px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--c-text)' }}>Total</span>
                  <span style={{ fontSize: '20px', fontWeight: '800', color: '#06d6a0', fontFamily: 'var(--font-display)' }}>₹{total}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-ghost" onClick={() => setStep(0)} style={{ flex: 1 }}>← Back</button>
                <button className="btn btn-primary" onClick={() => setStep(2)}
                  disabled={!form.vehicle_number.trim()} style={{ flex: 2 }}>Review Booking →</button>
              </div>
            </div>
          )}

          {/* Step 2 — Payment */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: '13px', color: 'var(--c-text2)', fontStyle: 'italic' }}>Review your booking details before confirming</p>

              <div style={{ background: 'var(--c-bg2)', border: '1px solid var(--c-border)', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { label: '🏢 Zone',    value: zone.name },
                  { label: '🅿 Slot',    value: form.slot_number },
                  { label: '🚗 Vehicle', value: form.vehicle_number },
                  { label: '⏱ Start',   value: new Date(form.start_time).toLocaleString('en-IN') },
                  { label: '⏱ End',     value: new Date(form.end_time).toLocaleString('en-IN') },
                  { label: '⏳ Duration', value: `${hours.toFixed(1)} hours` },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--c-text2)' }}>{label}</span>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--c-text)' }}>{value}</span>
                  </div>
                ))}
                <hr style={{ border: 'none', borderTop: '1px solid var(--c-border)', margin: '4px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--c-text)' }}>💳 Total Payable</span>
                  <span style={{ fontSize: '22px', fontWeight: '800', color: '#06d6a0', fontFamily: 'var(--font-display)' }}>₹{total}</span>
                </div>
              </div>

              <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: '10px', padding: '10px 14px', fontSize: '12px', color: 'var(--c-text2)' }}>
                ℹ️ Payment will be processed in demo mode. In production, Razorpay handles secure payments.
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-ghost" onClick={() => setStep(1)} disabled={loading} style={{ flex: 1 }}>← Back</button>
                <button className="btn btn-accent btn-lg" onClick={handleBook} disabled={loading} style={{ flex: 2 }}>
                  {loading
                    ? <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                        Processing...
                      </span>
                    : '✅ Confirm & Pay ₹' + total}
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — Confirmed */}
          {step === 3 && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: '64px', marginBottom: '16px', animation: 'bounce 0.6s ease' }}>🎉</div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '800', color: '#06d6a0', marginBottom: '8px' }}>Booking Confirmed!</h3>
              <p style={{ fontSize: '13px', color: 'var(--c-text2)', marginBottom: '20px', lineHeight: 1.6 }}>
                Your slot <strong style={{ color: '#60a5fa', fontFamily: 'var(--font-mono)' }}>{form.slot_number}</strong> at <strong style={{ color: 'var(--c-text)' }}>{zone.name}</strong> has been booked successfully.
              </p>

              <div style={{ background: 'rgba(6,214,160,0.08)', border: '1px solid rgba(6,214,160,0.2)', borderRadius: '14px', padding: '16px', marginBottom: '20px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', color: 'var(--c-text2)' }}>Booking ID</span>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#60a5fa', fontFamily: 'var(--font-mono)' }}>#{bookingId}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', color: 'var(--c-text2)' }}>Amount Paid</span>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#06d6a0' }}>₹{total}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', color: 'var(--c-text2)' }}>Vehicle</span>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--c-text)', fontFamily: 'var(--font-mono)' }}>{form.vehicle_number}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>Close</button>
                <a href="/bookings" className="btn btn-primary" style={{ flex: 2, textDecoration: 'none' }}>View My Bookings →</a>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
      `}</style>
    </div>
  )
}
