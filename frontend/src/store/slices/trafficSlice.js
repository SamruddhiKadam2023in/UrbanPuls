import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../utils/api'

// ─── TRAFFIC ─────────────────────────────────────────────────────────────────
export const fetchHeatmap = createAsyncThunk('traffic/heatmap', async () => {
  const res = await api.get('/traffic/heatmap')
  return res.data
})
export const fetchPrediction = createAsyncThunk('traffic/predict', async (zoneId) => {
  const res = await api.get(`/traffic/predict/${zoneId}`)
  return res.data
})
const trafficSlice = createSlice({
  name: 'traffic',
  initialState: { heatmap: [], prediction: null, loading: false },
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchHeatmap.fulfilled,   (s, a) => { s.heatmap = a.payload })
     .addCase(fetchPrediction.pending,  (s) => { s.loading = true })
     .addCase(fetchPrediction.fulfilled,(s, a) => { s.loading = false; s.prediction = a.payload })
     .addCase(fetchPrediction.rejected, (s) => { s.loading = false })
  }
})
export default trafficSlice.reducer

// ─── DETECTION ───────────────────────────────────────────────────────────────
const detectionSlice = createSlice({
  name: 'detection',
  initialState: { results: [], violations: [], wsConnected: false },
  reducers: {
    addDetection:   (s, a) => { s.results.unshift(a.payload); if (s.results.length > 20) s.results.pop() },
    addViolation:   (s, a) => { s.violations.unshift(a.payload); if (s.violations.length > 20) s.violations.pop() },
    setWsConnected: (s, a) => { s.wsConnected = a.payload }
  }
})
export const { addDetection, addViolation, setWsConnected } = detectionSlice.actions
export const detectionReducer = detectionSlice.reducer
