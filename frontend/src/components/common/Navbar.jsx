import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useState, useEffect, useRef } from 'react'
import { logout } from '../../store/slices/authSlice'
import i18n from '../../i18n'
import api from '../../utils/api'
import { useTranslation } from 'react-i18next'
import NotificationBell from './NotificationBell'
import { hasRole } from '../../utils/roles'

// area: only shown to roles allowed in that area (see utils/roles.js)
const NAV = [
  { to: '/map',        icon: '🗺️', key: 'nav.map',        label: 'Live Map'   },
  { to: '/bookings',   icon: '📋', key: 'nav.bookings',   label: 'Bookings'   },
  { to: '/gate',       icon: '🚧', key: 'nav.gate',       label: 'Gate',       area: 'gate' },
  { to: '/zones',      icon: '🅿', key: 'nav.zones',      label: 'Zones',      area: 'zones' },
  { to: '/complaints', icon: '⚠️', key: 'nav.complaints', label: 'Complaints' },
  { to: '/police',     icon: '🚓', key: 'nav.police',     label: 'Enforcement', area: 'police' },
  { to: '/detection',  icon: '🔍', key: 'nav.yolo',       label: 'YOLO AI',    area: 'detection' },
  { to: '/analytics',  icon: '📊', key: 'nav.analytics',  label: 'Analytics',  area: 'staff' },
  { to: '/dashboard',  icon: '⚙️', key: 'nav.dashboard',  label: 'Dashboard',  area: 'staff' },
  { to: '/admin',      icon: '🛡', key: 'nav.admin',      label: 'Admin',      area: 'admin' },
  { to: '/emergency',  icon: '🚨', key: 'nav.emergency',  label: 'Emergency'  },
]

const LANGS = [
  { code: 'en', label: 'EN',  full: 'English', emoji: '🇬🇧' },
  { code: 'hi', label: 'हिं', full: 'हिंदी',  emoji: '🇮🇳' },
  { code: 'mr', label: 'मर',  full: 'मराठी',  emoji: '🟠'  },
]

