import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'

export default function NotificationBell() {
  const { t } = useTranslation()
  const unread = useSelector(s => s.notifications.unread)
  return (
    <Link to="/notifications" aria-label={t('notif.title', 'Notifications')}
      style={{ position: 'relative', textDecoration: 'none', width: '34px', height: '34px', borderRadius: '9px', border: '1px solid var(--c-border)', background: 'var(--c-bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px' }}>
      🔔
      {unread > 0 && (
        <span style={{ position: 'absolute', top: '-5px', right: '-5px', background: '#ef233c', color: 'white', borderRadius: '10px', minWidth: '16px', height: '16px', padding: '0 4px', fontSize: '9px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--c-bg)' }}>
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  )
}
