import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../utils/api'

export const fetchMyBookings = createAsyncThunk('bookings/fetchMy', async () => {
  const res = await api.get('/bookings/my')
  return res.data
})
export const cancelBooking = createAsyncThunk('bookings/cancel', async (id) => {
  await api.delete(`/bookings/${id}`)
  return id
})

const bookingsSlice = createSlice({
  name: 'bookings',
  initialState: { list: [], loading: false },
  reducers: {
    bookingUpdated(s, a) { s.list = s.list.map(b => b.id === a.payload.id ? a.payload : b) },
  },
  extraReducers: (b) => {
    b.addCase(fetchMyBookings.pending,   (s) => { s.loading = true })
     .addCase(fetchMyBookings.fulfilled, (s, a) => { s.loading = false; s.list = a.payload })
     .addCase(fetchMyBookings.rejected,  (s) => { s.loading = false })
     .addCase(cancelBooking.fulfilled, (s, a) => {
       s.list = s.list.map(bk => bk.id === a.payload ? { ...bk, status: 'cancelled' } : bk)
     })
  }
})
export const { bookingUpdated } = bookingsSlice.actions
export default bookingsSlice.reducer
