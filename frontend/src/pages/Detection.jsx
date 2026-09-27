import { useState, useEffect, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import { useDropzone } from 'react-dropzone'
import api, { errorMessage, wsUrl } from '../utils/api'
import { addViolation, setWsConnected } from '../store/slices/detectionSlice'
import { speakViolationAlert } from '../utils/voice'
import i18n from '../i18n'

export default function Detection() {
  const dispatch = useDispatch()
  const { violations, wsConnected } = useSelector(s => s.detection)
  const [detections, setDetections] = useState([])
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState(null)   // { model_loaded, mock_mode, active }

  useEffect(() => {
    api.get('/detect/status').then(r => setStatus(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    const ws = new WebSocket(wsUrl('/detect/ws'))
    ws.onopen  = () => dispatch(setWsConnected(true))
    ws.onclose = () => dispatch(setWsConnected(false))
    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data)
        if (data.type === 'violation') {
          dispatch(addViolation(data))
          toast.error(`🚨 Violation in Zone ${data.zone_id}!`)
          speakViolationAlert(i18n.language)
        }
      } catch {}
    }
    return () => ws.close()
  }, [])

  const onDrop = useCallback((files) => {
    const f = files[0]; if (!f) return
    setFile(f); setPreview(URL.createObjectURL(f)); setDetections([])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/jpeg': [], 'image/png': [], 'image/webp': [] }, maxFiles: 1, maxSize: 10 * 1024 * 1024 })

  const handleDetect = async () => {
    if (!file) return toast.error('Upload an image first')
    setLoading(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await api.post('/detect/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setDetections(res.data.detections)
      if (res.data.is_violation) { toast.error(`🚨 ${res.data.violations.length} violation(s) found!`); speakViolationAlert(i18n.language) }
      else toast.success(`✅ ${res.data.count} objects detected. No violations.`)
    } catch (e) { toast.error(errorMessage(e, 'Detection failed')) }
    finally { setLoading(false) }
  }

  return (
    <div className="page-wrap fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #f72585, #7209b7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', boxShadow: '0 8px 24px rgba(247,37,133,0.35)' }}>🔍</div>
            <div>
              <h1 className="section-header" style={{ fontSize: '26px' }}>YOLO AI Detection</h1>
              <p className="section-sub">Upload images for AI-powered parking violation detection</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: '20px', background: wsConnected ? 'rgba(6,214,160,0.1)' : 'rgba(100,116,139,0.1)', border: `1px solid ${wsConnected ? 'rgba(6,214,160,0.3)' : 'rgba(100,116,139,0.2)'}` }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: wsConnected ? '#06d6a0' : '#64748b', ...(wsConnected && { animation: 'pulse 1.5s infinite' }) }} />
            <span style={{ fontSize: '12px', color: wsConnected ? '#06d6a0' : 'var(--c-text3)', fontWeight: '500' }}>
              {wsConnected ? 'Live alerts active' : 'Connecting...'}
            </span>
          </div>
        </div>
      </div>

      {status && !status.active && (
        <div style={{ background: 'rgba(100,116,139,0.1)', border: '1px solid rgba(100,116,139,0.3)', borderRadius: '12px', padding: '14px 18px', marginBottom: '16px', fontSize: '13px', color: 'var(--c-text2)' }}>
          🔒 Violation detection is not active yet. It will be switched on once a model trained on images from our parking sites is installed.
        </div>
      )}
      {status?.mock_mode && (
        <div style={{ background: 'rgba(255,209,102,0.08)', border: '1px solid rgba(255,209,102,0.25)', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#ffd166' }}>
          Demo mode: no trained model is installed, so results are fixed samples. This mode is off in production.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
        {/* Upload panel */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: 'var(--c-text)' }}>Upload Image</h3>
          <div {...getRootProps()} style={{
            border: `2px dashed ${isDragActive ? 'var(--c-primary)' : preview ? 'var(--c-accent)' : 'var(--c-border)'}`,
            borderRadius: '14px', padding: '24px', textAlign: 'center', cursor: 'pointer',
            background: isDragActive ? 'rgba(59,130,246,0.05)' : 'transparent',
            transition: 'all 0.2s', minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <input {...getInputProps()} />
            {preview
              ? <img src={preview} alt="preview" style={{ maxHeight: '200px', maxWidth: '100%', borderRadius: '10px', objectFit: 'contain' }} />
              : (
                <div>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>🖼️</div>
                  <p style={{ fontSize: '14px', color: 'var(--c-text2)', marginBottom: '4px' }}>
                    {isDragActive ? 'Drop image here' : 'Drag & drop or click to upload'}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--c-text3)' }}>CCTV snapshots, parking lot images</p>
                </div>
              )}
          </div>
          <button className="btn btn-primary" onClick={handleDetect} disabled={loading || !file || status?.active === false}
            style={{ width: '100%', marginTop: '14px' }}>
            {loading
              ? <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                  Detecting...
                </span>
              : '🔍 Run YOLO Detection'}
          </button>
        </div>

        {/* Results panel */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: 'var(--c-text)' }}>Detection Results</h3>
          {detections.length === 0
            ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--c-text3)' }}>
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>🎯</div>
                <p style={{ fontSize: '13px' }}>Results will appear here after running detection</p>
              </div>
            )
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {detections.map((d, i) => {
                  const isViolation = d.label === 'illegal_parking'
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: '10px',
                      background: isViolation ? 'rgba(239,35,60,0.08)' : 'rgba(6,214,160,0.08)',
                      border: `1px solid ${isViolation ? 'rgba(239,35,60,0.25)' : 'rgba(6,214,160,0.25)'}`
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{isViolation ? '🚨' : '✅'}</span>
                        <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--c-text)', textTransform: 'capitalize' }}>{d.label.replaceAll('_', ' ')}</span>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: isViolation ? '#f87171' : '#06d6a0', fontWeight: '600' }}>
                        {(d.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                  )
                })}
                {detections.some(d => d.label === 'illegal_parking') && (
                  <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(239,35,60,0.1)', border: '1px solid rgba(239,35,60,0.25)', marginTop: '8px' }}>
                    <p style={{ fontSize: '12px', color: '#f87171', fontWeight: '500' }}>🚨 Illegal parking detected. Live alert sent to staff.</p>
                  </div>
                )}
              </div>
            )}
        </div>
      </div>

      {/* Live violations */}
      {violations.length > 0 && (
        <div className="card" style={{ padding: '20px', marginTop: '16px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '600', color: 'var(--c-text)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef233c', display: 'inline-block', animation: 'pulse 1s infinite' }} />
            Live Violations
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
            {violations.map((v, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', background: 'rgba(239,35,60,0.08)', border: '1px solid rgba(239,35,60,0.2)' }}>
                <span style={{ fontSize: '12px', color: '#f87171' }}>Zone {v.zone_id} — {v.detections?.length} violation(s)</span>
                <span style={{ fontSize: '11px', color: 'var(--c-text3)', fontFamily: 'var(--font-mono)' }}>{v.timestamp?.slice(11,19)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )
}
