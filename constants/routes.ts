//* routes that are accessible by everyone - matched by prefix, so subpaths are public too
export const PUBLIC_ROUTES = ['/examples']

//* auth routes
export const AUTH_ROUTES = ['/signin']

//* auth api prefix
export const AUTH_API_PREFIX = '/api/auth'

//* sap database picker, shown after signin and the password gate
export const CHOOSE_DATABASE_ROUTE = '/choose-database'

//* request header the proxy sets with the current path, so server layouts can build a callbackUrl
export const PATHNAME_HEADER = 'x-pathname'

//* default login redirect
export const DEFAULT_SIGNIN_REDIRECT = '/dashboard' as const
