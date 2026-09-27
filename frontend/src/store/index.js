import { configureStore } from '@reduxjs/toolkit'
import authReducer          from './slices/authSlice'
import zonesReducer         from './slices/zonesSlice'
import bookingsReducer      from './slices/bookingsSlice'
import complaintsReducer    from './slices/complaintsSlice'
import trafficReducer       from './slices/trafficSlice'
import detectionReducer     from './slices/detectionSlice'
import notificationsReducer from './slices/notificationsSlice'

export const store = configureStore({
  reducer: {
    auth:          authReducer,
    zones:         zonesReducer,
    bookings:      bookingsReducer,
    complaints:    complaintsReducer,
    traffic:       trafficReducer,
    detection:     detectionReducer,
    notifications: notificationsReducer,
  }
})
