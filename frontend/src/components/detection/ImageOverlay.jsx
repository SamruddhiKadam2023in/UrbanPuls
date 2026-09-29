import { useRef } from 'react'

const VEHICLE_ICON = { car: '🚗', motorcycle: '🏍', bus: '🚌', truck: '🚚', bicycle: '🚲' }
export const vehicleIcon = (label) => VEHICLE_ICON[label] || '🚘'

/**
 * An image with no-parking areas and detection boxes drawn on top.
 * - areas / draft: polygons in normalised 0..1 coordinates
 * - boxes: detections with bbox in image pixels (width x height)
 * - onPoint(x, y): called with normalised coordinates when the image is clicked (area drawing)
 */
export default function ImageOverlay({ src, width, height, areas = [], draft = [], boxes = [], onPoint, maxHeight = 460 }) {
  const svgRef = useRef(null)
  const toPx = (poly) => poly.map(([x, y]) => `${x * width},${y * height}`).join(' ')
  const stroke = Math.max(2, width / 300)
  const font = Math.max(12, width / 45)

  const click = (e) => {
    if (!onPoint || !svgRef.current) return
    const r = svgRef.current.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
    onPoint(Math.round(x * 10000) / 10000, Math.round(y * 10000) / 10000)
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', lineHeight: 0 }}>
      <img src={src} alt="" style={{ maxWidth: '100%', maxHeight, borderRadius: '10px', display: 'block' }} />
      <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" onClick={click}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: onPoint ? 'crosshair' : 'default' }}>
        {areas.map((poly, i) => (
          <polygon key={`a${i}`} points={toPx(poly)} fill="rgba(239,35,60,0.22)" stroke="#ef233c" strokeWidth={stroke} strokeDasharray={`${stroke * 4} ${stroke * 2}`} />
        ))}
        {draft.length > 0 && (
          <>
            <polyline points={toPx(draft)} fill="rgba(255,209,102,0.18)" stroke="#ffd166" strokeWidth={stroke} />
            {draft.map(([x, y], i) => <circle key={`d${i}`} cx={x * width} cy={y * height} r={stroke * 2.5} fill="#ffd166" />)}
          </>
        )}
        {boxes.map((d, i) => {
          const [x1, y1, x2, y2] = d.bbox
          const color = d.in_no_parking ? '#ef233c' : '#06d6a0'
          const text = `${d.label} ${Math.round(d.confidence * 100)}%`
          return (
            <g key={`b${i}`}>
              <rect x={x1} y={y1} width={x2 - x1} height={y2 - y1} fill="none" stroke={color} strokeWidth={stroke * 1.5} />
              <rect x={x1} y={Math.max(0, y1 - font * 1.4)} width={text.length * font * 0.62} height={font * 1.4} fill={color} />
              <text x={x1 + font * 0.3} y={Math.max(font, y1 - font * 0.35)} fontSize={font} fill="#0b1220" fontFamily="DM Sans, sans-serif" fontWeight="700">{text}</text>
              {/* Ground point: where the vehicle touches the road, which decides the violation */}
              <circle cx={(x1 + x2) / 2} cy={y2} r={stroke * 2} fill={color} stroke="#fff" strokeWidth={stroke / 2} />
            </g>
          )
        })}
      </svg>
    </div>
  )
}
