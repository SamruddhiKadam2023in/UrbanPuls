import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { register } from '../store/slices/authSlice'

export default function Register() {
  const dispatch  = useDispatch()
  const navigate  = useNavigate()
  const { t }     = useTranslation()
  const { loading } = useSelector(s => s.auth)
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', role: 'user' })

  const handleSubmit = async (e) => {
    e.preventDefault()
    const res = await dispatch(register(form))
    if (res.meta.requestStatus === 'fulfilled') { toast.success('Account created! Please sign in.'); navigate('/login') }
    else toast.error(res.payload || 'Registration failed')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', position: 'relative', overflow: 'hidden' }}>
      <div className="fade-in" style={{ width: '100%', maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, #f72585, #7209b7)', boxShadow: '0 8px 32px rgba(247,37,133,0.35)', marginBottom: '16px', fontSize: '24px' }}>🅿</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: '800', color: 'var(--c-text)' }}><span className="gradient-text-pink">{t('auth.register_title')}</span></h1>
          <p style={{ color: 'var(--c-text2)', fontSize: '13px', marginTop: '4px' }}>{t('auth.register_sub')}</p>
        </div>
        <div className="card-glass" style={{ padding: '32px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              { key: 'name',     label: t('auth.name'),     type: 'text',     ph: 'John Doe',          req: true  },
              { key: 'email',    label: t('auth.email'),    type: 'email',    ph: 'you@example.com',   req: true  },
              { key: 'phone',    label: t('auth.phone'),    type: 'tel',      ph: '+91 98765 43210',   req: false },
              { key: 'password', label: t('auth.password'), type: 'password', ph: '••••••••',          req: true  },
            ].map(f => (
              <div key={f.key}>
                <label className="label">{f.label}</label>
                <input className="input" type={f.type} required={f.req} placeholder={f.ph} value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
              </div>
            ))}
            <div>
              <label className="label">{t('auth.role')}</label>
              <select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                <option value="user">{t('auth.user_role')}</option>
                <option value="vendor">{t('auth.vendor_role')}</option>
              </select>
            </div>
            <button className="btn btn-lg" type="submit" disabled={loading} style={{ width: '100%', marginTop: '4px', background: 'linear-gradient(135deg, #f72585, #7209b7)', color: 'white', boxShadow: '0 4px 20px rgba(247,37,133,0.35)' }}>
              {loading ? t('auth.creating') : t('auth.create_btn')}
            </button>
          </form>
          <hr className="divider" style={{ margin: '20px 0' }} />
          <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--c-text2)' }}>
            {t('auth.have_account')}{' '}<Link to="/login" style={{ color: 'var(--c-primary-light)', fontWeight: '600', textDecoration: 'none' }}>{t('auth.sign_in_link')}</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
