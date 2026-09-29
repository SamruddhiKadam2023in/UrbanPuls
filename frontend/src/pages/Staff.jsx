import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import api, { errorMessage } from '../utils/api'
import { fmtDateTime } from '../utils/format'

function AddStaff({ onAdded }) {
  const { t } = useTranslation()
  const empty = { name: '', email: '', phone: '', password: '' }
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/vendors/staff', { ...form, phone: form.phone || null })
      toast.success(t('staff.added', '{{name}} can now sign in and use the Gate screen', { name: form.name }), { duration: 6000 })
      setForm(empty); onAdded()
    } catch (err) { toast.error(errorMessage(err)) }
    finally { setSaving(false) }
  }

  return (
    <form onSubmit={submit} className="card" style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', alignItems: 'end' }}>
      <div><label className="label">{t('auth.name', 'Full name')}</label><input className="input" required maxLength={100} value={form.name} onChange={set('name')} /></div>
      <div><label className="label">{t('auth.email', 'Email')}</label><input className="input" type="email" required value={form.email} onChange={set('email')} /></div>
      <div><label className="label">{t('auth.phone', 'Phone')}</label><input className="input" type="tel" value={form.phone} onChange={set('phone')} /></div>
      <div>
        <label className="label">{t('admin.temp_password', 'Temporary password')}</label>
        <input className="input" required minLength={8} autoComplete="new-password" value={form.password} onChange={set('password')} />
      </div>
      <button className="btn btn-primary" disabled={saving}>{saving ? t('common.saving', 'Saving...') : `+ ${t('staff.add', 'Add attendant')}`}</button>
    </form>
  )
}

export default function Staff() {
  const { t } = useTranslation()
  const [staff, setStaff] = useState([])
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(() => {
    api.get('/vendors/staff').then(r => { setStaff(r.data); setLoaded(true) }).catch(e => toast.error(errorMessage(e)))
  }, [])
  useEffect(() => { load() }, [load])

  const update = async (s, body, msg) => {
    try { await api.patch(`/vendors/staff/${s.id}`, body); toast.success(msg); load() }
    catch (e) { toast.error(errorMessage(e)) }
  }

  const resetPassword = (s) => {
    const pwd = prompt(t('staff.new_password_prompt', 'New temporary password for {{name}} (at least 8 characters, with a letter and a number):', { name: s.name }))
    if (pwd) update(s, { password: pwd }, t('staff.password_reset', 'Password changed. {{name}} has been signed out and must use the new password.', { name: s.name }))
  }

  return (
    <div className="page-wrap fade-in">
      <div className="page-header">
        <h1 className="section-header" style={{ fontSize: '26px' }}>👥 {t('staff.title', 'Gate staff')}</h1>
        <p className="section-sub">{t('staff.subtitle', 'Attendants sign in with their own account. They can only use the Gate screen for your lots: no prices, lots or reports.')}</p>
      </div>

      <div style={{ marginBottom: '20px' }}><AddStaff onAdded={load} /></div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {loaded && staff.length === 0 && (
          <div className="card" style={{ padding: '32px', textAlign: 'center', color: 'var(--c-text2)' }}>
            {t('staff.none', 'No attendants yet. Add the people who work at your gates.')}
          </div>
        )}
        {staff.map(s => (
          <div key={s.id} className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', opacity: s.is_active ? 1 : 0.6 }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #06d6a0, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700 }}>
              {s.name?.[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: '180px' }}>
              <div style={{ fontWeight: 600, color: 'var(--c-text)' }}>{s.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--c-text2)' }}>{s.email}{s.phone ? ` · ${s.phone}` : ''}</div>
              <div style={{ fontSize: '11px', color: 'var(--c-text3)' }}>{t('staff.added_on', 'Added {{date}}', { date: fmtDateTime(s.created_at) })}</div>
            </div>
            <span className={`badge ${s.is_active ? 'badge-green' : 'badge-red'}`}>{s.is_active ? t('admin.active', 'Active') : t('admin.disabled', 'Disabled')}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => resetPassword(s)}>🔑 {t('staff.reset_password', 'New password')}</button>
            <button className={`btn btn-sm ${s.is_active ? 'btn-ghost' : 'btn-accent'}`}
              onClick={() => (s.is_active ? confirm(t('staff.disable_confirm', 'Remove gate access for {{name}}? They are signed out immediately.', { name: s.name })) : true)
                && update(s, { is_active: !s.is_active }, s.is_active ? t('admin.user_disabled', 'Account disabled') : t('admin.user_enabled', 'Account enabled'))}>
              {s.is_active ? t('admin.disable', 'Disable') : t('admin.enable', 'Enable')}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
