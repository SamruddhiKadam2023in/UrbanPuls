// Centered card layout shared by the sign-in, sign-up and password pages
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="fade-in" style={{ width: '100%', maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', boxShadow: '0 8px 32px rgba(59,130,246,0.4)', marginBottom: '16px', fontSize: '24px' }}>🅿</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: '800', color: 'var(--c-text)' }}>{title}</h1>
          {subtitle && <p style={{ color: 'var(--c-text2)', fontSize: '13px', marginTop: '4px' }}>{subtitle}</p>}
        </div>
        <div className="card-glass" style={{ padding: '32px' }}>
          {children}
        </div>
        {footer}
      </div>
    </div>
  )
}
