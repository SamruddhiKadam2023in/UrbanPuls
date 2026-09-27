import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { QRCodeSVG } from 'qrcode.react'
import toast from 'react-hot-toast'
import { differenceInSeconds } from 'date-fns'
import { fetchMyBookings, cancelBooking, bookingUpdated } from '../store/slices/bookingsSlice'
import api, { errorMessage } from '../utils/api'
import { fmtDateTime, fmtTime, localInputToISO, rupees, STATUS, toLocalInput } from '../utils/format'
import i18n from '../i18n'
const t = (...a) => i18n.t(...a)

function Countdown({ target, prefix, urgentBelow = 900 }) {
  const [secs, setSecs] = useState(() => differenceInSeconds(new Date(target), new Date()))
  useEffect(() => {
    const id = setInterval(() => setSecs(differenceInSeconds(new Date(target), new Date())), 1000)
    return () => clearInterval(id)
  }, [target])
  const abs = Math.abs(secs)
  const h = Math.floor(abs / 3600), m = Math.floor((abs % 3600) / 60), s = abs % 60
  const text = h ? `${h}h ${m}m` : `${m}m ${s}s`
  const urgent = secs < urgentBelow
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '8px', fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: '700', background: urgent ? 'rgba(239,35,60,0.1)' : 'rgba(6,214,160,0.1)', color: urgent ? '#f87171' : '#06d6a0', border: `1px solid ${urgent ? 'rgba(239,35,60,0.3)' : 'rgba(6,214,160,0.3)'}` }}>
      {secs < 0 ? t('bookings.passed_ago', '{{what}} passed {{time}} ago', { what: prefix, time: text }) : t('bookings.in_time', '{{what}} in {{time}}', { what: prefix, time: text })}
    </span>
  )
}

function ExtendModal({ booking, onClose, onDone }) {
  const current = new Date(booking.end_time)
  const [end, setEnd] = useState(toLocalInput(new Date(current.getTime() + 3600000)))
  const [saving, setSaving] = useState(false)
  const save = async () => {
    setSaving(true)
    try {
      const res = await api.post(`/bookings/${booking.id}/extend`, { end_time: localInputToISO(end) })
      toast.success(t('bookings.extended', 'Booking extended'))
      onDone(res.data)
    } catch (e) { toast.error(errorMessage(e)) }
    finally { setSaving(false) }
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '20px' }}>
      <div className="card-glow" style={{ width: '100%', maxWidth: '380px', padding: '24px' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: '700', color: 'var(--c-text)', marginBottom: '6px' }}>{t('bookings.extend_title', 'Extend booking')}</h3>
        <p style={{ fontSize: '13px', color: 'var(--c-text2)', marginBottom: '16px' }}>{t('bookings.currently_ends', 'Currently ends {{time}}', { time: fmtDateTime(booking.end_time) })}</p>
        <label className="label">{t('bookings.new_end', 'New end time')}</label>
        <input className="input" type="datetime-local" value={end} min={toLocalInput(current)} onChange={e => setEnd(e.target.value)} />
        <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
          <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>{t('common.cancel', 'Cancel')}</button>
          <button className="btn btn-primary" onClick={save} disabled={saving} style={{ flex: 2 }}>{saving ? t('common.saving', 'Saving...') : t('bookings.extend_btn', 'Extend')}</button>
        </div>
      </div>
    </div>
  )
}

function RatingModal({ booking, onClose, onSubmit }) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '20px' }}>
      <div className="card-glow" style={{ width: '100%', maxWidth: '380px', padding: '28px' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', color: 'var(--c-text)', marginBottom: '6px' }}>{t('bookings.rate_title', 'Rate your experience')}</h3>
        <p style={{ fontSize: '13px', color: 'var(--c-text2)', marginBottom: '20px' }}>{booking.zone_name}</p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '20px' }}>
          {[1, 2, 3, 4, 5].map(star => (
            <button key={star} onClick={() => setRating(star)} aria-label={`${star} stars`}
              style={{ fontSize: '32px', background: 'none', border: 'none', cursor: 'pointer', filter: rating >= star ? 'none' : 'grayscale(1)' }}>⭐</button>
          ))}
        </div>
        <textarea className="input" rows={3} placeholder={t('bookings.rate_ph', 'Share your experience (optional)')} value={comment} onChange={e => setComment(e.target.value)} style={{ resize: 'none', marginBottom: '16px' }} />
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>{t('bookings.skip', 'Skip')}</button>
          <button className="btn btn-primary" onClick={() => onSubmit(rating, comment)} disabled={!rating} style={{ flex: 2 }}>{t('bookings.submit', 'Submit')}</button>
        </div>
      </div>
    </div>
  )
}