export default function Navbar() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const user     = useSelector(s => s.auth.user)
  const { t }    = useTranslation()

  const [langOpen,    setLangOpen]    = useState(false)
  const [currentLang, setCurrentLang] = useState(localStorage.getItem('lang') || 'en')
  const [darkMode,    setDarkMode]    = useState(localStorage.getItem('theme') !== 'light')
  const langRef = useRef(null)

  const links = NAV.filter(l => !l.area || hasRole(user, l.area))

  const isActive = p => location.pathname === p
  const handleLogout = () => { dispatch(logout()); navigate('/login') }

  const switchLang = (code) => {
    i18n.changeLanguage(code)          // every page uses useTranslation, so no reload is needed
    localStorage.setItem('lang', code)
    setCurrentLang(code)
    setLangOpen(false)
    api.patch(`/auth/language?lang=${code}`).catch(() => {})   // remembered on other devices too
  }

  useEffect(() => {
    const handler = (e) => { if (langRef.current && !langRef.current.contains(e.target)) setLangOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => { applyTheme(darkMode) }, [])

  const applyTheme = (isDark) => {
    const r = document.documentElement
    r.dataset.theme = isDark ? 'dark' : 'light'   // lets CSS (e.g. map tiles) follow the theme
    if (isDark) {
      r.style.setProperty('--c-bg',      '#080d1a'); r.style.setProperty('--c-bg2',     '#0d1425')
      r.style.setProperty('--c-bg3',     '#111c30'); r.style.setProperty('--c-surface',  '#162035')
      r.style.setProperty('--c-surface2','#1c2a44'); r.style.setProperty('--c-border',  'rgba(96,165,250,0.1)')
      r.style.setProperty('--c-border2', 'rgba(96,165,250,0.25)')
      r.style.setProperty('--c-text',    '#e2e8f0'); r.style.setProperty('--c-text2',   '#94a3b8')
      r.style.setProperty('--c-text3',   '#475569'); document.body.style.background = '#080d1a'
    } else {
      r.style.setProperty('--c-bg',      '#f0f4f8'); r.style.setProperty('--c-bg2',     '#e2eaf3')
      r.style.setProperty('--c-bg3',     '#d4e0ed'); r.style.setProperty('--c-surface',  '#ffffff')
      r.style.setProperty('--c-surface2','#f8fafc'); r.style.setProperty('--c-border',  'rgba(59,130,246,0.15)')
      r.style.setProperty('--c-border2', 'rgba(59,130,246,0.3)')
      r.style.setProperty('--c-text',    '#0f172a'); r.style.setProperty('--c-text2',   '#475569')
      r.style.setProperty('--c-text3',   '#94a3b8'); document.body.style.background = '#f0f4f8'
    }
  }

  const toggleTheme = () => {
    const next = !darkMode; setDarkMode(next)
    localStorage.setItem('theme', next ? 'dark' : 'light'); applyTheme(next)
  }

  const currentLangObj = LANGS.find(l => l.code === currentLang) || LANGS[0]

  return (
    <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: darkMode ? 'rgba(8,13,26,0.92)' : 'rgba(240,244,248,0.92)', backdropFilter: 'blur(24px)', borderBottom: '1px solid var(--c-border)' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px', display: 'flex', alignItems: 'center', height: '56px', gap: '6px' }}>

        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', marginRight: '8px', flexShrink: 0 }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>🅿</div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: '800', fontSize: '16px' }}><span className="gradient-text">TPMS</span></span>
        </Link>

        {/* Nav links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flex: 1, overflowX: 'auto' }}>
          {links.map(({ to, icon, key, label }) => (
            <Link key={to} to={to} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: '500', textDecoration: 'none', whiteSpace: 'nowrap', transition: 'all 0.2s', color: isActive(to) ? '#60a5fa' : 'var(--c-text2)', background: isActive(to) ? 'rgba(59,130,246,0.12)' : 'transparent' }}>
              <span style={{ fontSize: '13px' }}>{icon}</span>{t(key, label)}
            </Link>
          ))}
        </div>

        {/* Right controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>

          {/* Dark/Light */}
          <button onClick={toggleTheme} title={darkMode ? t('nav.light_mode', 'Light mode') : t('nav.dark_mode', 'Dark mode')} aria-label={darkMode ? t('nav.light_mode', 'Light mode') : t('nav.dark_mode', 'Dark mode')}
            style={{ width: '34px', height: '34px', borderRadius: '9px', border: '1px solid var(--c-border)', background: 'var(--c-bg3)', cursor: 'pointer', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
            {darkMode ? '☀️' : '🌙'}
          </button>

          {/* Notification bell */}
          <NotificationBell />

          {/* Language dropdown */}
          <div style={{ position: 'relative' }} ref={langRef}>
            <button onClick={() => setLangOpen(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 10px', borderRadius: '9px', background: langOpen ? 'rgba(59,130,246,0.15)' : 'var(--c-bg3)', border: `1px solid ${langOpen ? 'rgba(59,130,246,0.4)' : 'var(--c-border)'}`, color: langOpen ? '#60a5fa' : 'var(--c-text2)', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.2s' }}>
              {currentLangObj.emoji} {currentLangObj.label} ▾
            </button>
            {langOpen && (
              <div style={{ position: 'absolute', top: '42px', right: 0, background: 'var(--c-surface)', border: '1px solid var(--c-border2)', borderRadius: '12px', padding: '6px', minWidth: '140px', boxShadow: '0 12px 40px rgba(0,0,0,0.5)', zIndex: 9999 }}>
                {LANGS.map(l => (
                  <button key={l.code} onClick={() => switchLang(l.code)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '9px 12px', borderRadius: '8px', border: 'none', background: currentLang === l.code ? 'rgba(59,130,246,0.15)' : 'transparent', color: currentLang === l.code ? '#60a5fa' : 'var(--c-text)', fontSize: '13px', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-body)', transition: 'background 0.15s' }}>
                    <span style={{ fontSize: '16px' }}>{l.emoji}</span>
                    <span>{l.full}</span>
                    {currentLang === l.code && <span style={{ marginLeft: 'auto', color: '#06d6a0' }}>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Profile */}
          <Link to="/profile" style={{ display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none', padding: '5px 8px', borderRadius: '9px', background: 'var(--c-bg3)', border: '1px solid var(--c-border)' }}>
            <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #06d6a0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '700', color: 'white' }}>
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <span style={{ fontSize: '12px', color: 'var(--c-text)', fontWeight: '500', maxWidth: '70px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name?.split(' ')[0]}
            </span>
          </Link>

          {/* Logout */}
          <button onClick={handleLogout} title={t('nav.logout', 'Logout')} aria-label={t('nav.logout', 'Logout')}
            style={{ width: '34px', height: '34px', borderRadius: '9px', background: 'rgba(239,35,60,0.1)', border: '1px solid rgba(239,35,60,0.2)', color: '#f87171', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ↩
          </button>
        </div>
      </div>
    </nav>
  )
}
