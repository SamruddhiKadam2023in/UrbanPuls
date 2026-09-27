import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import api, { errorMessage } from '../utils/api'
import { fetchMe } from '../store/slices/authSlice'
import AuthShell from '../components/common/AuthShell'

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const token = useSelector(s => s.auth.token)
  const [state, setState] = useState({ status: 'working', message: '' })
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return          // React StrictMode runs effects twice in development
    started.current = true
    const linkToken = params.get('token')
    if (!linkToken) { setState({ status: 'error', message: t('auth.link_incomplete', 'This link is incomplete.') }); return }
    api.post('/auth/verify-email', { token: linkToken })
      .then(() => {
        setState({ status: 'done', message: t('auth.verified', 'Your email address is verified.') })
        if (token) dispatch(fetchMe())
      })
      .catch(e => setState({ status: 'error', message: errorMessage(e, t('auth.link_invalid', 'This link is invalid or has expired.')) }))
  }, [])

  return (
    <AuthShell title={t('auth.verify_title', 'Email verification')}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '36px', marginBottom: '12px' }}>
          {state.status === 'working' ? '⏳' : state.status === 'done' ? '✅' : '⚠️'}
        </p>
        <p style={{ color: 'var(--c-text)', fontSize: '14px', marginBottom: '20px' }}>
          {state.status === 'working' ? t('auth.verifying', 'Verifying...') : state.message}
        </p>
        {state.status === 'error' && (
          <p style={{ color: 'var(--c-text2)', fontSize: '13px', marginBottom: '16px' }}>
            {t('auth.verify_retry', 'Sign in and use "Resend email" to get a new link.')}
          </p>
        )}
        <Link to={token ? '/' : '/login'} className="btn btn-primary">{token ? t('common.continue', 'Continue →') : t('auth.sign_in', 'Sign in')}</Link>
      </div>
    </AuthShell>
  )
}
