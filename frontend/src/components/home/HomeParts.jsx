import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'

export function Greeting({ subtitle }) {
  const { t } = useTranslation()
  const user = useSelector(s => s.auth.user)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? t('greeting.morning') : hour < 18 ? t('greeting.afternoon') : t('greeting.evening')
  return (
    <div style={{ marginBottom: '24px' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '30px', fontWeight: 800, color: 'var(--c-text)', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
        {greeting}, <span className="gradient-text">{user?.name?.split(' ')[0]}</span>
      </h1>
      {subtitle && <p style={{ color: 'var(--c-text2)', fontSize: '14px', marginTop: '6px' }}>{subtitle}</p>}
    </div>
  )
}

export function Tile({ label, value, color = 'var(--c-text)', to, hint }) {
  const body = (
    <div className="card" style={{ padding: '18px', height: '100%' }}>
      <div className="stat-num" style={{ color }}>{value}</div>
      <div className="stat-label">{label}</div>
      {hint && <div style={{ fontSize: '11px', color: 'var(--c-text3)', marginTop: '6px' }}>{hint}</div>}
    </div>
  )
  return to ? <Link to={to} style={{ textDecoration: 'none' }}>{body}</Link> : body
}

export function Tiles({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px' }}>{children}</div>
}

export function Section({ title, action, children }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '12px' }}>
        <h2 className="section-header" style={{ fontSize: '16px' }}>{title}</h2>
        {action}
      </div>
      {children}
    </div>
  )
}

export function Empty({ children }) {
  return <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--c-text3)', fontSize: '13px' }}>{children}</div>
}

/** A row that links to where the work gets done */
export function ActionRow({ to, icon, title, detail, badge, badgeClass = 'badge-yellow' }) {
  return (
    <Link to={to} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
      <span style={{ fontSize: '20px' }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--c-text)' }}>{title}</div>
        {detail && <div style={{ fontSize: '12px', color: 'var(--c-text2)' }}>{detail}</div>}
      </div>
      {badge != null && <span className={`badge ${badgeClass}`}>{badge}</span>}
      <span style={{ color: 'var(--c-text3)' }}>→</span>
    </Link>
  )
}
