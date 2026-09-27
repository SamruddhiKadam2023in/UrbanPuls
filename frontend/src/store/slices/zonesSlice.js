import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../utils/api'

// ─── ZONES ───────────────────────────────────────────────────────────────────
export const fetchZones = createAsyncThunk('zones/fetchAll', async () => {
  const res = await api.get('/zones/')
  return res.data
})
const zonesSlice = createSlice({
  name: 'zones',
  initialState: { list: [], loading: false, selected: null },
  reducers: { selectZone: (s, a) => { s.selected = a.payload } },
  extraReducers: (b) => {
    b.addCase(fetchZones.pending,   (s) => { s.loading = true })
     .addCase(fetchZones.fulfilled, (s, a) => { s.loading = false; s.list = a.payload })
     .addCase(fetchZones.rejected,  (s) => { s.loading = false })
  }
})
export const { selectZone } = zonesSlice.actions
export const zonesReducer = zonesSlice.reducer
export default zonesSlice.reducer
