import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

function getNotifs() {
  try { return JSON.parse(localStorage.getItem('tpms_notifications') || '[]') } catch { return [] }
}

export default function NotificationBell() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const update = () => setCount(getNotifs().filter(n => !n.read).length)
    update()
    window.addEventListener('tpms_notif_update', update)
    const id = setInterval(update, 3000)
    return () => { window.removeEventListener('tpms_notif_update', update); clearInterval(id) }
  }, [])

  return (
    <Link to="/notifications" style={{ position: 'relative', textDecoration: 'none', width: '36px', height: '36px', borderRadius: '10px', border: '1px solid var(--c-border)', background: 'var(--c-bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', transition: 'all 0.2s' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--c-border2)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--c-border)'}>
      🔔
      {count > 0 && (
        <div style={{ position: 'absolute', top: '-5px', right: '-5px', background: '#ef233c', color: 'white', borderRadius: '50%', width: '16px', height: '16px', fontSize: '9px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--c-bg)' }}>
          {count > 9 ? '9+' : count}
        </div>
      )}
    </Link>
  )
}
