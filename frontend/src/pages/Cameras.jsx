import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import api, { errorMessage } from '../utils/api'
import ImageOverlay from '../components/detection/ImageOverlay'

function Modal({ title, onClose, children }) {
  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px' }}>
      <div className="card" style={{ width: '100%', maxWidth: '900px', maxHeight: '100%', overflowY: 'auto', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: 700, color: 'var(--c-text)' }}>{title}</h3>
          <button onClick={onClose} className="btn btn-ghost btn-sm" aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function AddCamera({ zones, onClose, onAdded }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [zoneId, setZoneId] = useState('')
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('name', name)
      if (zoneId) fd.append('zone_id', zoneId)
      fd.append('image', file)
      const res = await api.post('/detect/cameras', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success(t('cameras.added', 'Camera added. Now draw its no-parking areas.'))
      onAdded(res.data)
    } catch (err) { toast.error(errorMessage(err)) }
    finally { setSaving(false) }
  }

  return (
    <Modal title={t('cameras.add', 'Add camera')} onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '460px' }}>
        <div><label className="label">{t('cameras.name', 'Camera name')}</label>
          <input className="input" required maxLength={100} placeholder={t('cameras.name_ph', 'e.g. Dadar gate, facing the road')} value={name} onChange={e => setName(e.target.value)} /></div>
        <div><label className="label">{t('cameras.zone', 'Parking lot (optional)')}</label>
          <select className="input" value={zoneId} onChange={e => setZoneId(e.target.value)}>
            <option value="">{t('cameras.no_zone', 'Not linked to a lot')}</option>
            {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select></div>
        <div><label className="label">{t('cameras.photo', 'Reference photo from this camera')}</label>
          <input className="input" type="file" required accept="image/jpeg,image/png,image/webp" onChange={e => setFile(e.target.files[0])} />
          <p style={{ fontSize: '11px', color: 'var(--c-text3)', marginTop: '4px' }}>{t('cameras.photo_hint', 'A clear photo of the usual view. You will draw the no-parking areas on it.')}</p></div>
        <button className="btn btn-primary" disabled={saving}>{saving ? t('common.saving', 'Saving...') : t('cameras.continue', 'Continue to draw areas →')}</button>
      </form>
    </Modal>
  )
}

