import { useSelector } from 'react-redux'
import DriverHome from '../components/home/DriverHome'
import PartnerHome from '../components/home/PartnerHome'
import OfficerHome from '../components/home/OfficerHome'
import AdminHome from '../components/home/AdminHome'

// Each role gets a home page built around its own work
const HOMES = { user: DriverHome, vendor: PartnerHome, police: OfficerHome, admin: AdminHome }

export default function Home() {
  const role = useSelector(s => s.auth.user?.role)
  if (!role) return null            // wait for /auth/me
  const Page = HOMES[role] || DriverHome
  return <Page />
}
