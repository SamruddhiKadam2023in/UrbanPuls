import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import api, { errorMessage } from '../utils/api'
import AuthShell from '../components/common/AuthShell'

export default function ResetPassword() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (password !== confirm) return setError(t('auth.mismatch', 'The two passwords do not match'))
    setLoading(true); setError('')
    try {
      await api.post('/auth/reset-password', { token, password })
      toast.success(t('auth.password_updated', 'Password updated. Please sign in.'))
      navigate('/login')
    } catch (err) { setError(errorMessage(err)) }
    finally { setLoading(false) }
  }

  if (!token) {
    return (
      <AuthShell title={t('auth.reset_title', 'Reset password')}>
        <p style={{ color: 'var(--c-text2)', fontSize: '14px', textAlign: 'center' }}>
          {t('auth.link_incomplete', 'This link is incomplete.')} <Link to="/forgot-password" style={{ color: 'var(--c-primary-light)' }}>{t('auth.request_new', 'Request a new one')}</Link>
        </p>
      </AuthShell>
    )
  }

  return (
    <AuthShell title={t('auth.new_password_title', 'Choose a new password')} subtitle={t('auth.password_rules', 'At least 8 characters, with a letter and a number')}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label className="label">{t('auth.new_password', 'New password')}</label>
          <input className="input" type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        <div>
          <label className="label">{t('auth.confirm_password', 'Confirm password')}</label>
          <input className="input" type="password" required value={confirm} onChange={e => setConfirm(e.target.value)} />
        </div>
        {error && <p style={{ color: '#f87171', fontSize: '13px' }}>{error}</p>}
        <button className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%' }}>
          {loading ? t('common.saving', 'Saving...') : t('auth.update_password', 'Update password')}
        </button>
      </form>
    </AuthShell>
  )
}
