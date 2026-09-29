import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../utils/api'
import { rupees } from '../../utils/format'
import { ActionRow, Greeting, Section, Tile, Tiles } from './HomeParts'

export default function AdminHome() {
  const { t } = useTranslation()
  const [s, setS] = useState(null)

  useEffect(() => { api.get('/admin/summary').then(r => setS(r.data)).catch(() => {}) }, [])

  if (!s) return <div className="page-wrap"><div className="shimmer" style={{ height: '200px' }} /></div>
  const a = s.attention

  const todo = [
    a.pending_complaints > 0 && { to: '/dashboard', icon: '⚠️', badge: a.pending_complaints,
      title: t('admin_home.review_complaints', 'Complaints to review'),
      detail: t('admin_home.review_complaints_hint', 'Verify or reject reports from drivers') },
    a.partner_requests > 0 && { to: '/admin', icon: '🏢', badge: a.partner_requests,
      title: t('admin_home.partner_requests', 'Parking Partner requests'),
      detail: t('admin_home.partner_requests_hint', 'Approve lot owners so they can add their lots') },
    a.verified_open > 0 && { to: '/police', icon: '🦺', badge: a.verified_open, badgeClass: 'badge-blue',
      title: t('admin_home.awaiting_officers', 'Verified, waiting for Field Officers'),
      detail: t('admin_home.awaiting_officers_hint', 'Follow up if these sit too long') },
  ].filter(Boolean)

  return (
    <div className="page-wrap fade-in">
      <Greeting subtitle={t('admin_home.subtitle', 'What needs your attention across TPMS')} />

      <Section title={`📌 ${t('admin_home.todo', 'To do')}`}>
        {todo.length === 0
          ? <div className="card" style={{ padding: '20px', color: 'var(--c-text2)', fontSize: '14px' }}>✅ {t('admin_home.all_clear', 'All caught up. Nothing is waiting for you.')}</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{todo.map(x => <ActionRow key={x.to + x.title} {...x} />)}</div>}
      </Section>

      <Section title={`📅 ${t('admin_home.today', 'Today')}`}>
        <Tiles>
          <Tile label={t('admin_home.bookings', 'Bookings made')} value={s.today.bookings} color="#60a5fa" />
          <Tile label={t('partner_home.parked_now', 'Cars parked now')} value={s.today.parked_now} color="#a78bfa" />
          <Tile label={t('admin_home.revenue', 'Collected by partners')} value={rupees(s.today.revenue)} color="#06d6a0" to="/analytics" />
          <Tile label={t('report.no_shows', 'No-shows')} value={a.no_shows_today} color={a.no_shows_today ? '#f87171' : 'var(--c-text)'} />
          <Tile label={t('admin_home.new_complaints', 'New complaints')} value={s.today.complaints} color="#ffd166" />
        </Tiles>
      </Section>

      <Section title={`🌐 ${t('admin_home.platform', 'Platform')}`}>
        <Tiles>
          <Tile label={t('admin_home.drivers', 'Drivers')} value={s.platform.users} to="/admin"
            hint={a.unverified_users ? t('admin_home.unverified', '{{n}} not verified yet', { n: a.unverified_users }) : null} />
          <Tile label={t('roles.vendor', 'Parking Partner')} value={s.platform.partners} to="/admin" />
          <Tile label={t('roles.police', 'Field Officer')} value={s.platform.officers} to="/admin" />
          <Tile label={t('admin_home.lots', 'Active lots')} value={s.platform.zones} to="/zones" />
        </Tiles>
      </Section>
    </div>
  )
}
