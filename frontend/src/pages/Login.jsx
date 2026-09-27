import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { login, clearError } from '../store/slices/authSlice'
import AuthShell from '../components/common/AuthShell'

// Demo accounts exist only in development databases (seed.py refuses to run in production)
const DEMO_ACCOUNTS = import.meta.env.DEV ? [
  ['Admin',  'admin@tpms.com',  'admin123'],
  ['Vendor', 'vendor@tpms.com', 'vendor123'],
  ['User',   'user@tpms.com',   'user123'],
  ['Police', 'police@tpms.com', 'police123'],
] : []

export default function Login() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { t }    = useTranslation()
  const { loading, error, token } = useSelector(s => s.auth)
  const [form, setForm] = useState({ email: '', password: '' })
  const [show, setShow] = useState(false)

  useEffect(() => { if (token) navigate('/') }, [token])
  useEffect(() => { if (error) { toast.error(error); dispatch(clearError()) } }, [error])

  const handleSubmit = (e) => { e.preventDefault(); dispatch(login(form)) }

  const demo = DEMO_ACCOUNTS.length > 0 && (
    <div style={{ marginTop: '16px', padding: '14px 16px', background: 'rgba(6,214,160,0.06)', border: '1px solid rgba(6,214,160,0.15)', borderRadius: '12px' }}>
      <p style={{ fontSize: '11px', fontWeight: '600', color: 'var(--c-accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>{t('auth.demo')} (development only)</p>
      {DEMO_ACCOUNTS.map(([role, email, pwd]) => (
        <div key={role} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '12px', color: 'var(--c-text2)' }}>{role}</span>
          <button onClick={() => setForm({ email, password: pwd })} style={{ fontSize: '12px', color: 'var(--c-primary-light)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>{email}</button>
        </div>
      ))}
    </div>
  )

  return (
    <AuthShell title={<span className="gradient-text">TPMS</span>} subtitle={t('app.full_name', 'Traffic & Parking Management System')} footer={demo}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', color: 'var(--c-text)' }}>{t('auth.login_title')}</h2>
        <p style={{ color: 'var(--c-text2)', fontSize: '13px', marginTop: '4px' }}>{t('auth.login_sub')}</p>
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
