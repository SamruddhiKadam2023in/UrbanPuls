import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchPrediction } from '../../store/slices/trafficSlice'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { TrendingUp } from 'lucide-react'

export default function TrafficPanel({ zones }) {
  const dispatch = useDispatch()
  const { prediction, loading } = useSelector(s => s.traffic)
  const [selectedZone, setSelectedZone] = useState('')

  const handlePredict = () => {
    if (selectedZone) dispatch(fetchPrediction(selectedZone))
  }

  const chartData = prediction
    ? Object.entries(prediction.hourly_density).map(([h, d]) => ({
        hour: `${h}:00`, density: Math.round(d * 100),
        isPeak: prediction.peak_hours.includes(Number(h))
      }))
    : []

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={16} className="text-primary" />
        <h3 className="font-semibold text-sm text-gray-900">Traffic Prediction</h3>
      </div>

      <div className="flex gap-2 mb-4">
        <select className="input flex-1 text-xs" value={selectedZone} onChange={e => setSelectedZone(e.target.value)}>
          <option value="">Select zone...</option>
          {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>
        <button className="btn-primary text-xs px-3" onClick={handlePredict} disabled={!selectedZone || loading}>
          {loading ? '...' : 'Predict'}
        </button>
      </div>

      {prediction && (
        <div className="space-y-3">
          <div className="bg-warning-light rounded-lg px-3 py-2">
            <div className="text-xs font-medium text-warning-dark mb-1">🔴 Peak Hours</div>
            <div className="text-xs text-warning-dark">{prediction.peak_hours.map(h => `${h}:00`).join(', ')}</div>
          </div>
          <div className="bg-primary-light rounded-lg px-3 py-2">
            <div className="text-xs font-medium text-primary-dark mb-1">🟢 Best Travel Times</div>
            <div className="text-xs text-primary-dark">{prediction.best_travel_hours.map(h => `${h}:00`).join(', ')}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-600 mb-2">Hourly Traffic Density</div>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={3} />
                <YAxis tick={{ fontSize: 9 }} domain={[0, 100]} />
                <Tooltip formatter={(v) => [`${v}%`, 'Density']} />
                <Bar dataKey="density" radius={[3, 3, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.isPeak ? '#D85A30' : '#1D9E75'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
