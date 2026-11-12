import 'server-only'

import https from 'https'
import axios from 'axios'

import { logger } from '@/lib/logger'
import { REQUEST_TIMEOUT, SAP_API_PATH, SAP_LOGIN_RETRIES, SAP_LOGIN_RETRY_DELAY } from '@/constants/sap'
import { SapAuthCookies, SapCredentials } from '@/types/sap'

//* read at call time, so a changed .env needs no rebuild of this module
export function getSapConfig() {
  const baseUrl = (process.env.SAP_BASE_URL || '').replace(/\/+$/, '')
  const userName = process.env.SAP_USERNAME || ''
  const password = process.env.SAP_PASSWORD || ''
  const missing = [!baseUrl && 'SAP_BASE_URL', !userName && 'SAP_USERNAME', !password && 'SAP_PASSWORD'].filter(Boolean)

  return { baseUrl, userName, password, apiUrl: `${baseUrl}${SAP_API_PATH}`, missing: missing as string[] }
}

//* one agent per process, most service layer installs self-sign their cert
let httpsAgent: https.Agent | null = null

export function getSapHttpsAgent() {
  if (!httpsAgent) {
    const rejectUnauthorized = process.env.SAP_TLS_REJECT_UNAUTHORIZED === 'true'
    httpsAgent = new https.Agent({ rejectUnauthorized, keepAlive: true })
  }

  return httpsAgent
}

export function toCookieHeader(session: SapAuthCookies) {
  return [session.b1session, session.routeid].filter(Boolean).join('; ')
}

//* v2 sends the message as a string, v1 as { lang, value }
export function toSapErrorMessage(sapError: any): string {
  const message = sapError?.message
  return typeof message === 'string' ? message : (message?.value ?? '')
}

//* picks the whole 'NAME=value' part out of each set-cookie line
function readCookie(setCookie: string[] | undefined, name: string) {
  const line = setCookie?.find((cookie) => cookie.startsWith(`${name}=`))
  return line ? line.split(';')[0] : undefined
}

//* isNoResponse means sap never answered, the choose-database page retries those itself
type SapLoginResult = { session: SapAuthCookies; sessionTimeout: number | null } | { error: string; isNoResponse?: boolean }

export type SapLoginOptions = { retries?: number }

//* no answer from sap at all, a wrong password or a sap refusal has a response and never retries
function isNoResponseError(err: any) {
  return !err?.response && ['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET'].includes(err?.code)
}

//* tries the login up to `retries` more times when sap does not answer
//? a timed out attempt may still have logged in on sap's side, that session idles out on its own
async function postLogin(apiUrl: string, credentials: SapCredentials, retries: number) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await axios.post(
        `${apiUrl}/Login`,
        { CompanyDB: credentials.companyDb, UserName: credentials.userName, Password: credentials.password },
        { httpsAgent: getSapHttpsAgent(), timeout: REQUEST_TIMEOUT, headers: { 'Content-Type': 'application/json' } }
      )
    } catch (err: any) {
      if (!isNoResponseError(err) || attempt > retries) throw err

      logger.warn({ companyDb: credentials.companyDb, attempt, code: err?.code }, 'SAP login got no answer, trying again')
      await new Promise((resolve) => setTimeout(resolve, SAP_LOGIN_RETRY_DELAY))
    }
  }
}

//* logs the shared service account into one company database
export async function sapLogin(companyDb: string, { retries = SAP_LOGIN_RETRIES }: SapLoginOptions = {}): Promise<SapLoginResult> {
  const config = getSapConfig()

  if (config.missing.length > 0) return { error: `Missing SAP settings: ${config.missing.join(', ')}` }

  const credentials: SapCredentials = { baseUrl: config.baseUrl, companyDb, userName: config.userName, password: config.password }

  try {
    const response = await postLogin(config.apiUrl, credentials, retries)

    const setCookie = response.headers['set-cookie']
    const b1session = readCookie(setCookie, 'B1SESSION')
    const routeid = readCookie(setCookie, 'ROUTEID')

    if (!b1session) {
      logger.error({ companyDb }, '[SAP_LOGIN_ERROR]: no B1SESSION cookie in the login response')
      return { error: 'SAP did not return a session cookie.' }
    }

    //* sap reports minutes, set per server in b1s.conf
    const reportedTimeout = Number(response.data?.SessionTimeout)
    const sessionTimeout = Number.isFinite(reportedTimeout) && reportedTimeout > 0 ? reportedTimeout * 60 * 1000 : null

    logger.info({ companyDb, hasRouteId: !!routeid, sessionTimeoutMinutes: sessionTimeout ? sessionTimeout / 60_000 : null }, 'SAP login successful') // prettier-ignore

    return { session: { b1session, routeid }, sessionTimeout }
  } catch (err: any) {
    const sapMessage = toSapErrorMessage(err?.response?.data?.error)
    const message = sapMessage || (err?.code === 'ECONNABORTED' || err?.code === 'ETIMEDOUT' ? `Connection to SAP timed out (${config.baseUrl}).` : err?.message) // prettier-ignore

    logger.error({ companyDb, code: err?.code, status: err?.response?.status }, `[SAP_LOGIN_ERROR]: ${message}`)

    return { error: message || 'SAP login failed.', isNoResponse: isNoResponseError(err) }
  }
}

//* best effort, a dead session cannot be logged out and that is fine
export async function sapLogout(session: SapAuthCookies) {
  const config = getSapConfig()

  if (!config.baseUrl) return

  try {
    await axios.post(
      `${config.apiUrl}/Logout`,
      {},
      { httpsAgent: getSapHttpsAgent(), timeout: REQUEST_TIMEOUT, headers: { Cookie: toCookieHeader(session) } }
    )

    logger.info('Old SAP session logged out')
  } catch (err: any) {
    logger.warn(`Failed to log out the old SAP session, it may already be expired: ${err?.message}`)
  }
}
