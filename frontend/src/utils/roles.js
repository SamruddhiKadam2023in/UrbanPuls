// Which roles may open each staff area (the API enforces the same rules)
export const ROLES = {
  staff:     ['admin', 'vendor'],            // dashboard, analytics
  gate:      ['admin', 'vendor'],            // gate check-in / checkout
  detection: ['admin', 'vendor', 'police'],  // YOLO detection
  admin:     ['admin'],
}

export const hasRole = (user, area) => !!user && ROLES[area].includes(user.role)
