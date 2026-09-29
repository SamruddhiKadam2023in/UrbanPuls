import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../utils/api'
import { SITE } from '../config'
import LangSwitch from '../components/common/LangSwitch'

export function PublicHeader() {
  const { t } = useTranslation()
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(8,13,26,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--c-border)' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', marginRight: 'auto' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🅿</div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}><span className="gradient-text">UrbanPuls</span></span>
        </Link>
        <LangSwitch />
        <Link to="/login" className="btn btn-ghost btn-sm">{t('auth.sign_in', 'Sign in')}</Link>
        <Link to="/register" className="btn btn-primary btn-sm">{t('landing.get_started', 'Get started')}</Link>
      </div>
    </header>
  )
}

export function PublicFooter() {
  const { t } = useTranslation()
  return (
    <footer style={{ borderTop: '1px solid var(--c-border)', marginTop: '48px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 20px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', fontSize: '13px', color: 'var(--c-text3)' }}>
        <span style={{ marginRight: 'auto' }}>© {new Date().getFullYear()} {SITE.operator}</span>
        <Link to="/privacy" style={{ color: 'var(--c-text2)' }}>{t('landing.privacy', 'Privacy policy')}</Link>
        <Link to="/terms" style={{ color: 'var(--c-text2)' }}>{t('landing.terms', 'Terms of use')}</Link>
        <a href={`mailto:${SITE.contactEmail}`} style={{ color: 'var(--c-text2)' }}>{SITE.contactEmail}</a>
      </div>
    </footer>
  )
}

export default function Landing() {
  const { t } = useTranslation()
  const [stats, setStats] = useState(null)

  useEffect(() => {
    api.get('/zones/').then(r => {
      const zones = r.data
      const sum = (vt) => zones.reduce((a, z) => a + (z.available_by_type?.[vt] || 0), 0)
      setStats({ lots: zones.length, cars: sum('four_wheeler'), bikes: sum('two_wheeler') })
    }).catch(() => {})
  }, [])

  const steps = [
    ['🗺️', t('landing.step1', 'Find a lot'), t('landing.step1_text', 'See free car and two-wheeler slots near you, with prices and ratings.')],
    ['📱', t('landing.step2', 'Reserve in seconds'), t('landing.step2_text', 'Pick your time and slot. You get a QR code. Nothing to pay yet.')],
    ['🚧', t('landing.step3', 'Pay at the gate'), t('landing.step3_text', 'Show the code, park, and pay in cash or UPI only for the time you actually used.')],
  ]
  const audiences = [
    ['🚗', t('who.user_title', 'Drivers'), t('landing.drivers_text', 'No more circling the block. Reserve a slot, get reminders, earn reward points for reporting problems.'), '/register', t('who.user_cta', 'Sign up')],
    ['🏢', t('who.vendor_title', 'Parking Partners'), t('landing.partners_text', 'Fill your lot with bookings. Check cars in with a QR scan, collect cash or UPI, and see daily reports. Add your gate staff.'), '/register', t('who.vendor_cta', 'Become a partner')],
    ['🦺', t('who.police_title', 'Field Officers'), t('landing.officers_text', 'Get verified reports of illegal parking and road blockages on a map, and close them when handled.'), null, null],
  ]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PublicHeader />
      <main style={{ flex: 1 }}>
        <section style={{ maxWidth: '1100px', margin: '0 auto', padding: '56px 20px 32px', textAlign: 'center' }}>
          <p className="badge badge-green" style={{ marginBottom: '16px' }}>📍 {SITE.city}</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(30px, 6vw, 52px)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em', color: 'var(--c-text)', maxWidth: '800px', margin: '0 auto 16px' }}>
            {t('landing.headline', 'Find parking before you leave home.')} <span className="gradient-text">{t('landing.headline2', 'Pay only when you park.')}</span>
          </h1>
          <p style={{ fontSize: '17px', color: 'var(--c-text2)', maxWidth: '620px', margin: '0 auto 28px', lineHeight: 1.6 }}>
            {t('landing.subhead', 'Reserve car and two-wheeler parking in seconds, show a QR code at the gate, and pay in cash or UPI for the time you actually used.')}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/register" className="btn btn-primary btn-lg">{t('landing.cta', 'Reserve parking')} →</Link>
            <Link to="/login" className="btn btn-ghost btn-lg">{t('auth.sign_in', 'Sign in')}</Link>
          </div>

          {stats && (
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '36px' }}>
              {[[stats.lots, t('landing.stat_lots', 'parking lots')], [stats.cars, t('landing.stat_cars', 'car slots free now')], [stats.bikes, t('landing.stat_bikes', 'two-wheeler slots free now')]].map(([n, l]) => (
                <div key={l} className="card" style={{ padding: '14px 22px', minWidth: '160px' }}>
                  <div className="stat-num gradient-text">{n}</div>
                  <div className="stat-label">{l}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 20px' }}>
          <h2 className="section-header" style={{ textAlign: 'center', fontSize: '24px', marginBottom: '20px' }}>{t('landing.how', 'How it works')}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
            {steps.map(([icon, title, text], i) => (
              <div key={title} className="card" style={{ padding: '22px' }}>
                <div style={{ fontSize: '28px', marginBottom: '10px' }}>{icon}</div>
                <div style={{ fontSize: '12px', color: 'var(--c-primary-light)', fontWeight: 700, marginBottom: '4px' }}>{i + 1}</div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '17px', color: 'var(--c-text)', marginBottom: '6px' }}>{title}</h3>
                <p style={{ fontSize: '14px', color: 'var(--c-text2)', lineHeight: 1.6 }}>{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 20px' }}>
          <h2 className="section-header" style={{ textAlign: 'center', fontSize: '24px', marginBottom: '20px' }}>{t('who.title', 'Who is UrbanPuls for?')}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            {audiences.map(([icon, title, text, link, cta]) => (
              <div key={title} className="card" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '28px' }}>{icon}</div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', color: 'var(--c-text)' }}>{title}</h3>
                <p style={{ fontSize: '14px', color: 'var(--c-text2)', lineHeight: 1.6, flex: 1 }}>{text}</p>
                {link && <Link to={link} className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start' }}>{cta} →</Link>}
              </div>
            ))}
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  )
}
