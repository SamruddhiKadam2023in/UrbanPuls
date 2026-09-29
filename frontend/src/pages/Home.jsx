import { useSelector } from 'react-redux'
import DriverHome from '../components/home/DriverHome'
import PartnerHome from '../components/home/PartnerHome'
import OfficerHome from '../components/home/OfficerHome'
import AdminHome from '../components/home/AdminHome'
import Gate from './Gate'

// Each role gets a home page built around its own work
// Gate attendants only ever need the Gate screen
const HOMES = { user: DriverHome, vendor: PartnerHome, police: OfficerHome, admin: AdminHome, attendant: Gate }

export default function Home() {
  const role = useSelector(s => s.auth.user?.role)
  if (!role) return null            // wait for /auth/me
  const Page = HOMES[role] || DriverHome
  return <Page />
}
