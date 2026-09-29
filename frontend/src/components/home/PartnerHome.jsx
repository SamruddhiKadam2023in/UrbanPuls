import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../utils/api'
import { fmtTime, rupees } from '../../utils/format'
import { ZONE_EVENT } from '../common/LiveConnection'
import { ActionRow, Empty, Greeting, Section, Tile, Tiles } from './HomeParts'

export default function PartnerHome() {
  const { t } = useTranslation()
  const [data, setData] = useState(null)

  const load = useCallback(() => { api.get('/vendors/today').then(r => setData(r.data)).catch(() => {}) }, [])

  useEffect(() => {
    load()
    // Refresh when a car arrives or leaves, or a booking changes
    window.addEventListener(ZONE_EVENT, load)
    const id = setInterval(load, 60000)
    return () => { window.removeEventListener(ZONE_EVENT, load); clearInterval(id) }
  }, [load])

  if (!data) return <div className="page-wrap"><div className="shimmer" style={{ height: '200px' }} /></div>
  const tt = data.totals

  return (
    <div className="page-wrap fade-in">
      <Greeting subtitle={t('partner_home.subtitle', "Here's today at your parking lots")} />

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <Link to="/gate" className="btn btn-primary btn-lg">🚧 {t('partner_home.open_gate', 'Open the Gate screen')}</Link>
        <Link to="/zones" className="btn btn-ghost btn-lg">🅿 {t('partner_home.manage_lots', 'Manage lots')}</Link>
      </div>

      <Tiles>
        <Tile label={t('partner_home.collected_today', 'Collected today')} value={rupees(tt.revenue)} color="#06d6a0"
          hint={t('partner_home.cash_upi', 'Cash {{cash}} · UPI {{upi}}', { cash: rupees(tt.cash), upi: rupees(tt.upi) })} to="/analytics" />
        <Tile label={t('partner_home.parked_now', 'Cars parked now')} value={data.parked_now} color="#60a5fa" to="/gate" />
        <Tile label={t('partner_home.free_now', 'Free slots now')} value={data.free_now} color="#06d6a0" />
        <Tile label={t('partner_home.visits_today', 'Visits completed')} value={tt.completed}
          hint={t('partner_home.bookings_walkins', '{{r}} booked · {{w}} walk-in', { r: tt.reservations, w: tt.walk_ins })} />
        <Tile label={t('report.no_shows', 'No-shows')} value={tt.no_shows} color={tt.no_shows ? '#f87171' : 'var(--c-text)'} />
      </Tiles>

      {data.issues.length > 0 && (
        <Section title={`⚠️ ${t('partner_home.fix_title', 'Needs your attention')}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.issues.map(i => (
              <ActionRow key={`${i.zone_id}-${i.issue}`} to="/zones" icon={i.issue === 'no_upi' ? '💳' : '🙈'} title={i.zone}
                detail={i.issue === 'no_upi'
                  ? t('partner_home.no_upi', 'No UPI ID: customers can only pay cash. Add one to show a payment QR at checkout.')
                  : t('partner_home.hidden', 'This lot is hidden from the map, so nobody can book it.')} />
            ))}
          </div>
        </Section>
      )}

      <Section title={`🚗 ${t('partner_home.arriving', 'Arriving in the next 2 hours')}`}
        action={<Link to="/gate" className="btn btn-ghost btn-sm">{t('nav.gate', 'Gate')} →</Link>}>
        {data.arriving.length === 0
          ? <Empty>{t('partner_home.no_arrivals', 'No bookings due in the next 2 hours.')}</Empty>
          : (
            <div className="card" style={{ padding: '6px 0' }}>
              {data.arriving.map(a => (
                <div key={a.id} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--c-border)', flexWrap: 'wrap' }}>
                  <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text)' }}>{fmtTime(a.start_time)}</strong>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text)' }}>{a.vehicle_number}</span>
                  <span style={{ fontSize: '12px', color: 'var(--c-text3)' }}>{a.zone_name} · {t('booking.slot', 'Slot')} {a.slot_number}</span>
                </div>
              ))}
            </div>
          )}
      </Section>

      <Section title={`🅿 ${t('partner_home.lots', 'Your lots right now')}`}>
        {data.lots.length === 0
          ? <Empty><Link to="/zones" className="btn btn-primary">{t('zones.add', 'Add parking zone')}</Link></Empty>
          : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
              {data.lots.map(l => {
                const seg = (n, c) => l.total ? <div style={{ width: `${(n / l.total) * 100}%`, background: c }} /> : null
                return (
                  <div key={l.zone_id} className="card" style={{ padding: '14px', opacity: l.is_active ? 1 : 0.6 }}>
                    <div style={{ fontWeight: 600, color: 'var(--c-text)', marginBottom: '8px' }}>{l.name}</div>
                    <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', background: 'rgba(6,214,160,0.25)', marginBottom: '6px' }}>
                      {seg(l.parked, '#f87171')}{seg(l.reserved, '#ffd166')}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--c-text2)' }}>
                      🔴 {l.parked} · 🟡 {l.reserved} · 🟢 {l.free} {t('home.slot_free', 'free')}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
      </Section>
    </div>
  )
}
