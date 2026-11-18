export const DEFAULT_TAB = '0'
export const UNAUTHORIZED_ROUTE = '/unauthorized'

export const isProd = process.env.NODE_ENV === 'production'
export const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

export const DEFAULT_PADDING_LENGTH = 4

//* pacific time (us & canada), date-based codes use this, not the server clock
export const BUSINESS_TIME_ZONE = 'America/Los_Angeles'
