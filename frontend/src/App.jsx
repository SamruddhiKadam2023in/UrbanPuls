import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { fetchMe } from './store/slices/authSlice'

import Navbar        from './components/common/Navbar'
import Login         from './pages/Login'
import Register      from './pages/Register'
import Home          from './pages/Home'
import MapPage       from './pages/MapPage'
import Bookings      from './pages/Bookings'
import Complaints    from './pages/Complaints'
import Emergency     from './pages/Emergency'
import Dashboard     from './pages/Dashboard'
import Detection     from './pages/Detection'
import Profile       from './pages/Profile'
import Notifications from './pages/NotificationsPage'
import Analytics from './pages/AnalyticsPage'

function ProtectedRoute({ children }) {
  const token = useSelector(s => s.auth.token)
  return token ? children : <Navigate to="/login" replace />
}

export default function App() {
  const dispatch = useDispatch()
  const token    = useSelector(s => s.auth.token)

  useEffect(() => { if (token) dispatch(fetchMe()) }, [token])

  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        {token && <Navbar />}
        <main style={{ flex: 1 }}>
          <Routes>
            <Route path="/login"         element={<Login />} />
            <Route path="/register"      element={<Register />} />
            <Route path="/"              element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/map"           element={<ProtectedRoute><MapPage /></ProtectedRoute>} />
            <Route path="/bookings"      element={<ProtectedRoute><Bookings /></ProtectedRoute>} />
            <Route path="/complaints"    element={<ProtectedRoute><Complaints /></ProtectedRoute>} />
            <Route path="/emergency"     element={<ProtectedRoute><Emergency /></ProtectedRoute>} />
            <Route path="/dashboard"     element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/detection"     element={<ProtectedRoute><Detection /></ProtectedRoute>} />
            <Route path="/profile"       element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
            <Route path="/analytics"     element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
            <Route path="*"              element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
