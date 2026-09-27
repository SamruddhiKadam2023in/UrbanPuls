import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../utils/api'

export const login = createAsyncThunk('auth/login', async ({ email, password }, { rejectWithValue }) => {
  try {
    const form = new URLSearchParams()
    form.append('username', email)
    form.append('password', password)
    const res = await api.post('/auth/login', form, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
    localStorage.setItem('token', res.data.access_token)
    return res.data
  } catch (e) {
    return rejectWithValue(e.response?.data?.detail || 'Login failed')
  }
})

export const register = createAsyncThunk('auth/register', async (data, { rejectWithValue }) => {
  try {
    const res = await api.post('/auth/register', data)
    return res.data
  } catch (e) {
    return rejectWithValue(e.response?.data?.detail || 'Registration failed')
  }
})

export const fetchMe = createAsyncThunk('auth/fetchMe', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/auth/me')
    return res.data
  } catch (e) {
    return rejectWithValue('Session expired')
  }
})

const authSlice = createSlice({
  name: 'auth',
  initialState: { user: null, token: localStorage.getItem('token'), loading: false, error: null },
  reducers: {
    logout(state) {
      state.user = null
      state.token = null
      localStorage.removeItem('token')
    },
    clearError(state) { state.error = null }
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending,   (s) => { s.loading = true; s.error = null })
      .addCase(login.fulfilled, (s, a) => { s.loading = false; s.token = a.payload.access_token; s.user = a.payload.user })
      .addCase(login.rejected,  (s, a) => { s.loading = false; s.error = a.payload })
      .addCase(register.pending,   (s) => { s.loading = true; s.error = null })
      .addCase(register.fulfilled, (s) => { s.loading = false })
      .addCase(register.rejected,  (s, a) => { s.loading = false; s.error = a.payload })
      .addCase(fetchMe.fulfilled, (s, a) => { s.user = a.payload })
      .addCase(fetchMe.rejected,  (s) => { s.token = null; localStorage.removeItem('token') })
  }
})

export const { logout, clearError } = authSlice.actions
export default authSlice.reducer
