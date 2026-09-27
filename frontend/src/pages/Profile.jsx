import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import api from '../utils/api'
import toast from 'react-hot-toast'

const LANGS = [
  { code: 'en', label: 'English', emoji: '🇬🇧' },
  { code: 'hi', label: 'हिंदी',   emoji: '🇮🇳' },
  { code: 'mr', label: 'मराठी',   emoji: '🟠'  },
]

export default function Profile() {
  const { t } = useTranslation()
  const user  = useSelector(s => s.auth.user)

  const switchLang = async (code) => {
    i18n.changeLanguage(code)
    localStorage.setItem('lang', code)
    try { await api.patch(`/auth/language?lang=${code}`) } catch {}
    toast.success(`Language changed!`)
  }

  if (!user) return null

  const ROLE_CONFIG = {
    admin:  { label: t('profile.roles.admin'),  badge: 'badge-pink',   emoji: '👑' },
    vendor: { label: t('profile.roles.vendor'), badge: 'badge-yellow', emoji: '🏢' },
    user:   { label: t('profile.roles.user'),   badge: 'badge-blue',   emoji: '👤' },
  }
  const rc = ROLE_CONFIG[user.role] || ROLE_CONFIG.user

  return (
    <div className="page-wrap fade-in">
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        <div className="card" style={{ padding: '32px', marginBottom: '16px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '80px', background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(6,214,160,0.1))', borderBottom: '1px solid var(--c-border)' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #06d6a0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: '800', color: 'white', margin: '0 auto 16px', fontFamily: 'var(--font-display)', boxShadow: '0 8px 32px rgba(59,130,246,0.3)', border: '3px solid var(--c-bg)' }}>
              {user.name?.[0]?.toUpperCase()}
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', color: 'var(--c-text)', marginBottom: '6px' }}>{user.name}</h2>
            <p style={{ fontSize: '13px', color: 'var(--c-text2)', marginBottom: '12px' }}>{user.email}</p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <span className={`badge ${rc.badge}`}>{rc.emoji} {rc.label}</span>
              {user.points > 0 && <span className="badge badge-purple">⭐ {user.points} {t('profile.points')}</span>}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '24px', marginBottom: '16px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '600', marginBottom: '18px', color: 'var(--c-text)' }}>{t('profile.title')}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { label: t('profile.name'),   value: user.name,                icon: '👤' },
              { label: t('profile.email'),  value: `${user.email} · ${user.email_verified ? 'verified ✓' : 'not verified'}`, icon: '📧' },
              { label: t('profile.phone'),  value: user.phone || t('profile.not_set'), icon: '📱' },
              { label: t('profile.role'),   value: rc.label,                 icon: rc.emoji },
              { label: t('profile.points'), value: `${user.points || 0} ${t('profile.points')}`, icon: '⭐' },
            ].map(({ label, value, icon }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px', background: 'var(--c-bg2)', borderRadius: '10px', border: '1px solid var(--c-border)' }}>
                <span style={{ fontSize: '18px', width: '28px', textAlign: 'center' }}>{icon}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '11px', color: 'var(--c-text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>{label}</p>
                  <p style={{ fontSize: '14px', color: 'var(--c-text)', fontWeight: '500' }}>{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '600', marginBottom: '18px', color: 'var(--c-text)' }}>{t('profile.settings')}</h3>
          <div>
            <p style={{ fontSize: '12px', color: 'var(--c-text2)', marginBottom: '10px', fontWeight: '500' }}>🌐 {t('profile.lang')}</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {LANGS.map(l => (
                <button key={l.code} onClick={() => switchLang(l.code)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '12px', border: `2px solid ${i18n.language === l.code ? 'var(--c-primary)' : 'var(--c-border)'}`, background: i18n.language === l.code ? 'rgba(59,130,246,0.12)' : 'var(--c-bg2)', color: i18n.language === l.code ? '#60a5fa' : 'var(--c-text)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: i18n.language === l.code ? '600' : '400', transition: 'all 0.2s' }}>
                  <span style={{ fontSize: '18px' }}>{l.emoji}</span>
                  {l.label}
                  {i18n.language === l.code && <span style={{ color: '#06d6a0', marginLeft: '4px' }}>✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
