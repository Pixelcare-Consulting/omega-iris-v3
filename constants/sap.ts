export const REQUEST_TIMEOUT = 30_000 //* 30 seconds
export const SESSION_TIMEOUT = 30 * 60 * 1000 //* fallback when sap does not report one
export const EXPIRY_BUFFER = 60 * 1000 //* treat a session as expired a minute early

//* the service layer api root, appended to SAP_BASE_URL
export const SAP_API_PATH = '/b1s/v2'

export const DEFAULT_SAP_DATABASES = [
  { dbCode: 'PXC-LIVE_PH_2025', name: 'PXC PH', order: 1 },
  { dbCode: 'PXC-LIVE_SG_2025', name: 'PXC SG', order: 2 },
  { dbCode: 'PXC-LIVE_MY_2025', name: 'PXC MY', order: 3 },
  { dbCode: 'PXC-DB_PH_TESTING', name: 'PXC PH (Testing)', order: 4 },
  { dbCode: 'PXC-DB_SG_TESTING', name: 'PXC SG (Testing)', order: 5 }
]
