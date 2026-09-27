import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import api from '../utils/api'

const COLORS = ['#3b82f6', '#06d6a0', '#f72585', '#ffd166', '#a78bfa']

export default function Dashboard() {
  const user = useSelector(s => s.auth.user)
  const [complaints, setComplaints] = useState([])
  const [vendorStats, setVendorStats] = useState(null)
  const [trafficSummary, setTrafficSummary] = useState([])
  const [tab, setTab] = useState('overview')

  useEffect(() => {
    if (user?.role === 'admin') api.get('/complaints/?status=pending').then(r => setComplaints(r.data)).catch(() => {})
    if (user?.role === 'vendor' || user?.role === 'admin') api.get('/vendors/stats').then(r => setVendorStats(r.data)).catch(() => {})
    api.get('/traffic/summary').then(r => setTrafficSummary(r.data)).catch(() => {})
  }, [])

  const handleVerify = async (id) => { await api.patch(`/complaints/${id}/verify`); setComplaints(c => c.filter(x => x.id !== id)) }
  const handleReject = async (id) => { await api.patch(`/complaints/${id}/reject`); setComplaints(c => c.filter(x => x.id !== id)) }

  const pieData = Object.entries(
    complaints.reduce((acc, c) => { acc[c.complaint_type] = (acc[c.complaint_type] || 0) + 1; return acc }, {})
  ).map(([name, value]) => ({ name: name.replace('_', ' '), value }))

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: '8px', padding: '10px 14px' }}>
        <p style={{ fontSize: '13px', color: 'var(--c-text)' }}>{payload[0].name}: <strong>{payload[0].value}</strong></p>
      </div>
    )
  }

  return (
    <div className="page-wrap fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #a78bfa, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', boxShadow: '0 8px 24px rgba(167,139,250,0.35)' }}>📊</div>
          <div>
            <h1 className="section-header" style={{ fontSize: '26px' }}>Dashboard</h1>
            <p className="section-sub">Analytics, insights & admin controls</p>
          </div>
        </div>
      </div>

      {/* Vendor stats */}
      {vendorStats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'Your Zones',     value: vendorStats.total_zones,                color: '#3b82f6', bg: 'rgba(59,130,246,0.08)',   border: 'rgba(59,130,246,0.2)' },
            { label: 'Total Bookings', value: vendorStats.total_bookings,             color: '#06d6a0', bg: 'rgba(6,214,160,0.08)',    border: 'rgba(6,214,160,0.2)' },
            { label: 'Revenue (₹)',    value: `${vendorStats.total_revenue?.toFixed(0)}`, color: '#ffd166', bg: 'rgba(255,209,102,0.08)', border: 'rgba(255,209,102,0.2)' },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: '16px', padding: '20px' }}>
              <div className="stat-num" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: 'var(--c-bg2)', padding: '4px', borderRadius: '12px', marginBottom: '24px', width: 'fit-content' }}>
        {[['overview', '📈 Overview'], ['complaints', '⚠️ Complaints']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className="btn btn-sm"
            style={{ background: tab === k ? 'var(--c-surface2)' : 'transparent', color: tab === k ? 'var(--c-text)' : 'var(--c-text2)', border: 'none', boxShadow: tab === k ? '0 2px 8px rgba(0,0,0,0.3)' : 'none' }}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '600', marginBottom: '16px', color: 'var(--c-text)' }}>Traffic Density by Zone</h3>
            {trafficSummary.length === 0
              ? <div style={{ textAlign: 'center', padding: '40px', color: 'var(--c-text3)', fontSize: '13px' }}>No traffic data yet</div>
              : <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={trafficSummary} margin={{ left: -20, right: 0 }}>
                    <XAxis dataKey="zone_name" tick={{ fontSize: 10, fill: 'var(--c-text2)' }} />
                    <YAxis domain={[0,1]} tick={{ fontSize: 10, fill: 'var(--c-text2)' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="avg_density" fill="#3b82f6" radius={[6,6,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
            }
          </div>
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '600', marginBottom: '16px', color: 'var(--c-text)' }}>Complaint Breakdown</h3>
            {pieData.length === 0
              ? <div style={{ textAlign: 'center', padding: '40px', color: 'var(--c-text3)', fontSize: '13px' }}>No complaint data</div>
              : <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${(percent*100).toFixed(0)}%`} labelLine={false}>
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Legend iconSize={10} wrapperStyle={{ fontSize: '11px', color: 'var(--c-text2)' }} />
                  </PieChart>
                </ResponsiveContainer>
            }
          </div>
        </div>
      )}

      {tab === 'complaints' && user?.role === 'admin' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ fontSize: '13px', color: 'var(--c-text2)', marginBottom: '4px' }}>{complaints.length} pending complaint(s) awaiting review</p>
          {complaints.length === 0 && (
            <div className="card" style={{ padding: '50px', textAlign: 'center' }}>
              <p style={{ fontSize: '32px', marginBottom: '12px' }}>🎉</p>
              <p style={{ color: 'var(--c-text2)' }}>All complaints have been reviewed!</p>
            </div>
          )}
          {complaints.map(c => (
            <div key={c.id} className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,209,102,0.1)', border: '1px solid rgba(255,209,102,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>⚠️</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontWeight: '600', fontSize: '14px', color: 'var(--c-text)', textTransform: 'capitalize' }}>{c.complaint_type?.replace('_', ' ')}</span>
                    <span className="badge badge-yellow">Pending</span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--c-text2)', marginBottom: '4px' }}>{c.description || 'No description'}</p>
                  <p style={{ fontSize: '11px', color: 'var(--c-text3)', fontFamily: 'var(--font-mono)' }}>📍 {c.latitude}, {c.longitude}</p>
                  {c.photo_url && <img src={c.photo_url} alt="evidence" style={{ height: '80px', marginTop: '10px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--c-border)' }} />}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button onClick={() => handleVerify(c.id)} className="btn btn-accent btn-sm">✓ Verify</button>
                  <button onClick={() => handleReject(c.id)} className="btn btn-ghost btn-sm">✕ Reject</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
