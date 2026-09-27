import { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'

const NOTIF_KEY = 'tpms_notifications'

function getNotifs() {
  try { return JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]') } catch { return [] }
}

function saveNotifs(n) { localStorage.setItem(NOTIF_KEY, JSON.stringify(n)) }

export function addNotification(type, title, message, link = null) {
  const notifs = getNotifs()
  notifs.unshift({ id: Date.now(), type, title, message, link, read: false, time: new Date().toISOString() })
  saveNotifs(notifs.slice(0, 50))
  window.dispatchEvent(new Event('tpms_notif_update'))
}

const TYPE_CONFIG = {
  booking:   { icon: '📋', color: '#06d6a0', bg: 'rgba(6,214,160,0.08)',   border: 'rgba(6,214,160,0.2)'   },
  complaint: { icon: '⚠️', color: '#ffd166', bg: 'rgba(255,209,102,0.08)', border: 'rgba(255,209,102,0.2)' },
  points:    { icon: '⭐', color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.2)' },
  alert:     { icon: '🚨', color: '#ef233c', bg: 'rgba(239,35,60,0.08)',   border: 'rgba(239,35,60,0.2)'   },
  info:      { icon: 'ℹ️', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)'   },
}

export default function Notifications() {
  const [notifs, setNotifs] = useState(getNotifs)

  useEffect(() => {
    const update = () => setNotifs(getNotifs())
    window.addEventListener('tpms_notif_update', update)
    return () => window.removeEventListener('tpms_notif_update', update)
  }, [])

  const markAllRead = () => {
    const updated = notifs.map(n => ({ ...n, read: true }))
    saveNotifs(updated); setNotifs(updated)
  }

  const deleteAll = () => { saveNotifs([]); setNotifs([]) }

  const markRead = (id) => {
    const updated = notifs.map(n => n.id === id ? { ...n, read: true } : n)
    saveNotifs(updated); setNotifs(updated)
  }

  const unreadCount = notifs.filter(n => !n.read).length

  return (
    <div className="page-wrap fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', boxShadow: '0 8px 24px rgba(59,130,246,0.35)', position: 'relative' }}>
              🔔
              {unreadCount > 0 && (
                <div style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#ef233c', color: 'white', borderRadius: '50%', width: '18px', height: '18px', fontSize: '10px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unreadCount}</div>
              )}
            </div>
            <div>
              <h1 className="section-header" style={{ fontSize: '26px' }}>Notifications</h1>
              <p className="section-sub">{unreadCount} unread · {notifs.length} total</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {unreadCount > 0 && <button onClick={markAllRead} className="btn btn-outline btn-sm">✓ Mark all read</button>}
            {notifs.length > 0 && <button onClick={deleteAll} className="btn btn-ghost btn-sm">🗑 Clear all</button>}
          </div>
        </div>
      </div>

      {notifs.length === 0 && (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔕</div>
          <p style={{ color: 'var(--c-text2)', fontSize: '15px' }}>No notifications yet</p>
          <p style={{ color: 'var(--c-text3)', fontSize: '13px', marginTop: '4px' }}>Booking confirmations and alerts will appear here</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {notifs.map(n => {
          const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.info
          const Wrapper = n.link ? Link : 'div'
          return (
            <Wrapper key={n.id} to={n.link || undefined}
              onClick={() => markRead(n.id)}
              style={{ textDecoration: 'none', display: 'block' }}>
              <div style={{ padding: '16px', borderRadius: '14px', background: n.read ? 'var(--c-surface)' : cfg.bg, border: `1px solid ${n.read ? 'var(--c-border)' : cfg.border}`, display: 'flex', gap: '14px', alignItems: 'flex-start', cursor: n.link ? 'pointer' : 'default', transition: 'all 0.2s' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${cfg.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0, position: 'relative' }}>
                  {cfg.icon}
                  {!n.read && <div style={{ position: 'absolute', top: '-2px', right: '-2px', width: '8px', height: '8px', borderRadius: '50%', background: cfg.color }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--c-text)', marginBottom: '3px' }}>{n.title}</div>
                  <div style={{ fontSize: '13px', color: 'var(--c-text2)', marginBottom: '4px' }}>{n.message}</div>
                  <div style={{ fontSize: '11px', color: 'var(--c-text3)', fontFamily: 'var(--font-mono)' }}>
                    {formatDistanceToNow(new Date(n.time), { addSuffix: true })}
                  </div>
                </div>
                {n.link && <span style={{ color: 'var(--c-text3)', fontSize: '16px' }}>→</span>}
              </div>
            </Wrapper>
          )
        })}
      </div>
    </div>
  )
}
