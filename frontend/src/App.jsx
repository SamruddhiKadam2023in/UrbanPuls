import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { fetchMe } from './store/slices/authSlice'
import { hasRole } from './utils/roles'
import i18n from './i18n'

import Navbar         from './components/common/Navbar'
import VerifyBanner   from './components/common/VerifyBanner'
import LiveConnection from './components/common/LiveConnection'
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
import Zones          from './pages/Zones'
import Admin          from './pages/Admin'
import Police         from './pages/Police'
import Staff          from './pages/Staff'
import Cameras        from './pages/Cameras'
import Landing        from './pages/Landing'
import { Privacy, Terms } from './pages/Legal'

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

  const user     = useSelector(s => s.auth.user)

  useEffect(() => { if (token) dispatch(fetchMe()) }, [token])

  // On a new device, start in the language saved on the account
  useEffect(() => {
    if (user?.preferred_lang && !localStorage.getItem('lang') && user.preferred_lang !== i18n.language) {
      i18n.changeLanguage(user.preferred_lang)
    }
  }, [user?.preferred_lang])

  const p = (el, area) => <ProtectedRoute area={area}>{el}</ProtectedRoute>

  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        {token && <Navbar />}
        {token && <VerifyBanner />}
        <LiveConnection />
        <main style={{ flex: 1 }}>
          <Routes>
            <Route path="/login"           element={<Login />} />
            <Route path="/register"        element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password"  element={<ResetPassword />} />
            <Route path="/verify-email"    element={<VerifyEmail />} />
            <Route path="/"              element={token ? p(<Home />) : <Landing />} />
            <Route path="/privacy"       element={<Privacy />} />
            <Route path="/terms"         element={<Terms />} />
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
            <Route path="/zones"         element={p(<Zones />, 'zones')} />
            <Route path="/police"        element={p(<Police />, 'police')} />
            <Route path="/admin"         element={p(<Admin />, 'admin')} />
            <Route path="/staff"         element={p(<Staff />, 'partner')} />
            <Route path="/cameras"       element={p(<Cameras />, 'detection')} />
            <Route path="*"              element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
