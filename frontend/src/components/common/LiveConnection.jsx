import { useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import { wsUrl } from '../../utils/api'
import { fetchZones } from '../../store/slices/zonesSlice'
import { fetchMyBookings } from '../../store/slices/bookingsSlice'
import { fetchNotifications, notificationReceived } from '../../store/slices/notificationsSlice'
import { addViolation, setWsConnected } from '../../store/slices/detectionSlice'
import { fetchMe } from '../../store/slices/authSlice'
import { speakViolationAlert } from '../../utils/voice'
import i18n from '../../i18n'

const BOOKING_TYPES = ['booking', 'checkin', 'checkout', 'no_show', 'reminder']
const ICONS = { booking: '📋', checkin: '🚗', checkout: '🧾', reminder: '⏰', no_show: '⚠️', complaint: '📣', account: '👤' }

// Other components can react to live zone changes with: window.addEventListener('tpms:zone_changed', ...)
export const ZONE_EVENT = 'tpms:zone_changed'

/** Keeps one WebSocket open while signed in and routes events into the store. Renders nothing. */
export default function LiveConnection() {
  const dispatch = useDispatch()
  const token = useSelector(s => s.auth.token)
  const zoneTimer = useRef(null)

  useEffect(() => {
    if (!token) return
    dispatch(fetchNotifications())

    let ws, ping, retryTimer
    let attempt = 0
    let stopped = false

    const handle = (msg) => {
      if (msg.type === 'notification') {
        const n = msg.notification
        dispatch(notificationReceived(n))
        toast(n.title, { icon: ICONS[n.type] || '🔔', duration: 5000 })
        if (BOOKING_TYPES.includes(n.type)) dispatch(fetchMyBookings())
        if (n.type === 'account' || n.type === 'checkout' || n.type === 'complaint') dispatch(fetchMe())   // role / points changed
      } else if (msg.type === 'zone_changed') {
        window.dispatchEvent(new CustomEvent(ZONE_EVENT, { detail: { zoneId: msg.zone_id } }))
        // Several changes often arrive together (check-in + slot update); refresh once
        clearTimeout(zoneTimer.current)
        zoneTimer.current = setTimeout(() => dispatch(fetchZones()), 400)
      } else if (msg.type === 'violation') {
        dispatch(addViolation(msg))
        toast.error(`🚨 ${i18n.t('detection.live_alert', 'Illegal parking detected')}${msg.camera ? `: ${msg.camera}` : ''}`, { id: 'violation' })
        speakViolationAlert(i18n.language)
      }
    }

    const connect = () => {
      ws = new WebSocket(wsUrl('/live/ws'))
      ws.onopen = () => {
        attempt = 0
        dispatch(setWsConnected(true))
        ping = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send('ping'), 25000)
      }
      ws.onmessage = (e) => { try { handle(JSON.parse(e.data)) } catch { /* ignore malformed */ } }
      ws.onclose = (e) => {
        clearInterval(ping)
        dispatch(setWsConnected(false))
        if (stopped || e.code === 1008) return          // 1008 = login rejected; don't retry
        const delay = Math.min(30000, 1000 * 2 ** attempt++)
        retryTimer = setTimeout(connect, delay)
      }
    }
    connect()

    return () => {
      stopped = true
      clearTimeout(retryTimer)
      clearInterval(ping)
      clearTimeout(zoneTimer.current)
      ws?.close()
    }
  }, [token])

  return null
}
