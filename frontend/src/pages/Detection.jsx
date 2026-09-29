import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { useDropzone } from 'react-dropzone'
import api, { errorMessage } from '../utils/api'
import ImageOverlay, { vehicleIcon } from '../components/detection/ImageOverlay'

export default function Detection() {
  const { t } = useTranslation()
  // Violations from other staff arrive over the app-wide live connection (components/common/LiveConnection.jsx)
  const { violations, wsConnected } = useSelector(s => s.detection)
  const [status, setStatus] = useState(null)       // { model_loaded, mock_mode, active }
  const [cameras, setCameras] = useState([])
  const [cameraId, setCameraId] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get('/detect/status').then(r => setStatus(r.data)).catch(() => {})
    api.get('/detect/cameras').then(r => setCameras(r.data)).catch(() => {})
  }, [])

  const camera = cameras.find(c => String(c.id) === String(cameraId))

  const onDrop = useCallback((files) => {
    const f = files[0]; if (!f) return
    setFile(f); setPreview(URL.createObjectURL(f)); setResult(null)
  }, [])
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/jpeg': [], 'image/png': [], 'image/webp': [] }, maxFiles: 1, maxSize: 10 * 1024 * 1024,
  })

  const run = async () => {
    if (!file) return toast.error(t('detection.need_image', 'Upload an image first'))
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      if (cameraId) fd.append('camera_id', cameraId)
      const res = await api.post('/detect/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setResult(res.data)
      // Same toast id as the live alert, so staff don't see it twice
      if (res.data.is_violation) toast.error(t('detection.found', '🚨 {{n}} violation(s) found', { n: res.data.violations.length }), { id: 'violation' })
      else toast.success(t('detection.clean_vehicles', '{{n}} vehicle(s) found, none in a no-parking area', { n: res.data.count }))
    } catch (e) { toast.error(errorMessage(e, t('detection.failed', 'Detection failed'))) }
    finally { setLoading(false) }
  }

  return (
    <div className="page-wrap fade-in" style={{ maxWidth: '1200px' }}>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="section-header" style={{ fontSize: '26px' }}>🔍 {t('detection.title', 'Violation detection')}</h1>
          <p className="section-sub">{t('detection.subtitle2', 'Finds vehicles in a camera photo and flags those standing in a no-parking area')}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className={`badge ${wsConnected ? 'badge-green' : ''}`}>{wsConnected ? t('detection.live_on', 'Live alerts active') : t('detection.connecting', 'Connecting...')}</span>
          <Link to="/cameras" className="btn btn-outline btn-sm">📷 {t('detection.manage_cameras', 'Cameras and no-parking areas')}</Link>
        </div>
      </div>

      {status?.model_loaded && (
        <div style={{ fontSize: '13px', color: 'var(--c-text2)', marginBottom: '16px' }}>
          🤖 {t('detection.model_on', 'Using the YOLO11 vehicle detection model (cars, two-wheelers, buses, trucks, bicycles).')}
        </div>
      )}
      {status && !status.active && (
        <div className="card" style={{ padding: '14px 18px', marginBottom: '16px', fontSize: '13px', color: 'var(--c-text2)' }}>
          🔒 {t('detection.inactive', 'Violation detection is not active yet. It will be switched on once a model trained on images from our parking sites is installed.')}
        </div>
      )}
      {status?.mock_mode && (
        <div style={{ background: 'rgba(255,209,102,0.08)', border: '1px solid rgba(255,209,102,0.25)', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#ffd166' }}>
          {t('detection.demo', 'Demo mode: no trained model is installed, so results are fixed samples. This mode is off in production.')}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="label">{t('detection.camera', 'Camera')}</label>
            <select className="input" value={cameraId} onChange={e => { setCameraId(e.target.value); setResult(null) }}>
              <option value="">{t('detection.no_camera', 'No camera: just find vehicles')}</option>
              {cameras.map(c => <option key={c.id} value={c.id}>{c.name}{c.zone_name ? ` · ${c.zone_name}` : ''} ({c.areas.length})</option>)}
            </select>
            <p style={{ fontSize: '11px', color: 'var(--c-text3)', marginTop: '4px' }}>
              {camera
                ? (camera.areas.length ? t('detection.camera_hint', 'Vehicles whose wheels are inside this camera\'s red areas are violations.') : t('detection.camera_no_areas', 'This camera has no no-parking areas yet. Draw them on the Cameras page.'))
                : t('detection.pick_camera', 'Pick a camera to check vehicles against its no-parking areas.')}
            </p>
          </div>

          <div {...getRootProps()} style={{ border: `2px dashed ${isDragActive ? 'var(--c-primary)' : preview ? 'var(--c-accent)' : 'var(--c-border)'}`, borderRadius: '14px', padding: '18px', textAlign: 'center', cursor: 'pointer', minHeight: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <input {...getInputProps()} />
            {preview
              ? <img src={preview} alt="" style={{ maxHeight: '180px', maxWidth: '100%', borderRadius: '10px' }} />
              : (
                <div>
                  <div style={{ fontSize: '36px', marginBottom: '8px' }}>🖼️</div>
                  <p style={{ fontSize: '14px', color: 'var(--c-text2)' }}>{isDragActive ? t('detection.drop_here', 'Drop image here') : t('detection.drop', 'Drag & drop or click to upload')}</p>
                  <p style={{ fontSize: '12px', color: 'var(--c-text3)' }}>{t('detection.drop_hint', 'CCTV snapshots, parking lot images')}</p>
                </div>
              )}
          </div>

          <button className="btn btn-primary" onClick={run} disabled={loading || !file || status?.active === false}>
            {loading ? t('detection.detecting', 'Detecting...') : `🔍 ${t('detection.run', 'Find vehicles')}`}
          </button>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 600, marginBottom: '14px', color: 'var(--c-text)' }}>{t('detection.result_title', 'Detection results')}</h3>
          {!result ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--c-text3)', fontSize: '13px' }}>
              {camera && <div style={{ marginBottom: '14px' }}><ImageOverlay src={camera.image_url} width={camera.image_width} height={camera.image_height} areas={camera.areas} maxHeight={220} /></div>}
              {t('detection.result_empty', 'Results will appear here after running detection')}
            </div>
          ) : (
            <>
              <div style={{ textAlign: 'center', marginBottom: '14px' }}>
                <ImageOverlay src={preview} width={result.width} height={result.height} areas={result.areas} boxes={result.detections} />
              </div>
              {result.is_violation && (
                <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(239,35,60,0.1)', border: '1px solid rgba(239,35,60,0.3)', color: '#f87171', fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>
                  🚨 {t('detection.violation_n', '{{n}} vehicle(s) parked in a no-parking area. Live alert sent to staff.', { n: result.violations.length })}
                </div>
              )}
              {result.detections.length === 0
                ? <p style={{ fontSize: '13px', color: 'var(--c-text3)' }}>{t('detection.no_vehicles', 'No vehicles found in this image.')}</p>
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {result.detections.map((d, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: '10px',
                        background: d.in_no_parking ? 'rgba(239,35,60,0.08)' : 'rgba(6,214,160,0.08)', border: `1px solid ${d.in_no_parking ? 'rgba(239,35,60,0.25)' : 'rgba(6,214,160,0.25)'}` }}>
                        <span style={{ fontSize: '13px', color: 'var(--c-text)', textTransform: 'capitalize' }}>{vehicleIcon(d.label)} {d.label}</span>
                        <span style={{ fontSize: '12px', color: d.in_no_parking ? '#f87171' : 'var(--c-text3)' }}>
                          {d.in_no_parking ? t('detection.in_area', 'in no-parking area') : t('detection.ok', 'OK')} · {Math.round(d.confidence * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              {result.mock && <p style={{ fontSize: '11px', color: '#ffd166', marginTop: '10px' }}>{t('detection.mock_note', 'Sample results (demo mode)')}</p>}
            </>
          )}
        </div>
      </div>

      {violations.length > 0 && (
        <div className="card" style={{ padding: '20px', marginTop: '16px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 600, color: 'var(--c-text)', marginBottom: '12px' }}>🔴 {t('detection.live_violations', 'Live violations')}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
            {violations.map((v, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', background: 'rgba(239,35,60,0.08)', border: '1px solid rgba(239,35,60,0.2)', fontSize: '12px' }}>
                <span style={{ color: '#f87171' }}>{v.camera || t('detection.unknown_camera', 'Uploaded photo')} · {t('detection.n_vehicles', '{{n}} vehicle(s)', { n: v.detections?.length || 0 })}</span>
                <span style={{ color: 'var(--c-text3)', fontFamily: 'var(--font-mono)' }}>{v.timestamp ? new Date(v.timestamp).toLocaleTimeString() : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
