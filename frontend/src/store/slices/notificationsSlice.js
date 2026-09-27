import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../utils/api'

export const fetchNotifications = createAsyncThunk('notifications/fetch', async () => {
  const res = await api.get('/notifications/')
  return res.data
})
export const markRead = createAsyncThunk('notifications/markRead', async (id) => {
  await api.post(`/notifications/${id}/read`)
  return id
})
export const markAllRead = createAsyncThunk('notifications/markAllRead', async () => {
  await api.post('/notifications/read-all')
})
export const clearNotifications = createAsyncThunk('notifications/clear', async () => {
  await api.delete('/notifications/')
})

const slice = createSlice({
  name: 'notifications',
  initialState: { items: [], unread: 0, loaded: false },
  reducers: {
    notificationReceived(s, a) {
      if (s.items.some(n => n.id === a.payload.id)) return
      s.items.unshift(a.payload)
      s.items = s.items.slice(0, 100)
      if (!a.payload.is_read) s.unread += 1
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchNotifications.fulfilled, (s, a) => { s.items = a.payload.items; s.unread = a.payload.unread; s.loaded = true })
     .addCase(markRead.fulfilled, (s, a) => {
       const n = s.items.find(x => x.id === a.payload)
       if (n && !n.is_read) { n.is_read = true; s.unread = Math.max(0, s.unread - 1) }
     })
     .addCase(markAllRead.fulfilled, (s) => { s.items.forEach(n => { n.is_read = true }); s.unread = 0 })
     .addCase(clearNotifications.fulfilled, (s) => { s.items = []; s.unread = 0 })
  },
})

export const { notificationReceived } = slice.actions
export default slice.reducer
