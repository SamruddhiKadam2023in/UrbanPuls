import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { format, subDays } from 'date-fns'
import api, { errorMessage } from '../../utils/api'
import { rupees } from '../../utils/format'

const today = () => format(new Date(), 'yyyy-MM-dd')

export default function RevenueReport() {
  const { t } = useTranslation()
  const [zones, setZones] = useState([])
  const [params, setParams] = useState({ period: 'day', start: format(subDays(new Date(), 29), 'yyyy-MM-dd'), end: today(), zone_id: '' })
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => { api.get('/zones/manage/mine').then(r => setZones(r.data)).catch(() => {}) }, [])

  const query = () => ({ ...params, zone_id: params.zone_id || undefined })

  useEffect(() => {
    setLoading(true)
    api.get('/vendors/report', { params: query() })
      .then(r => setReport(r.data))
      .catch(e => toast.error(errorMessage(e)))
      .finally(() => setLoading(false))
  }, [params])

  const download = async (fmt) => {
    try {
      const res = await api.get('/vendors/report', { params: { ...query(), format: fmt }, responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url; a.download = `tpms_report_${params.period}_${params.start}_${params.end}.${fmt}`; a.click()
      URL.revokeObjectURL(url)
    } catch (e) { toast.error(errorMessage(e)) }
  }

  const set = (k) => (e) => setParams(p => ({ ...p, [k]: e.target.value }))
  const cols = [
    ['reservations', t('report.reservations', 'Reservations')], ['walk_ins', t('report.walk_ins', 'Walk-ins')],
    ['completed', t('report.completed', 'Completed')], ['no_shows', t('report.no_shows', 'No-shows')],
    ['cash', t('report.cash', 'Cash'), true], ['upi', t('report.upi', 'UPI'), true], ['revenue', t('report.revenue', 'Revenue'), true],
  ]

  return (
    <div className="card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 600, color: 'var(--c-text)' }}>💰 {t('report.title', 'Revenue report')}</h3>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => download('csv')}>⬇ CSV</button>
          <button className="btn btn-ghost btn-sm" onClick={() => download('pdf')}>⬇ PDF</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '16px' }}>
        <div>
          <label className="label">{t('report.group_by', 'Group by')}</label>
          <select className="input" value={params.period} onChange={set('period')}>
            <option value="day">{t('report.day', 'Day')}</option>
            <option value="week">{t('report.week', 'Week')}</option>
            <option value="month">{t('report.month', 'Month')}</option>
          </select>
        </div>
        <div><label className="label">{t('report.from', 'From')}</label><input className="input" type="date" value={params.start} max={params.end} onChange={set('start')} /></div>
        <div><label className="label">{t('report.to', 'To')}</label><input className="input" type="date" value={params.end} min={params.start} max={today()} onChange={set('end')} /></div>
        <div>
          <label className="label">{t('report.zone', 'Zone')}</label>
          <select className="input" value={params.zone_id} onChange={set('zone_id')}>
            <option value="">{t('report.all_zones', 'All zones')}</option>
            {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>
      </div>

      {report && (
        <div style={{ overflowX: 'auto', opacity: loading ? 0.5 : 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ color: 'var(--c-text3)', fontSize: '11px', textTransform: 'uppercase' }}>
                <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid var(--c-border)' }}>{t('report.period', 'Period')}</th>
                {cols.map(([k, l]) => <th key={k} style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid var(--c-border)' }}>{l}</th>)}
              </tr>
            </thead>
            <tbody>
              {report.rows.length === 0 && <tr><td colSpan={cols.length + 1} style={{ padding: '24px', textAlign: 'center', color: 'var(--c-text3)' }}>{t('report.empty', 'No activity in this period')}</td></tr>}
              {report.rows.map(r => (
                <tr key={r.start} style={{ borderBottom: '1px solid var(--c-border)' }}>
                  <td style={{ padding: '8px', color: 'var(--c-text)' }}>{r.period}</td>
                  {cols.map(([k, , money]) => <td key={k} style={{ padding: '8px', textAlign: 'right', color: 'var(--c-text2)', fontFamily: 'var(--font-mono)' }}>{money ? rupees(r[k]) : r[k]}</td>)}
                </tr>
              ))}
              {report.rows.length > 0 && (
                <tr style={{ fontWeight: 700 }}>
                  <td style={{ padding: '8px', color: 'var(--c-text)' }}>{t('report.total', 'Total')}</td>
                  {cols.map(([k, , money]) => <td key={k} style={{ padding: '8px', textAlign: 'right', color: k === 'revenue' ? '#06d6a0' : 'var(--c-text)', fontFamily: 'var(--font-mono)' }}>{money ? rupees(report.totals[k]) : report.totals[k]}</td>)}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
