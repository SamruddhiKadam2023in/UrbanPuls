import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../utils/api'

// ─── COMPLAINTS ──────────────────────────────────────────────────────────────
export const fetchMyComplaints = createAsyncThunk('complaints/fetchMy', async () => {
  const res = await api.get('/complaints/my')
  return res.data
})
const complaintsSlice = createSlice({
  name: 'complaints',
  initialState: { list: [], loading: false },
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchMyComplaints.pending,   (s) => { s.loading = true })
     .addCase(fetchMyComplaints.fulfilled, (s, a) => { s.loading = false; s.list = a.payload })
     .addCase(fetchMyComplaints.rejected,  (s) => { s.loading = false })
  }
})
export const complaintsReducer = complaintsSlice.reducer
export default complaintsSlice.reducer
