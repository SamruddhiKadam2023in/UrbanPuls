import i18n from '../../i18n'
import { useTranslation } from 'react-i18next'

const LANGS = [['en', 'EN'], ['hi', 'हिं'], ['mr', 'मर']]

/** Compact language buttons for pages shown before sign-in */
export default function LangSwitch() {
  useTranslation()   // re-render when the language changes
  const change = (code) => { i18n.changeLanguage(code); localStorage.setItem('lang', code) }
  return (
    <div style={{ display: 'flex', gap: '4px', background: 'var(--c-bg3)', padding: '3px', borderRadius: '10px' }}>
      {LANGS.map(([code, label]) => (
        <button key={code} onClick={() => change(code)} aria-pressed={i18n.language === code}
          style={{ padding: '5px 10px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-body)',
            background: i18n.language === code ? 'var(--c-surface2)' : 'transparent', color: i18n.language === code ? 'var(--c-text)' : 'var(--c-text2)' }}>
          {label}
        </button>
      ))}
    </div>
  )
}
