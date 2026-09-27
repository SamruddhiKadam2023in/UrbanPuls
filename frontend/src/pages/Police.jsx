import { useCallback, useEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import api, { errorMessage } from '../utils/api'
import { fmtDateTime } from '../utils/format'
import L, { createMap, directionsUrl, escapeHtml } from '../utils/leaflet'

const STATUS_COLORS = { pending: '#ffd166', verified: '#f87171', resolved: '#06d6a0', rejected: '#64748b' }

export default function Police() {
  const { t } = useTranslation()
  const user = useSelector(s => s.auth.user)
  const [status, setStatus] = useState('verified')
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const mapEl = useRef(null)
  const map = useRef(null)
  const layer = useRef(null)

  const load = useCallback(() => {
    api.get('/complaints/', { params: { status } }).then(r => setItems(r.data)).catch(e => toast.error(errorMessage(e)))
  }, [status])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    map.current = createMap(mapEl.current, { zoom: 11 })
    layer.current = L.layerGroup().addTo(map.current)
    return () => map.current.remove()
  }, [])

  useEffect(() => {
    layer.current.clearLayers()
    const pts = []
    items.forEach(c => {
      const ll = [c.latitude, c.longitude]
      pts.push(ll)
      L.circleMarker(ll, { radius: 9, color: '#fff', weight: 2, fillColor: STATUS_COLORS[c.status], fillOpacity: 1 })
        .bindTooltip(escapeHtml(c.complaint_type.replaceAll('_', ' ')))
        .on('click', () => setSelected(c))
        .addTo(layer.current)
    })
    if (pts.length) map.current.fitBounds(pts, { padding: [40, 40], maxZoom: 15 })
  }, [items])

  const focus = (c) => {
    setSelected(c); setNote('')
    map.current.flyTo([c.latitude, c.longitude], 17)
  }

  const resolve = async () => {
    setSaving(true)
    try {
      await api.patch(`/complaints/${selected.id}/resolve`, { note })
      toast.success(t('police.resolved', 'Marked as resolved. The reporter has been notified.'))
      setSelected(null); setNote(''); load()
    } catch (e) { toast.error(errorMessage(e)) }
    finally { setSaving(false) }
  }

  const fine = async (c) => {
    try {
      const res = await api.get(`/complaints/${c.id}/fine`, { responseType: 'blob' })
      window.open(URL.createObjectURL(res.data), '_blank')
    } catch { toast.error(t('police.no_fine', 'No fine document for this complaint')) }
  }

  return (
    <div className="page-wrap fade-in" style={{ maxWidth: '1300px' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 className="section-header" style={{ fontSize: '26px' }}>🦺 {t('police.title', 'Enforcement')}</h1>
          <p className="section-sub">{t('police.subtitle', 'Verified complaints that need action on the ground')}</p>
        </div>
        <div style={{ display: 'flex', gap: '4px', background: 'var(--c-bg2)', padding: '4px', borderRadius: '12px' }}>
          {['verified', 'resolved', ...(user?.role === 'admin' ? ['pending'] : [])].map(s => (
            <button key={s} onClick={() => { setStatus(s); setSelected(null) }} className="btn btn-sm"
              style={{ background: status === s ? 'var(--c-surface2)' : 'transparent', color: status === s ? 'var(--c-text)' : 'var(--c-text2)', border: 'none' }}>
              {t(`complaint_status.${s}`, s)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
        <div ref={mapEl} style={{ height: '520px', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--c-border)' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '520px', overflowY: 'auto' }}>
          {items.length === 0 && <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--c-text2)' }}>{t('police.none', 'Nothing here right now.')}</div>}
          {items.map(c => {
            const open = selected?.id === c.id
            return (
              <div key={c.id} className="card" style={{ padding: '16px', borderColor: open ? 'var(--c-primary)' : undefined }}>
                <button onClick={() => focus(c)} style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: STATUS_COLORS[c.status] }} />
                    <span style={{ fontWeight: 600, color: 'var(--c-text)', textTransform: 'capitalize' }}>{c.complaint_type.replaceAll('_', ' ')}</span>
                    <span style={{ fontSize: '11px', color: 'var(--c-text3)' }}>#{c.id} · {fmtDateTime(c.created_at)}</span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--c-text2)' }}>{c.description || t('police.no_desc', 'No description')}</p>
                </button>
                {open && (
                  <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {c.photo_url && <a href={c.photo_url} target="_blank" rel="noreferrer"><img src={c.photo_url} alt={t('police.evidence', 'Evidence')} style={{ maxHeight: '160px', borderRadius: '8px', border: '1px solid var(--c-border)' }} /></a>}
                    <div style={{ fontSize: '12px', color: 'var(--c-text3)' }}>
                      {t('police.reported_by', 'Reported by')} {c.reporter?.name} · {c.reporter?.email}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <a className="btn btn-ghost btn-sm" href={directionsUrl(c.latitude, c.longitude)} target="_blank" rel="noopener noreferrer">🧭 {t('map.directions', 'Directions')}</a>
                      {c.fine_generated && <button className="btn btn-ghost btn-sm" onClick={() => fine(c)}>📄 {t('police.fine', 'Fine PDF')}</button>}
                    </div>
                    {c.timeline.length > 0 && (
                      <ol style={{ listStyle: 'none', borderLeft: '2px solid var(--c-border)', paddingLeft: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {c.timeline.map((e, i) => (
                          <li key={i} style={{ fontSize: '12px', color: 'var(--c-text2)' }}>
                            <strong style={{ color: STATUS_COLORS[e.status], textTransform: 'capitalize' }}>{t(`complaint_status.${e.status}`, e.status)}</strong>
                            {' · '}{fmtDateTime(e.at)}{e.by ? ` · ${e.by}` : ''}{e.note ? ` — ${e.note}` : ''}
                          </li>
                        ))}
                      </ol>
                    )}
                    {c.status === 'verified' && (
                      <>
                        <textarea className="input" rows={2} maxLength={1000} placeholder={t('police.note_ph', 'What was done? e.g. vehicle towed, challan issued')} value={note} onChange={e => setNote(e.target.value)} />
                        <button className="btn btn-accent" disabled={saving} onClick={resolve}>✓ {t('police.resolve', 'Mark resolved')}</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
