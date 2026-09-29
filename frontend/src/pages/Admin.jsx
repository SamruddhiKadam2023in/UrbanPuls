import { useCallback, useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import api, { errorMessage } from '../utils/api'
import { fmtDateTime } from '../utils/format'

const ROLES = ['user', 'vendor', 'police', 'admin']

function CreateStaff({ onCreated }) {
  const { t } = useTranslation()
  const empty = { name: '', email: '', phone: '', password: '', role: 'police' }
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/admin/users', { ...form, phone: form.phone || null })
      toast.success(t('admin.created', 'Account created. Share the password with them securely.'))
      setForm(empty); onCreated()
    } catch (err) { toast.error(errorMessage(err)) }
    finally { setSaving(false) }
  }
  return (
    <form onSubmit={submit} className="card" style={{ padding: '24px', maxWidth: '520px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <p style={{ fontSize: '13px', color: 'var(--c-text2)' }}>{t('admin.create_hint', 'Staff accounts are created here, never through public sign-up. They are marked as verified.')}</p>
      <div><label className="label">{t('auth.name', 'Full name')}</label><input className="input" required value={form.name} onChange={set('name')} /></div>
      <div><label className="label">{t('auth.email', 'Email')}</label><input className="input" type="email" required value={form.email} onChange={set('email')} /></div>
      <div><label className="label">{t('auth.phone', 'Phone')}</label><input className="input" type="tel" value={form.phone} onChange={set('phone')} /></div>
      <div>
        <label className="label">{t('admin.temp_password', 'Temporary password')}</label>
        <input className="input" required minLength={8} value={form.password} onChange={set('password')} autoComplete="new-password" />
        <p style={{ fontSize: '11px', color: 'var(--c-text3)', marginTop: '4px' }}>{t('admin.temp_password_hint', 'They can change it with "Forgot password".')}</p>
      </div>
      <div>
        <label className="label">{t('admin.role', 'Role')}</label>
        <select className="input" value={form.role} onChange={set('role')}>
          {ROLES.map(r => <option key={r} value={r}>{t(`roles.${r}`, r)}</option>)}
        </select>
      </div>
      <button className="btn btn-primary" disabled={saving}>{saving ? t('common.saving', 'Saving...') : t('admin.create', 'Create account')}</button>
    </form>
  )
}

export default function Admin() {
  const { t } = useTranslation()
  const me = useSelector(s => s.auth.user)
  const [tab, setTab] = useState('users')
  const [users, setUsers] = useState([])
  const [requests, setRequests] = useState([])
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')

  const loadUsers = useCallback(() => {
    api.get('/admin/users', { params: { search: search || undefined, role: role || undefined } })
      .then(r => setUsers(r.data)).catch(e => toast.error(errorMessage(e)))
  }, [search, role])

  const loadRequests = () => api.get('/admin/users', { params: { vendor_requested: true } }).then(r => setRequests(r.data)).catch(() => {})

  useEffect(() => { const id = setTimeout(loadUsers, 250); return () => clearTimeout(id) }, [loadUsers])
  useEffect(() => { loadRequests() }, [])

  const update = async (u, body, msg) => {
    try {
      await api.patch(`/admin/users/${u.id}`, body)
      toast.success(msg)
      loadUsers(); loadRequests()
    } catch (e) { toast.error(errorMessage(e)) }
  }

  const tabs = [['users', `👥 ${t('admin.users', 'Users')}`], ['requests', `🏢 ${t('admin.requests', 'Partner requests')} (${requests.length})`], ['create', `➕ ${t('admin.create_staff', 'Create staff account')}`]]

  return (
    <div className="page-wrap fade-in">
      <div className="page-header">
        <h1 className="section-header" style={{ fontSize: '26px' }}>🛡 {t('admin.title', 'Administration')}</h1>
        <p className="section-sub">{t('admin.subtitle', 'Accounts, roles and Parking Partner approvals')}</p>
      </div>

      <div style={{ display: 'flex', gap: '4px', background: 'var(--c-bg2)', padding: '4px', borderRadius: '12px', marginBottom: '20px', width: 'fit-content', flexWrap: 'wrap' }}>
        {tabs.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className="btn btn-sm"
            style={{ background: tab === k ? 'var(--c-surface2)' : 'transparent', color: tab === k ? 'var(--c-text)' : 'var(--c-text2)', border: 'none' }}>{l}</button>
        ))}
      </div>

      {tab === 'users' && (
        <>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
            <input className="input" style={{ flex: 1, minWidth: '200px' }} placeholder={t('admin.search', 'Search name or email')} value={search} onChange={e => setSearch(e.target.value)} />
            <select className="input" style={{ width: 'auto' }} value={role} onChange={e => setRole(e.target.value)}>
              <option value="">{t('admin.all_roles', 'All roles')}</option>
              {ROLES.map(r => <option key={r} value={r}>{t(`roles.${r}`, r)}</option>)}
            </select>
          </div>
          <div className="card" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--c-text3)', fontSize: '11px', textTransform: 'uppercase' }}>
                  {[t('admin.col_user', 'User'), t('admin.role', 'Role'), t('admin.col_status', 'Status'), t('admin.col_joined', 'Joined'), ''].map((h, i) => <th key={i} style={{ padding: '12px 14px', borderBottom: '1px solid var(--c-border)' }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--c-border)', opacity: u.is_active ? 1 : 0.55 }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ color: 'var(--c-text)', fontWeight: 600 }}>{u.name}</div>
                      <div style={{ color: 'var(--c-text3)', fontSize: '12px' }}>{u.email}{!u.email_verified && ` · ${t('admin.unverified', 'unverified')}`}</div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {u.role === 'attendant'
                        ? <span className="badge badge-blue">{t('roles.attendant', 'Gate Attendant')}</span>
                        : (
                          <select className="input" style={{ padding: '6px 8px', width: 'auto' }} value={u.role} disabled={u.id === me?.id}
                            onChange={e => update(u, { role: e.target.value }, t('admin.role_changed', 'Role updated'))}>
                            {ROLES.map(r => <option key={r} value={r}>{t(`roles.${r}`, r)}</option>)}
                          </select>
                        )}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>{u.is_active ? t('admin.active', 'Active') : t('admin.disabled', 'Disabled')}</span>
                      {u.vendor_requested && <span className="badge badge-yellow" style={{ marginLeft: '6px' }}>{t('admin.wants_vendor', 'Wants to be a partner')}</span>}
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--c-text3)', fontSize: '12px' }}>{fmtDateTime(u.created_at)}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      {u.id !== me?.id && (
                        <button className={`btn btn-sm ${u.is_active ? 'btn-ghost' : 'btn-accent'}`}
                          onClick={() => (u.is_active ? confirm(t('admin.disable_confirm', 'Disable {{name}}? They will be signed out and cannot log in.', { name: u.name })) : true)
                            && update(u, { is_active: !u.is_active }, u.is_active ? t('admin.user_disabled', 'Account disabled') : t('admin.user_enabled', 'Account enabled'))}>
                          {u.is_active ? t('admin.disable', 'Disable') : t('admin.enable', 'Enable')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && <tr><td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: 'var(--c-text3)' }}>{t('admin.no_users', 'No users found')}</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'requests' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {requests.length === 0 && <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--c-text2)' }}>{t('admin.no_requests', 'No Parking Partner requests waiting.')}</div>}
          {requests.map(u => (
            <div key={u.id} className="card" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <div style={{ fontWeight: 600, color: 'var(--c-text)' }}>{u.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--c-text2)' }}>{u.email}{u.phone ? ` · ${u.phone}` : ''}</div>
                {!u.email_verified && <span className="badge badge-yellow" style={{ marginTop: '6px' }}>{t('admin.email_unverified', 'Email not verified')}</span>}
              </div>
              <button onClick={() => update(u, { role: 'vendor' }, t('admin.approved', '{{name}} is now a Parking Partner', { name: u.name }))} className="btn btn-accent btn-sm">{t('admin.approve', 'Approve')}</button>
              <button onClick={() => update(u, { vendor_requested: false }, t('admin.declined', 'Request declined'))} className="btn btn-ghost btn-sm">{t('admin.decline', 'Decline')}</button>
            </div>
          ))}
        </div>
      )}

      {tab === 'create' && <CreateStaff onCreated={loadUsers} />}
    </div>
  )
}
