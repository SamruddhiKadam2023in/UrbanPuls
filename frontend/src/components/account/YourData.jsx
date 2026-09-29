import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import api, { errorMessage } from '../../utils/api'
import { logout } from '../../store/slices/authSlice'

const hint = { fontSize: '12px', color: 'var(--c-text3)', lineHeight: 1.5 }

export default function YourData() {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)
  const word = t('privacy_ui.confirm_word', 'DELETE')

  const download = async () => {
    try {
      const res = await api.get('/auth/me/export', { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a'); a.href = url; a.download = 'tpms-my-data.json'; a.click()
      URL.revokeObjectURL(url)
    } catch (e) { toast.error(errorMessage(e)) }
  }

  const remove = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.delete('/auth/me', { data: { password } })
      dispatch(logout())
      toast.success(t('privacy_ui.deleted', 'Your account has been deleted.'), { duration: 6000 })
      navigate('/')
    } catch (err) { toast.error(errorMessage(err)) }
    finally { setBusy(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <p style={hint}>{t('privacy_ui.download_hint', 'A copy of your account details, bookings, complaints, ratings and notifications.')}</p>
        <button className="btn btn-ghost btn-sm" onClick={download}>⬇ {t('privacy_ui.download', 'Download my data')}</button>
      </div>
      <hr className="divider" />
      {!open ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <p style={hint}>{t('privacy_ui.delete_hint', 'Removes your name, email and phone and closes the account. Past parking records stay without your details, because Parking Partners need them for their accounts.')}</p>
          <button className="btn btn-danger btn-sm" onClick={() => setOpen(true)}>{t('privacy_ui.delete', 'Delete account')}</button>
        </div>
      ) : (
        <form onSubmit={remove} style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '14px', borderRadius: '12px', border: '1px solid rgba(239,35,60,0.35)', background: 'rgba(239,35,60,0.06)' }}>
          <p style={{ fontSize: '13px', color: '#f87171', fontWeight: 600 }}>{t('privacy_ui.warning', 'This cannot be undone. Upcoming reservations are cancelled and your reward points are lost.')}</p>
          <div>
            <label className="label">{t('profile.current_password', 'Current password')}</label>
            <input className="input" type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <div>
            <label className="label">{t('privacy_ui.type_to_confirm', 'Type {{word}} to confirm', { word })}</label>
            <input className="input" required value={confirmText} onChange={e => setConfirmText(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-danger" disabled={busy || confirmText.trim() !== word}>{busy ? t('common.saving', 'Saving...') : t('privacy_ui.delete_forever', 'Delete my account')}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>{t('common.cancel', 'Cancel')}</button>
          </div>
        </form>
      )}
    </div>
  )
}
