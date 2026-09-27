import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import i18n from '../i18n'
import api, { errorMessage } from '../utils/api'
import { tokenReplaced, userUpdated } from '../store/slices/authSlice'

const LANGS = [
  { code: 'en', label: 'English', emoji: '🇬🇧' },
  { code: 'hi', label: 'हिंदी',   emoji: '🇮🇳' },
  { code: 'mr', label: 'मराठी',   emoji: '🟠'  },
]

const sectionTitle = { fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 600, marginBottom: '16px', color: 'var(--c-text)' }
const hint = { fontSize: '12px', color: 'var(--c-text3)', lineHeight: 1.5 }

function DetailsForm({ user }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [form, setForm] = useState({ name: user.name, phone: user.phone || '' })
  const [saving, setSaving] = useState(false)
  const changed = form.name.trim() !== user.name || form.phone.trim() !== (user.phone || '')

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await api.patch('/auth/me', { name: form.name, phone: form.phone })
      dispatch(userUpdated(res.data))
      setForm({ name: res.data.name, phone: res.data.phone || '' })
      toast.success(t('profile.saved', 'Details saved'))
    } catch (err) { toast.error(errorMessage(err)) }
    finally { setSaving(false) }
  }

  return (
    <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div>
        <label className="label">{t('profile.name')}</label>
        <input className="input" required maxLength={100} autoComplete="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
      </div>
      <div>
        <label className="label">{t('profile.phone')}</label>
        <input className="input" type="tel" autoComplete="tel" placeholder="+91 98765 43210" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
      </div>
      <button className="btn btn-primary" disabled={saving || !changed || !form.name.trim()} style={{ alignSelf: 'flex-start' }}>
        {saving ? t('common.saving') : t('common.save')}
      </button>
    </form>
  )
}

function EmailForm({ user }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ new_email: '', password: '' })
  const [saving, setSaving] = useState(false)

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await api.post('/auth/change-email', form)
      dispatch(userUpdated(res.data))
      toast.success(t('profile.email_changed', 'Email changed. Check {{email}} for a verification link.', { email: res.data.email }), { duration: 6000 })
      setForm({ new_email: '', password: '' }); setOpen(false)
    } catch (err) { toast.error(errorMessage(err)) }
    finally { setSaving(false) }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: '14px', color: 'var(--c-text)', fontWeight: 500 }}>{user.email}</p>
          <span className={`badge ${user.email_verified ? 'badge-green' : 'badge-yellow'}`} style={{ marginTop: '4px' }}>
            {user.email_verified ? `✓ ${t('profile.verified', 'Verified')}` : t('profile.not_verified', 'Not verified')}
          </span>
        </div>
        {!open && <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>{t('profile.change_email', 'Change email')}</button>}
      </div>
      {open && (
        <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '14px' }}>
          <div>
            <label className="label">{t('profile.new_email', 'New email')}</label>
            <input className="input" type="email" required autoComplete="email" value={form.new_email} onChange={e => setForm({ ...form, new_email: e.target.value })} />
          </div>
          <div>
            <label className="label">{t('profile.current_password', 'Current password')}</label>
            <input className="input" type="password" required autoComplete="current-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </div>
          <p style={hint}>{t('profile.email_hint', "We'll send a verification link to the new address and let your old address know about the change.")}</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-primary" disabled={saving}>{saving ? t('common.saving') : t('profile.change_email', 'Change email')}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>{t('common.cancel')}</button>
          </div>
        </form>
      )}
    </div>
  )
}

