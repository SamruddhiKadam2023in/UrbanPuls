import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api, { errorMessage } from '../utils/api'
import AuthShell from '../components/common/AuthShell'

export default function ForgotPassword() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
    } catch (err) { setError(errorMessage(err)) }
    finally { setLoading(false) }
  }

  return (
    <AuthShell title={t('auth.reset_title', 'Reset password')} subtitle={t('auth.reset_sub', "We'll email you a link to choose a new password")}>
      {sent ? (
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '32px', marginBottom: '12px' }}>📬</p>
          <p style={{ color: 'var(--c-text)', fontSize: '14px', marginBottom: '6px' }}>{t('auth.check_inbox', 'Check your inbox')}</p>
          <p style={{ color: 'var(--c-text2)', fontSize: '13px', lineHeight: 1.6 }}>
            {t('auth.reset_sent', 'If an account exists for {{email}}, a reset link is on its way. It is valid for 30 minutes.', { email })}
          </p>
          <Link to="/login" className="btn btn-outline" style={{ marginTop: '20px' }}>{t('auth.back_to_sign_in', 'Back to sign in')}</Link>
        </div>
      ) : (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="label">{t('auth.email', 'Email address')}</label>
            <input className="input" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          {error && <p style={{ color: '#f87171', fontSize: '13px' }}>{error}</p>}
          <button className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%' }}>
            {loading ? t('common.sending', 'Sending...') : t('auth.send_link', 'Send reset link')}
          </button>
          <p style={{ textAlign: 'center', fontSize: '13px' }}>
            <Link to="/login" style={{ color: 'var(--c-primary-light)', textDecoration: 'none' }}>← {t('auth.back_to_sign_in', 'Back to sign in')}</Link>
          </p>
        </form>
      )}
    </AuthShell>
  )
}
