import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { fetchMyBookings, cancelBooking } from '../store/slices/bookingsSlice'
import { format, differenceInMinutes, differenceInSeconds } from 'date-fns'
import api from '../utils/api'

const STATUS_CONFIG = {
  active:    { label: 'Active',    badge: 'badge-green'  },
  cancelled: { label: 'Cancelled', badge: 'badge-red'    },
  expired:   { label: 'Expired',   badge: 'badge-yellow' },
  completed: { label: 'Completed', badge: 'badge-blue'   },
}

// ── Live countdown timer ───────────────────────────────────────────────────
function BookingTimer({ endTime }) {
  const [timeLeft, setTimeLeft] = useState('')
  const [urgent,   setUrgent]   = useState(false)

  useEffect(() => {
    const end = new Date(endTime)
    const tick = () => {
      const now  = new Date()
      const secs = differenceInSeconds(end, now)
      if (secs <= 0) { setTimeLeft('Expired'); return }
      const h = Math.floor(secs / 3600)
      const m = Math.floor((secs % 3600) / 60)
      const s = secs % 60
      setUrgent(secs < 900) // urgent if < 15 min
      setTimeLeft(h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`)

      // Browser notification when < 10 min
      if (secs === 600 && Notification.permission === 'granted') {
        new Notification('⏰ TPMS Alert', { body: 'Your parking expires in 10 minutes!', icon: '/favicon.ico' })
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [endTime])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '8px', background: urgent ? 'rgba(239,35,60,0.1)' : 'rgba(6,214,160,0.1)', border: `1px solid ${urgent ? 'rgba(239,35,60,0.3)' : 'rgba(6,214,160,0.3)'}` }}>
      <span style={{ fontSize: '12px' }}>{urgent ? '⚠️' : '⏱'}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: '700', color: urgent ? '#f87171' : '#06d6a0' }}>{timeLeft}</span>
    </div>
  )
}

// ── Star rating component ──────────────────────────────────────────────────
function RatingModal({ booking, onClose, onSubmit }) {
  const [rating,  setRating]  = useState(0)
  const [hover,   setHover]   = useState(0)
  const [comment, setComment] = useState('')

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '20px' }}>
      <div className="card-glow" style={{ width: '100%', maxWidth: '380px', padding: '28px' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', color: 'var(--c-text)', marginBottom: '6px' }}>Rate Your Experience</h3>
        <p style={{ fontSize: '13px', color: 'var(--c-text2)', marginBottom: '20px' }}>Zone #{booking.zone_id} · Slot #{booking.slot_id}</p>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '20px' }}>
          {[1,2,3,4,5].map(star => (
            <button key={star}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHover(star)}
              onMouseLeave={() => setHover(0)}
              style={{ fontSize: '36px', background: 'none', border: 'none', cursor: 'pointer', transition: 'transform 0.1s', transform: (hover || rating) >= star ? 'scale(1.2)' : 'scale(1)', filter: (hover || rating) >= star ? 'none' : 'grayscale(1)' }}>
              ⭐
            </button>
          ))}
        </div>

        {rating > 0 && (
          <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--c-text2)', marginBottom: '16px' }}>
            {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent!'][rating]}
          </p>
        )}

        <div style={{ marginBottom: '16px' }}>
          <label className="label">Comment (optional)</label>
          <textarea className="input" rows={3} placeholder="Share your experience..." value={comment}
            onChange={e => setComment(e.target.value)} style={{ resize: 'none' }} />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>Skip</button>
          <button className="btn btn-primary" onClick={() => onSubmit(rating, comment)} disabled={!rating} style={{ flex: 2 }}>
            Submit Rating ⭐
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Bookings() {
  const dispatch = useDispatch()
  const { t }    = useTranslation()
  const { list, loading } = useSelector(s => s.bookings)

  const [ratingBooking, setRatingBooking] = useState(null)
  const [ratings,       setRatings]       = useState(() => {
    try { return JSON.parse(localStorage.getItem('tpms_ratings') || '{}') } catch { return {} }
  })

  useEffect(() => {
    dispatch(fetchMyBookings())
    // Request notification permission
    if (Notification.permission === 'default') Notification.requestPermission()
  }, [])

  const handleCancel = async (id) => {
    if (!confirm(t('bookings.cancel_confirm'))) return
    const res = await dispatch(cancelBooking(id))
    if (res.meta.requestStatus === 'fulfilled') toast.success('Booking cancelled')
    else toast.error('Failed to cancel')
  }

  const downloadReceipt = async (id) => {
    try {
      const res = await api.get(`/bookings/receipt/${id}`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a'); a.href = url; a.download = `receipt_${id}.pdf`; a.click()
    } catch { toast.error('Receipt not available') }
  }

  const exportCSV = () => {
    const headers = ['ID', 'Zone', 'Slot', 'Vehicle', 'Start', 'End', 'Amount', 'Status']
    const rows = list.map(b => [b.id, b.zone_id, b.slot_id, b.vehicle_number || 'N/A',
      b.start_time ? format(new Date(b.start_time), 'dd/MM/yyyy HH:mm') : '',
      b.end_time   ? format(new Date(b.end_time),   'dd/MM/yyyy HH:mm') : '',
      `₹${b.total_amount?.toFixed(2)}`, b.status])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url; a.download = 'my_bookings.csv'; a.click()
    toast.success('Exported as CSV!')
  }

  const handleRatingSubmit = (rating, comment) => {
    const updated = { ...ratings, [ratingBooking.id]: { rating, comment, date: new Date().toISOString() } }
    setRatings(updated)
    localStorage.setItem('tpms_ratings', JSON.stringify(updated))
    toast.success(`Thanks! You rated ${rating}/5 ⭐`)
    setRatingBooking(null)
  }

  const activeBookings   = list.filter(b => b.status === 'active')
  const inactiveBookings = list.filter(b => b.status !== 'active')

  return (
    <div className="page-wrap fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #06d6a0, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', boxShadow: '0 8px 24px rgba(6,214,160,0.35)' }}>📋</div>
            <div>
              <h1 className="section-header" style={{ fontSize: '26px' }}>{t('bookings.title')}</h1>
              <p className="section-sub">{list.length} {t('bookings.total')}</p>
            </div>
          </div>
          {list.length > 0 && (
            <button onClick={exportCSV} className="btn btn-outline btn-sm">📥 Export CSV</button>
          )}
        </div>
      </div>

      {/* Active bookings with timer */}
      {activeBookings.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '600', color: '#06d6a0', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#06d6a0', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
            Active Bookings
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {activeBookings.map(b => (
              <div key={b.id} className="card" style={{ padding: '20px', border: '1px solid rgba(6,214,160,0.2)', background: 'rgba(6,214,160,0.03)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(6,214,160,0.1)', border: '1px solid rgba(6,214,160,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>🚗</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: '600', fontSize: '15px', color: 'var(--c-text)' }}>Zone #{b.zone_id} · Slot #{b.slot_id}</span>
                      <span className="badge badge-green">Active</span>
                      <BookingTimer endTime={b.end_time} />
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--c-text2)', marginBottom: '4px' }}>🚘 {b.vehicle_number || 'N/A'}</div>
                    <div style={{ fontSize: '12px', color: 'var(--c-text3)', fontFamily: 'var(--font-mono)' }}>
                      {b.start_time && format(new Date(b.start_time), 'dd MMM yy, HH:mm')} → {b.end_time && format(new Date(b.end_time), 'dd MMM yy, HH:mm')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', color: '#06d6a0' }}>₹{b.total_amount?.toFixed(0)}</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => handleCancel(b.id)} className="btn btn-danger btn-sm">{t('bookings.cancel')}</button>
                      <button onClick={() => downloadReceipt(b.id)} className="btn btn-ghost btn-sm">{t('bookings.receipt')}</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>{[1,2,3].map(i => <div key={i} className="shimmer" style={{ height: '100px' }} />)}</div>}

      {!loading && list.length === 0 && (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🅿️</div>
          <p style={{ color: 'var(--c-text2)', fontSize: '15px', marginBottom: '8px' }}>{t('bookings.no_bookings')}</p>
          <p style={{ color: 'var(--c-text3)', fontSize: '13px' }}>{t('bookings.no_bookings_sub')}</p>
        </div>
      )}

      {/* Past bookings */}
      {inactiveBookings.length > 0 && (
        <div>
          {activeBookings.length > 0 && (
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '600', color: 'var(--c-text2)', marginBottom: '10px' }}>Past Bookings</h2>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {inactiveBookings.map(b => {
              const sc = STATUS_CONFIG[b.status] || STATUS_CONFIG.active
              const rated = ratings[b.id]
              return (
                <div key={b.id} className="card" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>🚗</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'var(--font-display)', fontWeight: '600', fontSize: '15px', color: 'var(--c-text)' }}>Zone #{b.zone_id} · Slot #{b.slot_id}</span>
                        <span className={`badge ${sc.badge}`}>{sc.label}</span>
                        {rated && <span style={{ fontSize: '12px' }}>{'⭐'.repeat(rated.rating)}</span>}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--c-text2)', marginBottom: '4px' }}>🚘 {b.vehicle_number || t('bookings.vehicle')}</div>
                      <div style={{ fontSize: '12px', color: 'var(--c-text3)', fontFamily: 'var(--font-mono)' }}>
                        {b.start_time && format(new Date(b.start_time), 'dd MMM yy, HH:mm')} → {b.end_time && format(new Date(b.end_time), 'dd MMM yy, HH:mm')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', color: '#06d6a0' }}>₹{b.total_amount?.toFixed(0)}</span>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {b.status === 'completed' && !rated && (
                          <button onClick={() => setRatingBooking(b)} className="btn btn-sm" style={{ background: 'rgba(255,209,102,0.1)', color: '#ffd166', border: '1px solid rgba(255,209,102,0.3)' }}>⭐ Rate</button>
                        )}
                        <button onClick={() => downloadReceipt(b.id)} className="btn btn-ghost btn-sm">{t('bookings.receipt')}</button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {ratingBooking && (
        <RatingModal booking={ratingBooking} onClose={() => setRatingBooking(null)} onSubmit={handleRatingSubmit} />
      )}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )
}
