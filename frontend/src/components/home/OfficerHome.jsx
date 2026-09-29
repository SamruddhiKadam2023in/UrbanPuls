import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { formatDistanceToNow, isToday } from 'date-fns'
import api from '../../utils/api'
import { ActionRow, Empty, Greeting, Section, Tile, Tiles } from './HomeParts'

const DEFAULT_TYPES = {
  illegal_parking: '🚫 Illegal parking', road_blockage: '🚧 Road blockage', signal_malfunction: '🚦 Signal malfunction',
  accident: '💥 Accident', vendor_issue: '🏢 Parking Partner issue',
}

export default function OfficerHome() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(null)
  const [resolved, setResolved] = useState([])

  useEffect(() => {
    api.get('/complaints/', { params: { status: 'verified' } }).then(r => setOpen(r.data)).catch(() => setOpen([]))
    api.get('/complaints/', { params: { status: 'resolved' } }).then(r => setResolved(r.data)).catch(() => {})
  }, [])

  if (!open) return <div className="page-wrap"><div className="shimmer" style={{ height: '200px' }} /></div>

  // Oldest first: they have waited longest
  const queue = [...open].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  const resolvedToday = resolved.filter(c => c.updated_at && isToday(new Date(c.updated_at))).length
  const oldest = queue[0]

  return (
    <div className="page-wrap fade-in">
      <Greeting subtitle={t('officer_home.subtitle', 'Verified complaints waiting for action on the ground')} />

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <Link to="/police" className="btn btn-primary btn-lg">🦺 {t('officer_home.open_map', 'Open the enforcement map')}</Link>
      </div>

      <Tiles>
        <Tile label={t('officer_home.open', 'Open complaints')} value={queue.length} color={queue.length ? '#f87171' : '#06d6a0'} to="/police" />
        <Tile label={t('officer_home.resolved_today', 'Resolved today')} value={resolvedToday} color="#06d6a0" />
        <Tile label={t('officer_home.oldest', 'Oldest waiting')}
          value={oldest ? formatDistanceToNow(new Date(oldest.created_at)) : '—'} color="#ffd166" />
      </Tiles>

      <Section title={`📋 ${t('officer_home.queue', 'Next to handle')}`}
        action={<Link to="/police" className="btn btn-ghost btn-sm">{t('officer_home.all', 'See all on map')} →</Link>}>
        {queue.length === 0
          ? <Empty>✅ {t('officer_home.clear', 'Nothing waiting. All verified complaints are resolved.')}</Empty>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {queue.slice(0, 8).map(c => (
                <ActionRow key={c.id} to="/police" icon="📍"
                  title={t(`complaints.types.${c.complaint_type}`, DEFAULT_TYPES[c.complaint_type] || c.complaint_type)}
                  detail={c.description || `${c.latitude.toFixed(4)}, ${c.longitude.toFixed(4)}`}
                  badge={formatDistanceToNow(new Date(c.created_at), { addSuffix: true })} />
              ))}
            </div>
          )}
      </Section>
    </div>
  )
}
