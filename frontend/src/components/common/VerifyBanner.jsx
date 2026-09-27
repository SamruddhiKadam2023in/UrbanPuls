import { useState } from 'react'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import api, { errorMessage } from '../../utils/api'

export default function VerifyBanner() {
  const user = useSelector(s => s.auth.user)
  const [sending, setSending] = useState(false)

  if (!user || user.email_verified) return null

  const resend = async () => {
    setSending(true)
    try {
      await api.post('/auth/resend-verification')
      toast.success(`Verification email sent to ${user.email}`)
    } catch (e) { toast.error(errorMessage(e)) }
    finally { setSending(false) }
  }

  return (
    <div style={{ background: 'rgba(255,209,102,0.1)', borderBottom: '1px solid rgba(255,209,102,0.3)', padding: '10px 20px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '13px', color: '#ffd166' }}>
          ✉️ Please verify your email address to book parking and report issues.
        </span>
        <button onClick={resend} disabled={sending} className="btn btn-sm"
          style={{ background: 'rgba(255,209,102,0.2)', color: '#ffd166', border: '1px solid rgba(255,209,102,0.4)' }}>
          {sending ? 'Sending...' : 'Resend email'}
        </button>
      </div>
    </div>
  )
}
