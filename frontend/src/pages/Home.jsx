import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { fetchZones } from '../store/slices/zonesSlice'

export default function Home() {
  const dispatch   = useDispatch()
  const { t }      = useTranslation()
  const user       = useSelector(s => s.auth.user)
  const zones      = useSelector(s => s.zones.list)

  useEffect(() => { dispatch(fetchZones()) }, [])

  const totalAvail = zones.reduce((a, z) => a + (z.available_slots || 0), 0)
  const totalSlots = zones.reduce((a, z) => a + z.total_slots, 0)
  const occupancy  = totalSlots ? Math.round(((totalSlots - totalAvail) / totalSlots) * 100) : 0

  const hour = new Date().getHours()
  const greeting = hour < 12 ? t('greeting.morning') : hour < 18 ? t('greeting.afternoon') : t('greeting.evening')

  const QUICK_ACTIONS = [
    { to: '/map',        emoji: '🗺️', title: t('home.actions.map'),       desc: t('home.actions.map_desc'),       color: '#3b82f6', glow: 'rgba(59,130,246,0.2)'  },
    { to: '/bookings',   emoji: '📋', title: t('home.actions.bookings'),   desc: t('home.actions.bookings_desc'), color: '#06d6a0', glow: 'rgba(6,214,160,0.2)'   },
    { to: '/complaints', emoji: '⚠️', title: t('home.actions.report'),     desc: t('home.actions.report_desc'),   color: '#ffd166', glow: 'rgba(255,209,102,0.2)' },
    { to: '/detection',  emoji: '🔍', title: t('home.actions.yolo'),       desc: t('home.actions.yolo_desc'),     color: '#f72585', glow: 'rgba(247,37,133,0.2)'  },
    { to: '/emergency',  emoji: '🚨', title: t('home.actions.emergency'),  desc: t('home.actions.emergency_desc'),color: '#ef233c', glow: 'rgba(239,35,60,0.2)'   },
    { to: '/dashboard',  emoji: '📊', title: t('home.actions.analytics'), desc: t('home.actions.analytics_desc'),color: '#a78bfa', glow: 'rgba(167,139,250,0.2)' },
  ]

  const stats = [
    { label: t('home.zones'),     value: zones.length,  suffix: '',  color: '#3b82f6', bg: 'rgba(59,130,246,0.08)',   border: 'rgba(59,130,246,0.2)'  },
    { label: t('home.available'), value: totalAvail,    suffix: '',  color: '#06d6a0', bg: 'rgba(6,214,160,0.08)',    border: 'rgba(6,214,160,0.2)'   },
    { label: t('home.occupancy'), value: occupancy,     suffix: '%', color: '#ffd166', bg: 'rgba(255,209,102,0.08)', border: 'rgba(255,209,102,0.2)' },
    { label: t('home.points'),    value: user?.points || 0, suffix: '', color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.2)' },
  ]

  return (
    <div className="page-wrap fade-in">
      <div style={{ marginBottom: '32px', position: 'relative' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--c-accent)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="pulse-ring" /> {t('home.system_active')}
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '36px', fontWeight: '800', color: 'var(--c-text)', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: '8px' }}>
          {greeting},<br /><span className="gradient-text">{user?.name?.split(' ')[0] || 'User'}</span>
        </h1>
        <p style={{ color: 'var(--c-text2)', fontSize: '15px' }}>{t('home.welcome')}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '32px' }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: '16px', padding: '20px', transition: 'transform 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
            <div className="stat-num" style={{ color: s.color }}>{s.value}<span style={{ fontSize: '16px' }}>{s.suffix}</span></div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {user?.points > 0 && (
        <div style={{ background: 'linear-gradient(135deg, rgba(167,139,250,0.1), rgba(59,130,246,0.1))', border: '1px solid rgba(167,139,250,0.25)', borderRadius: '14px', padding: '16px 20px', marginBottom: '28px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontSize: '24px' }}>⭐</span>
          <div>
            <p style={{ fontSize: '14px', fontWeight: '600', color: '#a78bfa' }}>
              <strong>{user.points} {t('home.redeem_msg')}</strong>
            </p>
            <p style={{ fontSize: '12px', color: 'var(--c-text2)', marginTop: '2px' }}>{t('home.redeem_sub')}</p>
          </div>
          <Link to="/complaints" className="btn btn-sm" style={{ marginLeft: 'auto', background: 'rgba(167,139,250,0.2)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)', flexShrink: 0 }}>{t('home.redeem_btn')}</Link>
        </div>
      )}

      <div style={{ marginBottom: '8px' }}>
        <h2 className="section-header">{t('home.quick_actions')}</h2>
        <p className="section-sub">{t('home.quick_sub')}</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px', marginTop: '16px' }}>
        {QUICK_ACTIONS.map(a => (
          <Link key={a.to} to={a.to} style={{ textDecoration: 'none' }}>
            <div className="card" style={{ padding: '20px', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = a.color + '55'; e.currentTarget.style.boxShadow = `0 8px 32px ${a.glow}`; e.currentTarget.style.transform = 'translateY(-3px)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = 'translateY(0)' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: a.glow, border: `1px solid ${a.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', marginBottom: '14px' }}>{a.emoji}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: '600', fontSize: '15px', color: 'var(--c-text)', marginBottom: '4px' }}>{a.title}</div>
              <div style={{ fontSize: '12px', color: 'var(--c-text2)', lineHeight: 1.4 }}>{a.desc}</div>
              <div style={{ marginTop: '14px', fontSize: '12px', color: a.color, fontWeight: '500' }}>→</div>
            </div>
          </Link>
        ))}
      </div>

      {zones.length > 0 && (
        <div style={{ marginTop: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h2 className="section-header">{t('home.live_zones')}</h2>
              <p className="section-sub">{t('home.live_sub')} {zones.length} {t('home.locations')}</p>
            </div>
            <Link to="/map" className="btn btn-outline btn-sm">{t('home.view_map')}</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
            {zones.slice(0, 4).map(z => {
              const avail = z.available_slots || 0
              const pct   = z.total_slots ? Math.round((avail / z.total_slots) * 100) : 0
              const color = pct > 50 ? '#06d6a0' : pct > 20 ? '#ffd166' : '#ef233c'
              return (
                <div key={z.id} className="card" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--c-text)' }}>{z.name}</span>
                    <span className="badge" style={{ background: `${color}20`, color, border: `1px solid ${color}40`, fontSize: '10px' }}>{avail} {t('home.slot_free')}</span>
                  </div>
                  <div style={{ height: '4px', background: 'var(--c-bg2)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '2px', transition: 'width 0.5s' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--c-text3)' }}>₹{z.price_per_hour}{t('home.per_hr')}</span>
                    <span style={{ fontSize: '11px', color: 'var(--c-text3)' }}>{pct}{t('home.pct_available')}</span>
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
