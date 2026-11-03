export const REQUEST_TIMEOUT = 30_000 //* 30 seconds
export const SESSION_TIMEOUT = 30 * 60 * 1000 //* fallback when sap does not report one
export const EXPIRY_BUFFER = 60 * 1000 //* treat a session as expired a minute early

export const SAP_LOGIN_RETRIES = 2 //* extra login tries when sap does not answer, so 3 in all
export const SAP_LOGIN_RETRY_DELAY = 1000 //* pause between those tries

//* the service layer api root, appended to SAP_BASE_URL
export const SAP_API_PATH = '/b1s/v2'

//* rows per page when walking a whole collection
export const SAP_DEFAULT_PAGE_SIZE = 500

//* turns paging off, only for small lookup lists, never master data
export const SAP_NO_PAGINATION = 'odata.maxpagesize=0'

export const DEFAULT_SAP_DATABASES = [
  { dbCode: 'OMEGA_P02', name: 'Omega Global Technologies Inc. ', order: 1 },
  { dbCode: 'OMEGA_P02_TESTING', name: 'US (Testing)', order: 2 },
  { dbCode: 'OMEGA_PHIL', name: 'Omega GTI Asia Inc.', order: 3 },
  { dbCode: 'OMEGA_PHIL_TESTING', name: 'PH (Testing)', order: 4 }
]
