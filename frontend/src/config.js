// Details about who runs this TPMS installation, shown on the landing, privacy and terms pages.
// Set these at build time (frontend/.env.local, or build args in Docker) before going live.
export const SITE = {
  operator: import.meta.env.VITE_OPERATOR_NAME || 'TPMS',
  contactEmail: import.meta.env.VITE_CONTACT_EMAIL || 'support@example.com',
  city: import.meta.env.VITE_CITY || 'Mumbai',
}
