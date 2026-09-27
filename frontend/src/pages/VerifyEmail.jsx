import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import api, { errorMessage } from '../utils/api'
import { fetchMe } from '../store/slices/authSlice'
import AuthShell from '../components/common/AuthShell'

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const dispatch = useDispatch()
  const token = useSelector(s => s.auth.token)
  const [state, setState] = useState({ status: 'working', message: '' })
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return          // React StrictMode runs effects twice in development
    started.current = true
    const t = params.get('token')
    if (!t) { setState({ status: 'error', message: 'This link is incomplete.' }); return }
    api.post('/auth/verify-email', { token: t })
      .then(() => {
        setState({ status: 'done', message: 'Your email address is verified.' })
        if (token) dispatch(fetchMe())
      })
      .catch(e => setState({ status: 'error', message: errorMessage(e, 'This link is invalid or has expired.') }))
  }, [])

  return (
    <AuthShell title="Email verification">
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '36px', marginBottom: '12px' }}>
          {state.status === 'working' ? '⏳' : state.status === 'done' ? '✅' : '⚠️'}
        </p>
        <p style={{ color: 'var(--c-text)', fontSize: '14px', marginBottom: '20px' }}>
          {state.status === 'working' ? 'Verifying...' : state.message}
        </p>
        {state.status === 'error' && (
          <p style={{ color: 'var(--c-text2)', fontSize: '13px', marginBottom: '16px' }}>
            Sign in and use "Resend email" to get a new link.
          </p>
        )}
        <Link to={token ? '/' : '/login'} className="btn btn-primary">{token ? 'Continue' : 'Sign in'}</Link>
      </div>
    </AuthShell>
  )
}