function PasswordForm() {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '' })
  const [saving, setSaving] = useState(false)

  const save = async (e) => {
    e.preventDefault()
    if (form.new_password !== form.confirm) return toast.error(t('auth.mismatch'))
    setSaving(true)
    try {
      const res = await api.post('/auth/change-password', { current_password: form.current_password, new_password: form.new_password })
      dispatch(tokenReplaced(res.data.access_token))
      toast.success(t('profile.password_changed', 'Password changed. You have been signed out on your other devices.'), { duration: 6000 })
      setForm({ current_password: '', new_password: '', confirm: '' }); setOpen(false)
    } catch (err) { toast.error(errorMessage(err)) }
    finally { setSaving(false) }
  }

  if (!open) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <p style={hint}>{t('profile.password_hint', 'Changing your password signs you out on every other device.')}</p>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>{t('profile.change_password', 'Change password')}</button>
      </div>
    )
  }
  return (
    <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div>
        <label className="label">{t('profile.current_password', 'Current password')}</label>
        <input className="input" type="password" required autoComplete="current-password" value={form.current_password} onChange={e => setForm({ ...form, current_password: e.target.value })} />
      </div>
      <div>
        <label className="label">{t('auth.new_password')}</label>
        <input className="input" type="password" required minLength={8} autoComplete="new-password" value={form.new_password} onChange={e => setForm({ ...form, new_password: e.target.value })} />
        <p style={{ ...hint, marginTop: '4px' }}>{t('auth.password_rules')}</p>
      </div>
      <div>
        <label className="label">{t('auth.confirm_password')}</label>
        <input className="input" type="password" required autoComplete="new-password" value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} />
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button className="btn btn-primary" disabled={saving}>{saving ? t('common.saving') : t('profile.change_password', 'Change password')}</button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>{t('common.cancel')}</button>
      </div>
    </form>
  )
}

export default function Profile() {
  const { t } = useTranslation()
  const user  = useSelector(s => s.auth.user)

  const switchLang = async (code) => {
    i18n.changeLanguage(code)
    localStorage.setItem('lang', code)
    try { await api.patch(`/auth/language?lang=${code}`) } catch {}
    toast.success(t('profile.lang_changed', 'Language changed'))
  }

  if (!user) return null

  const ROLE_CONFIG = {
    admin:  { label: t('profile.roles.admin'),  badge: 'badge-pink',   emoji: '👑' },
    vendor: { label: t('profile.roles.vendor'), badge: 'badge-yellow', emoji: '🏢' },
    police: { label: t('roles.police'),         badge: 'badge-blue',   emoji: '🚓' },
    user:   { label: t('profile.roles.user'),   badge: 'badge-blue',   emoji: '👤' },
  }
  const rc = ROLE_CONFIG[user.role] || ROLE_CONFIG.user

  return (
    <div className="page-wrap fade-in">
      <div style={{ maxWidth: '560px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="card" style={{ padding: '28px', textAlign: 'center' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #06d6a0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: 800, color: 'white', margin: '0 auto 14px', fontFamily: 'var(--font-display)' }}>
            {user.name?.[0]?.toUpperCase()}
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, color: 'var(--c-text)', marginBottom: '8px' }}>{user.name}</h2>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <span className={`badge ${rc.badge}`}>{rc.emoji} {rc.label}</span>
            {user.points > 0 && <span className="badge badge-purple">⭐ {user.points} {t('profile.points')}</span>}
            {user.vendor_requested && <span className="badge badge-yellow">{t('profile.vendor_pending', 'Partner request pending')}</span>}
          </div>
          <p style={{ ...hint, marginTop: '10px' }}>{t('profile.role_hint', 'Your role is set by an administrator.')}</p>
        </div>

        <div className="card" style={{ padding: '24px' }}>
          <h3 style={sectionTitle}>{t('profile.title')}</h3>
          <DetailsForm user={user} />
        </div>

        <div className="card" style={{ padding: '24px' }}>
          <h3 style={sectionTitle}>📧 {t('profile.email')}</h3>
          <EmailForm user={user} />
        </div>

        <div className="card" style={{ padding: '24px' }}>
          <h3 style={sectionTitle}>🔒 {t('auth.password')}</h3>
          <PasswordForm />
        </div>

        <div className="card" style={{ padding: '24px' }}>
          <h3 style={sectionTitle}>🌐 {t('profile.lang')}</h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {LANGS.map(l => (
              <button key={l.code} onClick={() => switchLang(l.code)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '12px', border: `2px solid ${i18n.language === l.code ? 'var(--c-primary)' : 'var(--c-border)'}`, background: i18n.language === l.code ? 'rgba(59,130,246,0.12)' : 'var(--c-bg2)', color: i18n.language === l.code ? '#60a5fa' : 'var(--c-text)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: i18n.language === l.code ? 600 : 400 }}>
                <span style={{ fontSize: '18px' }}>{l.emoji}</span>
                {l.label}
                {i18n.language === l.code && <span style={{ color: '#06d6a0', marginLeft: '4px' }}>✓</span>}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
