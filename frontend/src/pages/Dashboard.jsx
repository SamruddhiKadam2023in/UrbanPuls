import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import api, { errorMessage } from '../utils/api'
import { fmtDateTime, rupees } from '../utils/format'

const COLORS = ['#3b82f6', '#06d6a0', '#f72585', '#ffd166', '#a78bfa']

export default function Dashboard() {
  const user = useSelector(s => s.auth.user)
  const { t } = useTranslation()
  const isAdmin = user?.role === 'admin'
  const [complaints, setComplaints] = useState([])
  const [stats, setStats] = useState(null)
  const [trafficSummary, setTrafficSummary] = useState([])
  const [tab, setTab] = useState('overview')

  useEffect(() => {
    api.get('/vendors/stats').then(r => setStats(r.data)).catch(() => {})
    api.get('/traffic/summary').then(r => setTrafficSummary(r.data)).catch(() => {})
    if (isAdmin) {
      api.get('/complaints/', { params: { status: 'pending' } }).then(r => setComplaints(r.data)).catch(() => {})
    }
  }, [isAdmin])

  const reviewComplaint = async (id, action) => {
    let body = {}
    if (action === 'reject') {
      const note = prompt(t('dashboard.reject_reason', 'Why is this complaint rejected? (sent to the reporter, optional)'))
      if (note === null) return
      body = { note }
    }
    try {
      await api.patch(`/complaints/${id}/${action}`, body)
      setComplaints(c => c.filter(x => x.id !== id))
      toast.success(action === 'verify' ? t('dashboard.verified', 'Verified: points awarded and fine created') : t('dashboard.rejected', 'Complaint rejected'))
    } catch (e) { toast.error(errorMessage(e)) }
  }

  const pieData = Object.entries(
    complaints.reduce((acc, c) => { acc[c.complaint_type] = (acc[c.complaint_type] || 0) + 1; return acc }, {})
  ).map(([name, value]) => ({ name: name.replaceAll('_', ' '), value }))

  const tabs = [['overview', `📈 ${t('dashboard.overview', 'Overview')}`]]
  if (isAdmin) tabs.push(['complaints', `⚠️ ${t('nav.complaints', 'Complaints')} (${complaints.length})`])

  return (
    <div className="page-wrap fade-in">
      <div className="page-header">
        <h1 className="section-header" style={{ fontSize: '26px' }}>📊 {t('nav.dashboard', 'Dashboard')}</h1>
        <p className="section-sub">{isAdmin ? t('dashboard.subtitle_admin', 'All zones and complaints') : t('dashboard.subtitle_vendor', 'Your parking zones')}</p>
      </div>

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: isAdmin ? t('dashboard.zones', 'Zones') : t('dashboard.your_zones', 'Your zones'), value: stats.total_zones,          color: '#3b82f6' },
            { label: t('dashboard.total_bookings', 'Total bookings'),                 value: stats.total_bookings,       color: '#06d6a0' },
            { label: t('bookings.parked_now', 'Parked now'),                     value: stats.parked_now,           color: '#a78bfa' },
            { label: t('dashboard.revenue', 'Revenue collected'),              value: rupees(stats.total_revenue), color: '#ffd166' },
            { label: t('report.no_shows', 'No-shows'),                       value: stats.no_shows,             color: '#f87171' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: '16px', padding: '18px' }}>
              <div className="stat-num" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '4px', background: 'var(--c-bg2)', padding: '4px', borderRadius: '12px', marginBottom: '24px', width: 'fit-content', flexWrap: 'wrap' }}>
        {tabs.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className="btn btn-sm"
            style={{ background: tab === k ? 'var(--c-surface2)' : 'transparent', color: tab === k ? 'var(--c-text)' : 'var(--c-text2)', border: 'none' }}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '600', marginBottom: '16px', color: 'var(--c-text)' }}>{t('dashboard.traffic_chart', 'Traffic density by zone')}</h3>
            {trafficSummary.length === 0
              ? <div style={{ textAlign: 'center', padding: '40px', color: 'var(--c-text3)', fontSize: '13px' }}>{t('dashboard.no_traffic', 'No traffic data yet')}</div>
              : <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={trafficSummary} margin={{ left: -20, right: 0 }}>
                    <XAxis dataKey="zone_name" tick={{ fontSize: 10, fill: 'var(--c-text2)' }} />
                    <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: 'var(--c-text2)' }} />
                    <Tooltip formatter={v => [`${Math.round(v * 100)}%`, t('dashboard.density', 'Density')]} contentStyle={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }} />
                    <Bar dataKey="avg_density" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>}
          </div>
          {isAdmin && (
            <div className="card" style={{ padding: '24px' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '600', marginBottom: '16px', color: 'var(--c-text)' }}>{t('dashboard.pending_chart', 'Pending complaints by type')}</h3>
              {pieData.length === 0
                ? <div style={{ textAlign: 'center', padding: '40px', color: 'var(--c-text3)', fontSize: '13px' }}>{t('dashboard.no_pending', 'No pending complaints')}</div>
                : <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Legend iconSize={10} wrapperStyle={{ fontSize: '11px', color: 'var(--c-text2)' }} />
                    </PieChart>
                  </ResponsiveContainer>}
            </div>
          )}
        </div>
      )}

      {tab === 'complaints' && isAdmin && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {complaints.length === 0 && (
            <div className="card" style={{ padding: '50px', textAlign: 'center' }}>
              <p style={{ color: 'var(--c-text2)' }}>{t('dashboard.all_reviewed', 'All complaints have been reviewed.')}</p>
            </div>
          )}
          {complaints.map(c => (
            <div key={c.id} className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--c-text)', textTransform: 'capitalize', marginBottom: '6px' }}>{t(`complaints.types.${c.complaint_type}`, c.complaint_type.replaceAll('_', ' '))}</div>
                  <p style={{ fontSize: '13px', color: 'var(--c-text2)', marginBottom: '4px' }}>{c.description || t('police.no_desc', 'No description')}</p>
                  <p style={{ fontSize: '11px', color: 'var(--c-text3)', fontFamily: 'var(--font-mono)' }}>
                    <a href={`https://www.openstreetmap.org/?mlat=${c.latitude}&mlon=${c.longitude}#map=18/${c.latitude}/${c.longitude}`} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>📍 {c.latitude}, {c.longitude}</a> · {fmtDateTime(c.created_at)}
                  </p>
                  {c.photo_url && <a href={c.photo_url} target="_blank" rel="noreferrer"><img src={c.photo_url} alt={t('police.evidence', 'Evidence')} style={{ height: '90px', marginTop: '10px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--c-border)' }} /></a>}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => reviewComplaint(c.id, 'verify')} className="btn btn-accent btn-sm">✓ {t('dashboard.verify', 'Verify')}</button>
                  <button onClick={() => reviewComplaint(c.id, 'reject')} className="btn btn-ghost btn-sm">✕ {t('dashboard.reject', 'Reject')}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