function AreaEditor({ camera, onClose, onSaved }) {
  const { t } = useTranslation()
  const [areas, setAreas] = useState(camera.areas)
  const [draft, setDraft] = useState([])
  const [saving, setSaving] = useState(false)

  const finish = () => { if (draft.length >= 3) { setAreas(a => [...a, draft]); setDraft([]) } }
  const save = async () => {
    setSaving(true)
    try {
      const res = await api.patch(`/detect/cameras/${camera.id}`, { areas })
      toast.success(t('cameras.saved', 'No-parking areas saved'))
      onSaved(res.data)
    } catch (err) { toast.error(errorMessage(err)) }
    finally { setSaving(false) }
  }

  return (
    <Modal title={`${t('cameras.draw', 'No-parking areas')} · ${camera.name}`} onClose={onClose}>
      <p style={{ fontSize: '13px', color: 'var(--c-text2)', marginBottom: '12px', lineHeight: 1.5 }}>
        {t('cameras.draw_hint', 'Click around the edge of each no-parking area (a footpath, a fire lane, a road edge), then press "Finish area". A vehicle whose wheels are inside a red area is a violation.')}
      </p>
      <div style={{ textAlign: 'center', marginBottom: '12px' }}>
        <ImageOverlay src={camera.image_url} width={camera.image_width} height={camera.image_height}
          areas={areas} draft={draft} onPoint={(x, y) => setDraft(d => [...d, [x, y]])} maxHeight={480} />
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <button className="btn btn-accent btn-sm" disabled={draft.length < 3} onClick={finish}>✓ {t('cameras.finish', 'Finish area')} ({draft.length})</button>
        <button className="btn btn-ghost btn-sm" disabled={!draft.length} onClick={() => setDraft(d => d.slice(0, -1))}>↶ {t('cameras.undo', 'Undo point')}</button>
        <button className="btn btn-ghost btn-sm" disabled={!draft.length} onClick={() => setDraft([])}>{t('cameras.discard', 'Discard this area')}</button>
      </div>
      {areas.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
          {areas.map((a, i) => (
            <span key={i} className="badge badge-red" style={{ gap: '6px' }}>
              {t('cameras.area_n', 'Area {{n}}', { n: i + 1 })}
              <button onClick={() => setAreas(list => list.filter((_, j) => j !== i))} aria-label="Remove area"
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 700 }}>✕</button>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button className="btn btn-primary" disabled={saving || draft.length > 0} onClick={save}>{saving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}</button>
        {draft.length > 0 && <span style={{ fontSize: '12px', color: '#ffd166', alignSelf: 'center' }}>{t('cameras.finish_first', 'Finish or discard the area you are drawing first')}</span>}
      </div>
    </Modal>
  )
}

export default function Cameras() {
  const { t } = useTranslation()
  const user = useSelector(s => s.auth.user)
  const [cameras, setCameras] = useState([])
  const [zones, setZones] = useState([])
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(() => {
    api.get('/detect/cameras').then(r => { setCameras(r.data); setLoaded(true) }).catch(e => toast.error(errorMessage(e)))
  }, [])

  useEffect(() => {
    load()
    // Partners may only link their own lots; others can pick any lot
    const url = user?.role === 'vendor' ? '/zones/manage/mine' : '/zones/'
    api.get(url).then(r => setZones(r.data)).catch(() => {})
  }, [load, user?.role])

  const remove = async (c) => {
    if (!confirm(t('cameras.remove_confirm', 'Remove the camera "{{name}}"?', { name: c.name }))) return
    try { await api.delete(`/detect/cameras/${c.id}`); load() } catch (e) { toast.error(errorMessage(e)) }
  }

  const canEdit = (c) => user?.role === 'admin' || c.owner_id === user?.id

  return (
    <div className="page-wrap fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 className="section-header" style={{ fontSize: '26px' }}>📷 {t('cameras.title', 'Cameras and no-parking areas')}</h1>
          <p className="section-sub">{t('cameras.subtitle', 'Mark where parking is not allowed in each camera view. Detection flags vehicles standing in those areas.')}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link to="/detection" className="btn btn-ghost">🔍 {t('cameras.to_detection', 'Detection')}</Link>
          <button className="btn btn-primary" onClick={() => setAdding(true)}>+ {t('cameras.add', 'Add camera')}</button>
        </div>
      </div>

      {loaded && cameras.length === 0 && (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--c-text2)' }}>{t('cameras.none', 'No cameras yet. Add one with a photo of its view.')}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
        {cameras.map(c => (
          <div key={c.id} className="card" style={{ padding: '14px' }}>
            <ImageOverlay src={c.image_url} width={c.image_width} height={c.image_height} areas={c.areas} maxHeight={200} />
            <div style={{ marginTop: '10px', fontWeight: 600, color: 'var(--c-text)' }}>{c.name}</div>
            <div style={{ fontSize: '12px', color: 'var(--c-text3)', marginBottom: '10px' }}>
              {c.zone_name || t('cameras.no_zone', 'Not linked to a lot')} · {t('cameras.n_areas', '{{n}} no-parking area(s)', { n: c.areas.length })}
            </div>
            {canEdit(c) && (
              <div style={{ display: 'flex', gap: '6px' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(c)}>✏️ {t('cameras.edit_areas', 'Edit areas')}</button>
                <button className="btn btn-ghost btn-sm" onClick={() => remove(c)}>🗑 {t('cameras.remove', 'Remove')}</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {adding && <AddCamera zones={zones} onClose={() => setAdding(false)} onAdded={(cam) => { setAdding(false); load(); setEditing(cam) }} />}
      {editing && <AreaEditor camera={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
    </div>
  )
}
