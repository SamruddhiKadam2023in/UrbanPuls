import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { register } from '../store/slices/authSlice'
import AuthShell from '../components/common/AuthShell'

export default function Register() {
  const dispatch  = useDispatch()
  const navigate  = useNavigate()
  const { t }     = useTranslation()
  const { loading } = useSelector(s => s.auth)
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', account_type: 'user' })

  const handleSubmit = async (e) => {
    e.preventDefault()
    const res = await dispatch(register({ ...form, phone: form.phone || null }))
    if (res.meta.requestStatus === 'fulfilled') {
      toast.success(res.payload.message, { duration: 6000 })
      navigate('/login')
    } else toast.error(res.payload || 'Registration failed')
  }

  return (
    <AuthShell title={<span className="gradient-text-pink">{t('auth.register_title')}</span>} subtitle={t('auth.register_sub')}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {[
          { key: 'name',     label: t('auth.name'),     type: 'text',     ph: t('auth.name', 'Full name'),         req: true,  ac: 'name' },
          { key: 'email',    label: t('auth.email'),    type: 'email',    ph: 'you@example.com',   req: true,  ac: 'email' },
          { key: 'phone',    label: t('auth.phone'),    type: 'tel',      ph: '+91 98765 43210',   req: false, ac: 'tel' },
          { key: 'password', label: t('auth.password'), type: 'password', ph: '••••••••',          req: true,  ac: 'new-password' },
        ].map(f => (
          <div key={f.key}>
            <label className="label">{f.label}</label>
            <input className="input" type={f.type} required={f.req} autoComplete={f.ac} placeholder={f.ph} value={form[f.key]}
              minLength={f.key === 'password' ? 8 : undefined}
              onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
            {f.key === 'password' && <p style={{ fontSize: '11px', color: 'var(--c-text3)', marginTop: '4px' }}>{t('auth.password_rules', 'At least 8 characters, with a letter and a number')}</p>}
          </div>
        ))}
        <div>
          <label className="label">{t('auth.role')}</label>
          <select className="input" value={form.account_type} onChange={e => setForm({ ...form, account_type: e.target.value })}>
            <option value="user">{t('auth.user_role')}</option>
            <option value="vendor">{t('auth.vendor_role')} ({t('auth.needs_approval', 'needs approval')})</option>
          </select>
          {form.account_type === 'vendor' && (
            <p style={{ fontSize: '11px', color: 'var(--c-text3)', marginTop: '4px' }}>
              {t('auth.vendor_hint', 'You can use the app as a regular user until an administrator approves your vendor account.')}
            </p>
          )}
        </div>
        <button className="btn btn-lg" type="submit" disabled={loading} style={{ width: '100%', marginTop: '4px', background: 'linear-gradient(135deg, #f72585, #7209b7)', color: 'white', boxShadow: '0 4px 20px rgba(247,37,133,0.35)' }}>
          {loading ? t('auth.creating') : t('auth.create_btn')}
        </button>
      </form>
      <hr className="divider" style={{ margin: '20px 0' }} />
      <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--c-text2)' }}>
        {t('auth.have_account')}{' '}<Link to="/login" style={{ color: 'var(--c-primary-light)', fontWeight: '600', textDecoration: 'none' }}>{t('auth.sign_in_link')}</Link>
      </p>
    </AuthShell>
  )
}
