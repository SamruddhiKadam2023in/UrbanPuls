// Which roles may open each area (the API enforces the same rules)
export const ROLES = {
  staff:     ['admin', 'vendor'],            // dashboard, analytics, reports
  zones:     ['admin', 'vendor'],            // zone and slot management
  gate:      ['admin', 'vendor'],            // gate check-in / checkout
  detection: ['admin', 'vendor', 'police'],  // YOLO detection
  police:    ['admin', 'police'],            // complaint map and resolution
  admin:     ['admin'],                      // user management
}

export const hasRole = (user, area) => !!user && ROLES[area].includes(user.role)

// Every role lands on its own home page at "/" (see pages/Home.jsx)
export const homeFor = () => '/'
