import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { fetchMe } from './store/slices/authSlice'
import { hasRole } from './utils/roles'

import Navbar         from './components/common/Navbar'
import VerifyBanner   from './components/common/VerifyBanner'
import Login          from './pages/Login'
import Register       from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword  from './pages/ResetPassword'
import VerifyEmail    from './pages/VerifyEmail'
import Home           from './pages/Home'
import MapPage        from './pages/MapPage'
import Bookings       from './pages/Bookings'
import Complaints     from './pages/Complaints'
import Emergency      from './pages/Emergency'
import Dashboard      from './pages/Dashboard'
import Detection      from './pages/Detection'
import Gate           from './pages/Gate'
import Profile        from './pages/Profile'
import Notifications  from './pages/NotificationsPage'
import Analytics      from './pages/AnalyticsPage'

function ProtectedRoute({ children, area }) {
  const token = useSelector(s => s.auth.token)
  const user  = useSelector(s => s.auth.user)
  if (!token) return <Navigate to="/login" replace />
  if (area) {
    if (!user) return null                       // wait for /auth/me before deciding
    if (!hasRole(user, area)) return <Navigate to="/" replace />
  }
  return children
}

export default function App() {
  const dispatch = useDispatch()
  const token    = useSelector(s => s.auth.token)

  useEffect(() => { if (token) dispatch(fetchMe()) }, [token])

  const p = (el, area) => <ProtectedRoute area={area}>{el}</ProtectedRoute>

  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        {token && <Navbar />}
        {token && <VerifyBanner />}
        <main style={{ flex: 1 }}>
          <Routes>
            <Route path="/login"           element={<Login />} />
            <Route path="/register"        element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password"  element={<ResetPassword />} />
            <Route path="/verify-email"    element={<VerifyEmail />} />
            <Route path="/"              element={p(<Home />)} />
            <Route path="/map"           element={p(<MapPage />)} />
            <Route path="/bookings"      element={p(<Bookings />)} />
            <Route path="/complaints"    element={p(<Complaints />)} />
            <Route path="/emergency"     element={p(<Emergency />)} />
            <Route path="/profile"       element={p(<Profile />)} />
            <Route path="/notifications" element={p(<Notifications />)} />
            <Route path="/dashboard"     element={p(<Dashboard />, 'staff')} />
            <Route path="/analytics"     element={p(<Analytics />, 'staff')} />
            <Route path="/gate"          element={p(<Gate />, 'gate')} />
            <Route path="/detection"     element={p(<Detection />, 'detection')} />
            <Route path="*"              element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
