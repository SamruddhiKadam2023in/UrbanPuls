import { useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

// Camera access needs HTTPS (or localhost). Falls back to typing the code if the camera fails.
export default function QrScanner({ onScan, onError, onClose }) {
  const done = useRef(false)

  useEffect(() => {
    const scanner = new Html5Qrcode('tpms-qr-reader')
    const started = scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: 220 },
      (text) => {
        if (done.current) return
        done.current = true
        onScan(text.trim())
      },
      () => {}   // "no QR in this frame" is reported on every frame; ignore it
    ).catch(() => {
      onError?.('Camera not available. Type the booking code instead.')
      onClose()
    })
    return () => {
      started.then(() => scanner.isScanning && scanner.stop()).then(() => scanner.clear()).catch(() => {})
    }
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '20px' }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '700', color: 'var(--c-text)' }}>Scan booking QR</h3>
          <button onClick={onClose} className="btn btn-ghost btn-sm">Close</button>
        </div>
        <div id="tpms-qr-reader" style={{ width: '100%', borderRadius: '12px', overflow: 'hidden' }} />
      </div>
    </div>
  )
}
