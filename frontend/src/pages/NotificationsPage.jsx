import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { formatDistanceToNow } from 'date-fns'
import { clearNotifications, fetchNotifications, markAllRead, markRead } from '../store/slices/notificationsSlice'

const TYPE_CONFIG = {
  booking:   { icon: '📋', color: '#06d6a0' },
  checkin:   { icon: '🚗', color: '#60a5fa' },
  checkout:  { icon: '🧾', color: '#06d6a0' },
  reminder:  { icon: '⏰', color: '#ffd166' },
  no_show:   { icon: '⚠️', color: '#f87171' },
  complaint: { icon: '📣', color: '#ffd166' },
  account:   { icon: '👤', color: '#a78bfa' },
}

export default function Notifications() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { items, unread, loaded } = useSelector(s => s.notifications)

  useEffect(() => { dispatch(fetchNotifications()) }, [])

  const open = (n) => {
    if (!n.is_read) dispatch(markRead(n.id))
    if (n.link) navigate(n.link)
  }

  return (
    <div className="page-wrap fade-in">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="section-header" style={{ fontSize: '26px' }}>🔔 {t('notif.title', 'Notifications')}</h1>
          <p className="section-sub">{t('notif.summary', '{{unread}} unread · {{total}} total', { unread, total: items.length })}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {unread > 0 && <button onClick={() => dispatch(markAllRead())} className="btn btn-outline btn-sm">✓ {t('notif.mark_all', 'Mark all read')}</button>}
          {items.length > 0 && <button onClick={() => confirm(t('notif.clear_confirm', 'Delete all notifications?')) && dispatch(clearNotifications())} className="btn btn-ghost btn-sm">🗑 {t('notif.clear', 'Clear all')}</button>}
        </div>
      </div>

      {loaded && items.length === 0 && (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔕</div>
          <p style={{ color: 'var(--c-text2)', fontSize: '15px' }}>{t('notif.empty', 'No notifications yet')}</p>
          <p style={{ color: 'var(--c-text3)', fontSize: '13px', marginTop: '4px' }}>{t('notif.empty_sub', 'Booking updates and alerts will appear here')}</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {items.map(n => {
          const cfg = TYPE_CONFIG[n.type] || { icon: 'ℹ️', color: '#3b82f6' }
          return (
            <button key={n.id} onClick={() => open(n)}
              style={{ textAlign: 'left', width: '100%', padding: '16px', borderRadius: '14px', cursor: 'pointer', display: 'flex', gap: '14px', alignItems: 'flex-start', fontFamily: 'var(--font-body)',
                background: n.is_read ? 'var(--c-surface)' : `${cfg.color}12`, border: `1px solid ${n.is_read ? 'var(--c-border)' : `${cfg.color}40`}` }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${cfg.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0, position: 'relative' }}>
                {cfg.icon}
                {!n.is_read && <span style={{ position: 'absolute', top: '-2px', right: '-2px', width: '8px', height: '8px', borderRadius: '50%', background: cfg.color }} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--c-text)', marginBottom: '3px' }}>{n.title}</div>
                <div style={{ fontSize: '13px', color: 'var(--c-text2)', marginBottom: '4px', lineHeight: 1.5 }}>{n.message}</div>
                <div style={{ fontSize: '11px', color: 'var(--c-text3)', fontFamily: 'var(--font-mono)' }}>
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </div>
              </div>
              {n.link && <span style={{ color: 'var(--c-text3)', fontSize: '16px' }}>→</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
