import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { login, clearError } from '../store/slices/authSlice'
import AuthShell from '../components/common/AuthShell'
import { homeFor } from '../utils/roles'

// Demo accounts exist only in development databases (seed.py refuses to run in production).
// The buttons show in `npm run dev`, or in a build made with VITE_SHOW_DEMO_LOGINS=true (local Docker only).
const SHOW_DEMO = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO_LOGINS === 'true'
const DEMO_ACCOUNTS = SHOW_DEMO ? [
  ['user',   '🚗', 'user@urbanpuls.com',   'user123'],
  ['vendor', '🏢', 'vendor@urbanpuls.com', 'vendor123'],
  ['attendant', '🚧', 'gate@urbanpuls.com', 'gate12345'],
  ['police', '🦺', 'police@urbanpuls.com', 'police123'],
  ['admin',  '🛡', 'admin@urbanpuls.com',  'admin123'],
] : []

export default function Login() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { t }    = useTranslation()
  const { loading, error, token, user } = useSelector(s => s.auth)
  const [form, setForm] = useState({ email: '', password: '' })
  const [show, setShow] = useState(false)

  // Everyone uses the same form; the account's role decides where they land
  useEffect(() => { if (token) navigate(homeFor(user?.role), { replace: true }) }, [token])
  useEffect(() => { if (error) { toast.error(error); dispatch(clearError()) } }, [error])

  const handleSubmit = (e) => { e.preventDefault(); dispatch(login(form)) }

  const WHO = [
    { icon: '🚗', title: t('who.user_title', 'Drivers'), text: t('who.user_text', 'Create a free account and start reserving parking.'), link: '/register', cta: t('who.user_cta', 'Sign up') },
    { icon: '🏢', title: t('who.vendor_title', 'Parking Partners'), text: t('who.vendor_text', 'Own or run a parking lot? Sign up and choose "Parking Partner". Once an administrator approves you, add your lots and start taking bookings.'), link: '/register', cta: t('who.vendor_cta', 'Become a partner') },
    { icon: '🦺', title: t('who.police_title', 'Field Officers'), text: t('who.police_text', 'They act on verified complaints on the ground. Accounts are created by the UrbanPuls administrator; sign in above with the email and password they gave you.') },
    { icon: '🛡', title: t('who.admin_title', 'Administrators'), text: t('who.admin_text', 'Accounts are set up by the operator of this service. Sign in above.') },
  ]

  const footer = (
    <>
      {DEMO_ACCOUNTS.length > 0 && (
        <div style={{ marginTop: '16px', padding: '14px 16px', background: 'rgba(6,214,160,0.06)', border: '1px solid rgba(6,214,160,0.15)', borderRadius: '12px' }}>
          <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--c-accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
            {t('auth.demo_quick', 'Quick demo sign-in (development only)')}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {DEMO_ACCOUNTS.map(([role, icon, email, password]) => (
              <button key={role} type="button" disabled={loading} className="btn btn-ghost btn-sm"
                onClick={() => dispatch(login({ email, password }))}>
                {icon} {t('auth.sign_in_as', 'Sign in as {{role}}', { role: t(`roles.${role}`) })}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: '16px', padding: '18px' }}>
        <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text)', marginBottom: '12px', fontFamily: 'var(--font-display)' }}>
          {t('who.title', 'Who is UrbanPuls for?')}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {WHO.map(w => (
            <div key={w.title} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '20px', lineHeight: 1.2 }}>{w.icon}</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--c-text)' }}>{w.title}</p>
                <p style={{ fontSize: '12px', color: 'var(--c-text2)', lineHeight: 1.5 }}>{w.text}</p>
              </div>
              {w.link && <Link to={w.link} className="btn btn-outline btn-sm" style={{ flexShrink: 0 }}>{w.cta}</Link>}
            </div>
          ))}
        </div>
      </div>
    </>
  )

  return (
    <AuthShell title={<span className="gradient-text">UrbanPuls</span>} subtitle={t('app.full_name', 'Traffic & Parking Management System')} footer={footer}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', color: 'var(--c-text)' }}>{t('auth.login_title')}</h2>
        <p style={{ color: 'var(--c-text2)', fontSize: '13px', marginTop: '4px' }}>{t('auth.login_sub_all', 'One sign-in for drivers, Parking Partners, Field Officers and administrators')}</p>
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label className="label">{t('auth.email')}</label>
          <input className="input" type="email" required autoComplete="email" placeholder="you@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <label className="label">{t('auth.password')}</label>
            <Link to="/forgot-password" style={{ fontSize: '12px', color: 'var(--c-primary-light)', textDecoration: 'none' }}>{t('auth.forgot', 'Forgot password?')}</Link>
          </div>
          <div style={{ position: 'relative' }}>
            <input className="input" type={show ? 'text' : 'password'} required autoComplete="current-password" placeholder="••••••••" style={{ paddingRight: '44px' }} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
            <button type="button" onClick={() => setShow(v => !v)} aria-label={show ? t('auth.hide_password', 'Hide password') : t('auth.show_password', 'Show password')} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--c-text3)', cursor: 'pointer' }}>{show ? '🙈' : '👁'}</button>
          </div>
        </div>
        <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{ width: '100%', marginTop: '4px' }}>
          {loading ? t('auth.signing_in') : t('auth.sign_in')}
        </button>
      </form>
      <hr className="divider" style={{ margin: '20px 0' }} />
      <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--c-text2)' }}>
        {t('auth.no_account')}{' '}<Link to="/register" style={{ color: 'var(--c-primary-light)', fontWeight: '600', textDecoration: 'none' }}>{t('auth.create')}</Link>
      </p>
    </AuthShell>
  )
}
