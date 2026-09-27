import { format } from 'date-fns'

export const rupees = (n) => `₹${Number(n || 0).toFixed(Number(n) % 1 === 0 ? 0 : 2)}`

export const fmtDateTime = (iso) => (iso ? format(new Date(iso), 'dd MMM yy, hh:mm a') : '—')
export const fmtTime = (iso) => (iso ? format(new Date(iso), 'hh:mm a') : '—')

// Value for <input type="datetime-local"> in the browser's own timezone
const pad = (n) => String(n).padStart(2, '0')
export const toLocalInput = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`

// datetime-local values have no timezone; convert to an ISO string with one before sending
export const localInputToISO = (v) => new Date(v).toISOString()

export const minutesToText = (m) => {
  const h = Math.floor(m / 60), r = Math.round(m % 60)
  return h ? `${h}h${r ? ` ${r}m` : ''}` : `${r}m`
}

export const STATUS = {
  reserved:   { label: 'Reserved',   badge: 'badge-blue'   },
  checked_in: { label: 'Parked',     badge: 'badge-green'  },
  completed:  { label: 'Completed',  badge: 'badge-purple' },
  cancelled:  { label: 'Cancelled',  badge: 'badge-red'    },
  no_show:    { label: 'No-show',    badge: 'badge-yellow' },
}

