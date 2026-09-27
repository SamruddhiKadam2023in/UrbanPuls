import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, Legend } from 'recharts'
import api from '../utils/api'

const COLORS = ['#3b82f6', '#06d6a0', '#f72585', '#ffd166', '#a78bfa', '#fb923c']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: '10px', padding: '10px 14px' }}>
      {label && <p style={{ fontSize: '12px', color: 'var(--c-text3)', marginBottom: '6px' }}>{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ fontSize: '13px', color: p.color, fontWeight: '600' }}>{p.name}: {p.value}</p>
      ))}
    </div>
  )
}

export default function Analytics() {
  const user = useSelector(s => s.auth.user)
  const [vendorStats,    setVendorStats]    = useState(null)
  const [trafficSummary, setTrafficSummary] = useState([])
  const [complaints,     setComplaints]     = useState([])
  const [bookingTrend,   setBookingTrend]   = useState([])

  useEffect(() => {
    if (user?.role === 'vendor' || user?.role === 'admin') {
      api.get('/vendors/stats').then(r => setVendorStats(r.data)).catch(() => {})
    }
    api.get('/traffic/summary').then(r => setTrafficSummary(r.data)).catch(() => {})
    if (user?.role === 'admin') {
      api.get('/complaints/').then(r => setComplaints(r.data)).catch(() => {})
    }

    // Mock booking trend for last 7 days
    const trend = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i))
      return { day: d.toLocaleDateString('en', { weekday: 'short' }), bookings: Math.floor(Math.random() * 20 + 5), revenue: Math.floor(Math.random() * 2000 + 500) }
    })
    setBookingTrend(trend)
  }, [])

  const complaintPie = Object.entries(
    complaints.reduce((acc, c) => { acc[c.complaint_type] = (acc[c.complaint_type] || 0) + 1; return acc }, {})
  ).map(([name, value]) => ({ name: name.replace('_', ' '), value }))

  const statusPie = Object.entries(
    complaints.reduce((acc, c) => { acc[c.status] = (acc[c.status] || 0) + 1; return acc }, {})
  ).map(([name, value]) => ({ name, value }))

  const StatCard = ({ label, value, color, bg, border, suffix = '' }) => (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: '16px', padding: '20px', transition: 'transform 0.2s' }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: '800', color }}>{value}{suffix}</div>
      <div style={{ fontSize: '12px', color: 'var(--c-text2)', marginTop: '4px', fontWeight: '500' }}>{label}</div>
    </div>
  )

  return (
    <div className="page-wrap fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #a78bfa, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', boxShadow: '0 8px 24px rgba(167,139,250,0.35)' }}>📊</div>
          <div>
            <h1 className="section-header" style={{ fontSize: '26px' }}>Analytics</h1>
            <p className="section-sub">Real-time insights and performance metrics</p>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      {vendorStats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          <StatCard label="Total Zones"    value={vendorStats.total_zones}                        color="#3b82f6" bg="rgba(59,130,246,0.08)"   border="rgba(59,130,246,0.2)" />
          <StatCard label="Total Bookings" value={vendorStats.total_bookings}                     color="#06d6a0" bg="rgba(6,214,160,0.08)"    border="rgba(6,214,160,0.2)" />
          <StatCard label="Total Revenue"  value={`₹${vendorStats.total_revenue?.toFixed(0)}`}   color="#ffd166" bg="rgba(255,209,102,0.08)"  border="rgba(255,209,102,0.2)" />
          <StatCard label="Complaints"     value={complaints.length}                              color="#f87171" bg="rgba(239,35,60,0.08)"    border="rgba(239,35,60,0.2)" />
        </div>
      )}

      {/* Charts grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>

        {/* Booking trend */}
        <div className="card" style={{ padding: '20px', gridColumn: '1 / -1' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '600', color: 'var(--c-text)', marginBottom: '16px' }}>📈 Booking Trend (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={bookingTrend} margin={{ left: -20, right: 10 }}>
              <defs>
                <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}   />
                </linearGradient>
                <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#06d6a0" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06d6a0" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--c-text2)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--c-text2)' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '12px', color: 'var(--c-text2)' }} />
              <Area type="monotone" dataKey="bookings" stroke="#3b82f6" fill="url(#blueGrad)"  strokeWidth={2} name="Bookings" />
              <Area type="monotone" dataKey="revenue"  stroke="#06d6a0" fill="url(#greenGrad)" strokeWidth={2} name="Revenue (₹)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Traffic density */}
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '600', color: 'var(--c-text)', marginBottom: '16px' }}>🚦 Traffic Density by Zone</h3>
          {trafficSummary.length === 0
            ? <div style={{ textAlign: 'center', padding: '40px', color: 'var(--c-text3)', fontSize: '13px' }}>No traffic data yet</div>
            : <ResponsiveContainer width="100%" height={200}>
                <BarChart data={trafficSummary} margin={{ left: -20 }}>
                  <XAxis dataKey="zone_name" tick={{ fontSize: 10, fill: 'var(--c-text2)' }} />
                  <YAxis domain={[0,1]} tick={{ fontSize: 10, fill: 'var(--c-text2)' }} />
                  <Tooltip content={<CustomTooltip />} formatter={v => [`${(v*100).toFixed(0)}%`, 'Density']} />
                  <Bar dataKey="avg_density" radius={[6,6,0,0]}>
                    {trafficSummary.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
          }
        </div>

        {/* Complaint types */}
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '600', color: 'var(--c-text)', marginBottom: '16px' }}>📋 Complaint Types</h3>
          {complaintPie.length === 0
            ? <div style={{ textAlign: 'center', padding: '40px', color: 'var(--c-text3)', fontSize: '13px' }}>No complaint data</div>
            : <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={complaintPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ percent }) => `${(percent*100).toFixed(0)}%`} labelLine={false}>
                    {complaintPie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Legend iconSize={10} wrapperStyle={{ fontSize: '11px', color: 'var(--c-text2)' }} />
                </PieChart>
              </ResponsiveContainer>
          }
        </div>
      </div>

      {/* Complaint status breakdown */}
      {statusPie.length > 0 && (
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '600', color: 'var(--c-text)', marginBottom: '16px' }}>✅ Complaint Resolution Status</h3>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {statusPie.map((s, i) => {
              const colors = { pending: '#ffd166', verified: '#06d6a0', rejected: '#ef233c', resolved: '#3b82f6' }
              const color  = colors[s.name] || COLORS[i]
              const pct    = complaints.length ? Math.round((s.value / complaints.length) * 100) : 0
              return (
                <div key={s.name} style={{ flex: 1, minWidth: '120px', padding: '16px', borderRadius: '12px', background: `${color}12`, border: `1px solid ${color}30` }}>
                  <div style={{ fontSize: '24px', fontWeight: '800', color, fontFamily: 'var(--font-display)' }}>{s.value}</div>
                  <div style={{ fontSize: '12px', color: 'var(--c-text2)', textTransform: 'capitalize', marginTop: '2px' }}>{s.name}</div>
                  <div style={{ fontSize: '11px', color, fontWeight: '600', marginTop: '6px' }}>{pct}%</div>
                  <div style={{ height: '3px', background: 'var(--c-bg2)', borderRadius: '2px', marginTop: '8px' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '2px' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
