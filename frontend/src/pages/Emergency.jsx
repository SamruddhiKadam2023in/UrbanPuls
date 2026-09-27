import { useTranslation } from 'react-i18next'
import { speak } from '../utils/voice'
import i18n from '../i18n'

export default function Emergency() {
  const { t } = useTranslation()

  const SERVICES = [
    { key: 'police',    number: '100', emoji: '🚔', titleKey: 'police',    subKey: 'police_sub',    gradient: 'linear-gradient(135deg, #1e3a8a, #1d4ed8)', glow: 'rgba(29,78,216,0.4)', border: 'rgba(59,130,246,0.4)' },
    { key: 'ambulance', number: '108', emoji: '🚑', titleKey: 'ambulance', subKey: 'ambulance_sub', gradient: 'linear-gradient(135deg, #991b1b, #dc2626)', glow: 'rgba(220,38,38,0.4)',  border: 'rgba(239,68,68,0.4)'  },
    { key: 'fire',      number: '101', emoji: '🚒', titleKey: 'fire',      subKey: 'fire_sub',      gradient: 'linear-gradient(135deg, #92400e, #d97706)', glow: 'rgba(217,119,6,0.4)',  border: 'rgba(251,146,60,0.4)' },
  ]

  return (
    <div className="page-wrap fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #ef233c, #b91c1c)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', boxShadow: '0 8px 24px rgba(239,35,60,0.4)' }}>🆘</div>
          <div>
            <h1 className="section-header" style={{ fontSize: '26px' }}>{t('emergency.title')}</h1>
            <p className="section-sub">{t('emergency.subtitle')}</p>
          </div>
        </div>
      </div>

      <div style={{ background: 'rgba(239,35,60,0.08)', border: '1px solid rgba(239,35,60,0.25)', borderRadius: '14px', padding: '14px 18px', marginBottom: '28px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '20px' }}>⚡</span>
        <p style={{ fontSize: '13px', color: 'var(--c-text2)' }}>
          {t('emergency.note')}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '560px', margin: '0 auto' }}>
        {SERVICES.map(s => (
          <a key={s.key} href={`tel:${s.number}`}
            onClick={() => speak(`${t(`emergency.${s.titleKey}`)}`, i18n.language)}
            style={{ textDecoration: 'none', display: 'block' }}>
            <div style={{ background: s.gradient, border: `1px solid ${s.border}`, borderRadius: '20px', padding: '24px 28px', display: 'flex', alignItems: 'center', gap: '20px', boxShadow: `0 8px 32px ${s.glow}`, transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 16px 48px ${s.glow}` }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 8px 32px ${s.glow}` }}>
              <span style={{ fontSize: '48px', lineHeight: 1 }}>{s.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', color: 'white', marginBottom: '4px' }}>{t(`emergency.${s.titleKey}`)}</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>{t(`emergency.${s.subKey}`)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '36px', fontWeight: '800', color: 'white', lineHeight: 1 }}>{s.number}</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>📞 {t('emergency.tap')}</div>
              </div>
            </div>
          </a>
        ))}
      </div>

      <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--c-text3)', marginTop: '28px', fontFamily: 'var(--font-mono)' }}>
        {t('emergency.native_note')}
      </p>
    </div>
  )
}