function BookingCard({ b, children, extra }) {
  const sc = STATUS[b.status] || STATUS.reserved
  return (
    <div className="card" style={{ padding: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '220px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: '600', fontSize: '15px', color: 'var(--c-text)' }}>{b.zone_name}</span>
            <span className={`badge ${sc.badge}`}>{t(`status.${b.status}`, sc.label)}</span>
            {extra}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--c-text2)', marginBottom: '4px' }}>
            🅿 {t('booking.slot', 'Slot')} {b.slot_number} · 🚘 <span style={{ fontFamily: 'var(--font-mono)' }}>{b.vehicle_number}</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--c-text3)', fontFamily: 'var(--font-mono)' }}>
            {b.checked_in_at
              ? <>{t('bookings.in', 'In')} {fmtDateTime(b.checked_in_at)}{b.checked_out_at && <> → {t('bookings.out', 'out')} {fmtTime(b.checked_out_at)}</>}</>
              : <>{fmtDateTime(b.start_time)} → {fmtTime(b.end_time)}</>}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', color: '#06d6a0' }}>
            {b.final_amount != null ? rupees(b.final_amount) : `~${rupees(b.estimated_amount)}`}
          </span>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>{children}</div>
        </div>
      </div>
    </div>
  )
}

export default function Bookings() {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const { list, loading } = useSelector(s => s.bookings)
  const [showQr, setShowQr] = useState(null)
  const [extending, setExtending] = useState(null)
  const [rating, setRating] = useState(null)
  const [limits, setLimits] = useState(null)

  useEffect(() => {
    dispatch(fetchMyBookings())
    api.get('/bookings/limits').then(r => setLimits(r.data)).catch(() => {})
    const id = setInterval(() => dispatch(fetchMyBookings()), 60000)   // pick up gate check-ins and no-shows
    return () => clearInterval(id)
  }, [])

  const handleCancel = async (id) => {
    if (!confirm(t('bookings.cancel_confirm'))) return
    const res = await dispatch(cancelBooking(id))
    if (res.meta.requestStatus === 'fulfilled') toast.success(t('bookings.cancelled', 'Booking cancelled'))
    else toast.error(t('bookings.cancel_failed', 'Could not cancel this booking'))
  }

  const downloadReceipt = async (b) => {
    try {
      const res = await api.get(`/bookings/${b.id}/receipt`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a'); a.href = url; a.download = `receipt_${b.booking_code}.pdf`; a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error(t('bookings.no_receipt', 'Receipt not available')) }
  }

  const exportCSV = () => {
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`
    const headers = ['Code', 'Zone', 'Slot', 'Vehicle', 'Start', 'End', 'Checked in', 'Checked out', 'Amount (Rs)', 'Status']
    const rows = list.map(b => [b.booking_code, b.zone_name, b.slot_number, b.vehicle_number,
      fmtDateTime(b.start_time), fmtDateTime(b.end_time), fmtDateTime(b.checked_in_at), fmtDateTime(b.checked_out_at),
      (b.final_amount ?? b.estimated_amount).toFixed(2), STATUS[b.status]?.label || b.status])
    const csv = [headers, ...rows].map(r => r.map(esc).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a'); a.href = url; a.download = 'my_bookings.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const submitRating = async (stars, comment) => {
    try {
      await api.post(`/bookings/${rating.id}/rating`, { stars, comment })
      dispatch(bookingUpdated({ ...rating, rating: stars }))
      toast.success(t('bookings.rated', 'Thanks for your rating!'))
    } catch (e) { toast.error(errorMessage(e)) }
    setRating(null)
  }

  const upcoming = list.filter(b => b.status === 'reserved')
  const parked = list.filter(b => b.status === 'checked_in')
  const past = list.filter(b => !['reserved', 'checked_in'].includes(b.status))

  const section = (title, color, items, render) => items.length > 0 && (
    <div style={{ marginBottom: '24px' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '600', color, marginBottom: '10px' }}>{title}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>{items.map(render)}</div>
    </div>
  )

  return (
    <div className="page-wrap fade-in">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #06d6a0, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>📋</div>
          <div>
            <h1 className="section-header" style={{ fontSize: '26px' }}>{t('bookings.title')}</h1>
            <p className="section-sub">{list.length} {t('bookings.total')}</p>
          </div>
        </div>
        {list.length > 0 && <button onClick={exportCSV} className="btn btn-outline btn-sm">📥 {t('bookings.export', 'Export CSV')}</button>}
      </div>

      {limits && limits.recent_no_shows > 0 && (
        <div style={{ background: 'rgba(255,209,102,0.08)', border: '1px solid rgba(255,209,102,0.25)', borderRadius: '12px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: 'var(--c-text2)' }}>
          ⚠️ {t('bookings.no_show_warning', "You missed {{missed}} of your recent reservations. After {{limit}} missed reservations in 30 days, online booking is paused. Please cancel bookings you can't make.", { missed: limits.recent_no_shows, limit: limits.no_show_limit })}
        </div>
      )}

      {loading && list.length === 0 && [1, 2].map(i => <div key={i} className="shimmer" style={{ height: '100px', marginBottom: '10px' }} />)}

      {!loading && list.length === 0 && (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🅿️</div>
          <p style={{ color: 'var(--c-text2)', fontSize: '15px', marginBottom: '12px' }}>{t('bookings.no_bookings')}</p>
          <Link to="/map" className="btn btn-primary">{t('bookings.find_parking', 'Find parking →')}</Link>
        </div>
      )}

      {section(`🚗 ${t('bookings.parked_now', 'Parked now')}`, '#06d6a0', parked, b => (
        <BookingCard key={b.id} b={b} extra={<Countdown target={b.end_time} prefix={t('bookings.booked_time_ends', 'Booked time ends')} />}>
          <button onClick={() => setExtending(b)} className="btn btn-ghost btn-sm">⏱ {t('bookings.extend_btn', 'Extend')}</button>
        </BookingCard>
      ))}

      {section(`📅 ${t('bookings.upcoming', 'Upcoming')}`, '#60a5fa', upcoming, b => (
        <div key={b.id}>
          <BookingCard b={b} extra={<Countdown target={b.start_time} prefix={t('bookings.arrival', 'Arrival')} urgentBelow={600} />}>
            <button onClick={() => setShowQr(showQr === b.id ? null : b.id)} className="btn btn-primary btn-sm">{showQr === b.id ? t('bookings.hide_code', 'Hide code') : `▣ ${t('bookings.show_code', 'Show gate code')}`}</button>
            <button onClick={() => setExtending(b)} className="btn btn-ghost btn-sm">⏱ {t('bookings.extend_btn', 'Extend')}</button>
            <button onClick={() => handleCancel(b.id)} className="btn btn-danger btn-sm">{t('bookings.cancel')}</button>
          </BookingCard>
          {showQr === b.id && (
            <div className="card" style={{ padding: '20px', marginTop: '6px', textAlign: 'center' }}>
              <div style={{ display: 'inline-block', background: 'white', padding: '12px', borderRadius: '12px' }}>
                <QRCodeSVG value={b.booking_code} size={180} />
              </div>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: '700', letterSpacing: '0.15em', color: 'var(--c-text)', marginTop: '10px' }}>{b.booking_code}</p>
              <p style={{ fontSize: '12px', color: 'var(--c-text3)', marginTop: '4px' }}>{t('bookings.code_hint', 'Show this at the gate. Pay there in cash or UPI.')}</p>
            </div>
          )}
        </div>
      ))}

      {section(t('bookings.past', 'Past bookings'), 'var(--c-text2)', past, b => (
        <BookingCard key={b.id} b={b} extra={b.rating && <span style={{ fontSize: '12px', color: '#ffd166' }}>{'★'.repeat(b.rating)}</span>}>
          {b.status === 'completed' && !b.rating && (
            <button onClick={() => setRating(b)} className="btn btn-sm" style={{ background: 'rgba(255,209,102,0.1)', color: '#ffd166', border: '1px solid rgba(255,209,102,0.3)' }}>⭐ {t('bookings.rate', 'Rate')}</button>
          )}
          {b.has_receipt && <button onClick={() => downloadReceipt(b)} className="btn btn-ghost btn-sm">{t('bookings.receipt')}</button>}
        </BookingCard>
      ))}

      {extending && <ExtendModal booking={extending} onClose={() => setExtending(null)} onDone={(b) => { dispatch(bookingUpdated(b)); setExtending(null) }} />}
      {rating && <RatingModal booking={rating} onClose={() => setRating(null)} onSubmit={submitRating} />}
    </div>
  )
}
