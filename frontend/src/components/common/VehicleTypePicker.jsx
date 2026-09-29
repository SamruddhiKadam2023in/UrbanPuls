import { useTranslation } from 'react-i18next'

export const VEHICLE_ICON = { four_wheeler: '🚗', two_wheeler: '🏍' }

/** 🚗 Car / 🏍 Two-wheeler toggle. `types` limits the choice to what the lot offers. */
export default function VehicleTypePicker({ value, onChange, types = ['four_wheeler', 'two_wheeler'], hint }) {
  const { t } = useTranslation()
  const label = { four_wheeler: t('vehicle.four_wheeler', 'Car'), two_wheeler: t('vehicle.two_wheeler', 'Two-wheeler') }
  return (
    <div>
      <label className="label">{t('vehicle.type', 'Vehicle type')}</label>
      <div style={{ display: 'flex', gap: '8px' }}>
        {types.map(vt => {
          const sel = value === vt
          return (
            <button key={vt} type="button" onClick={() => onChange(vt)} aria-pressed={sel}
              style={{ flex: 1, padding: '10px', borderRadius: '10px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: sel ? 600 : 400,
                border: `2px solid ${sel ? 'var(--c-primary)' : 'var(--c-border)'}`, background: sel ? 'rgba(59,130,246,0.12)' : 'var(--c-bg2)', color: sel ? '#60a5fa' : 'var(--c-text)' }}>
              {VEHICLE_ICON[vt]} {label[vt]}
              {hint?.[vt] && <div style={{ fontSize: '11px', color: 'var(--c-text3)', fontWeight: 400, marginTop: '2px' }}>{hint[vt]}</div>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
