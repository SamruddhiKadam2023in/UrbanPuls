import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { fetchMyComplaints } from '../store/slices/complaintsSlice'
import api, { errorMessage } from '../utils/api'
import { fmtDateTime } from '../utils/format'

// Labels come from complaints.types.* in the translation files
const TYPES = ['illegal_parking', 'road_blockage', 'signal_malfunction', 'accident', 'vendor_issue']
const TYPE_DEFAULTS = {
  illegal_parking: '🚫 Illegal parking', road_blockage: '🚧 Road blockage', signal_malfunction: '🚦 Signal malfunction',
  accident: '💥 Accident', vendor_issue: '🏢 Parking Partner issue',
}

const STATUS_BADGE = {
  pending:  'badge-yellow',
  verified: 'badge-green',
  rejected: 'badge-red',
  resolved: 'badge-blue',
}

export default function Complaints() {
  const dispatch = useDispatch()
  const { list, loading } = useSelector(s => s.complaints)
  const user = useSelector(s => s.auth.user)
  const { t } = useTranslation()
  const [tab, setTab] = useState('submit')
  const [form, setForm] = useState({ complaint_type: 'illegal_parking', description: '', latitude: '', longitude: '' })
  const [photo, setPhoto] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { dispatch(fetchMyComplaints()) }, [])

  const detectLocation = () => {
    if (!navigator.geolocation) return toast.error(t('map.no_geo', 'Location is not available on this device'))
    navigator.geolocation.getCurrentPosition(
      pos => { setForm(f => ({ ...f, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) })); toast.success(t('complaints.location_ok', 'Location detected')) },
      () => toast.error(t('map.geo_denied', 'Could not get your location. Check the browser permission.'))
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.latitude) return toast.error(t('complaints.need_location', 'Please detect your location first'))
    setSubmitting(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, v))
      if (photo) fd.append('photo', photo)
      await api.post('/complaints/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success(t('complaints.submitted', 'Complaint submitted'))
      setForm({ complaint_type: 'illegal_parking', description: '', latitude: '', longitude: '' })
      setPhoto(null); dispatch(fetchMyComplaints()); setTab('my')
    } catch (e) { toast.error(errorMessage(e, t('complaints.failed', 'Submission failed'))) }
    finally { setSubmitting(false) }
  }

  return (
    <div className="page-wrap fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #ffd166, #b45309)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', boxShadow: '0 8px 24px rgba(255,209,102,0.3)' }}>⚠️</div>
            <div>
              <h1 className="section-header" style={{ fontSize: '26px' }}>{t('complaints.title', 'Complaints')}</h1>
              <p className="section-sub">{t('complaints.subtitle', 'Report violations and earn reward points')}</p>
            </div>
          </div>

          {/* Points badge */}
          {user?.points > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: '12px', padding: '10px 14px' }}>
              <span style={{ fontSize: '20px' }}>⭐</span>
              <div>
                <p style={{ fontSize: '13px', fontWeight: '600', color: '#a78bfa' }}>{t('complaints.points', '{{n}} points', { n: user.points })}</p>
                <p style={{ fontSize: '11px', color: 'var(--c-text3)' }}>{t('complaints.points_value', '= ₹{{value}} discount', { value: (user.points * 0.5).toFixed(0) })}</p>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--c-text3)', maxWidth: '160px' }}>{t('complaints.points_hint', 'Use them when you reserve parking')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: 'var(--c-bg2)', padding: '4px', borderRadius: '12px', marginBottom: '24px', width: 'fit-content' }}>
        {[['submit', `✏️ ${t('complaints.submit_tab', 'Submit')}`], ['my', `📋 ${t('complaints.my_tab', 'My complaints')}`]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className="btn btn-sm"
            style={{ background: tab === k ? 'var(--c-surface2)' : 'transparent', color: tab === k ? 'var(--c-text)' : 'var(--c-text2)', border: 'none', boxShadow: tab === k ? '0 2px 8px rgba(0,0,0,0.3)' : 'none' }}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'submit' && (
        <div className="card" style={{ padding: '28px', maxWidth: '600px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label className="label">{t('complaints.type', 'Complaint type')}</label>
              <select className="input" value={form.complaint_type} onChange={e => setForm({ ...form, complaint_type: e.target.value })}>
                {TYPES.map(ty => <option key={ty} value={ty}>{t(`complaints.types.${ty}`, TYPE_DEFAULTS[ty])}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t('complaints.description', 'Description')}</label>
              <textarea className="input" rows={3} placeholder={t('complaints.desc_ph', 'Describe the issue...')} value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                style={{ resize: 'vertical', minHeight: '80px' }} />
            </div>
            <div>
              <label className="label">{t('complaints.location', 'Location (GPS)')}</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input className="input" placeholder={t('complaints.lat', 'Latitude')} value={form.latitude} readOnly style={{ flex: 1 }} />
                <input className="input" placeholder={t('complaints.lng', 'Longitude')} value={form.longitude} readOnly style={{ flex: 1 }} />
                <button type="button" onClick={detectLocation} className="btn btn-outline" style={{ flexShrink: 0 }}>📍 {t('complaints.detect', 'Detect')}</button>
              </div>
              {form.latitude && <p style={{ fontSize: '11px', color: 'var(--c-accent)', marginTop: '6px', fontFamily: 'var(--font-mono)' }}>✓ {t('complaints.captured', 'Location captured')}</p>}
            </div>
            <div>
              <label className="label">{t('complaints.photo', 'Photo evidence')}</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', border: `2px dashed ${photo ? 'var(--c-accent)' : 'var(--c-border)'}`, borderRadius: '12px', cursor: 'pointer', transition: 'border-color 0.2s', background: photo ? 'rgba(6,214,160,0.05)' : 'transparent' }}>
                <span style={{ fontSize: '24px' }}>{photo ? '✅' : '📸'}</span>
                <div>
                  <p style={{ fontSize: '13px', color: 'var(--c-text)', fontWeight: '500' }}>{photo ? photo.name : t('complaints.upload', 'Click to upload photo/video')}</p>
                  <p style={{ fontSize: '11px', color: 'var(--c-text3)', marginTop: '2px' }}>{t('complaints.photo_sub', 'JPG, PNG, WebP or MP4, up to 10 MB')}</p>
                </div>
                <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4" style={{ display: 'none' }} onChange={e => setPhoto(e.target.files[0])} />
              </label>
            </div>
            <button className="btn btn-primary btn-lg" type="submit" disabled={submitting} style={{ width: '100%' }}>
              {submitting ? t('complaints.submitting', 'Submitting...') : `🚨 ${t('complaints.submit_btn', 'Submit complaint')}`}
            </button>
          </form>
        </div>
      )}

      {tab === 'my' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {loading && [1,2,3].map(i => <div key={i} className="shimmer" style={{ height: '90px' }} />)}
          {!loading && list.length === 0 && (
            <div className="card" style={{ padding: '50px', textAlign: 'center' }}>
              <p style={{ fontSize: '32px', marginBottom: '12px' }}>📭</p>
              <p style={{ color: 'var(--c-text2)' }}>{t('complaints.none', 'No complaints submitted yet')}</p>
            </div>
          )}
          {list.map(c => (
            <div key={c.id} className="card" style={{ padding: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,209,102,0.1)', border: '1px solid rgba(255,209,102,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>⚠️</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: '600', fontSize: '14px', color: 'var(--c-text)', textTransform: 'capitalize' }}>{t(`complaints.types.${c.complaint_type}`, TYPE_DEFAULTS[c.complaint_type] || c.complaint_type)}</span>
                    <span className={`badge ${STATUS_BADGE[c.status] || 'badge-blue'}`}>{t(`complaint_status.${c.status}`, c.status)}</span>
                    {c.points_awarded > 0 && <span className="badge badge-purple">{t('complaints.pts', '+{{n}} pts', { n: c.points_awarded })}</span>}
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--c-text2)', marginBottom: '4px' }}>{c.description || t('complaints.no_desc', 'No description provided')}</p>
                  <p style={{ fontSize: '11px', color: 'var(--c-text3)', fontFamily: 'var(--font-mono)' }}>📍 {c.latitude}, {c.longitude}</p>
                  {c.timeline?.length > 0 && (
                    <ol style={{ listStyle: 'none', borderLeft: '2px solid var(--c-border)', paddingLeft: '12px', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {c.timeline.map((e, i) => (
                        <li key={i} style={{ fontSize: '12px', color: 'var(--c-text2)' }}>
                          <strong style={{ textTransform: 'capitalize', color: 'var(--c-text)' }}>{t(`complaint_status.${e.status}`, e.status)}</strong>
                          {' · '}{fmtDateTime(e.at)}{e.by ? ` · ${e.by}` : ''}{e.note ? ` — ${e.note}` : ''}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
                {c.photo_url && <img src={c.photo_url} alt={t('police.evidence', 'Evidence')} style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '10px', border: '1px solid var(--c-border)', flexShrink: 0 }} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
