import 'server-only'

import axios from 'axios'

import { logger } from '@/lib/logger'
import { REQUEST_TIMEOUT, SAP_DEFAULT_PAGE_SIZE } from '@/constants/sap'
import { SapQuery, SapResult } from '@/types/sap'
import { getSapConfig, getSapHttpsAgent, toCookieHeader, toSapErrorMessage } from './client'
import { getSapSession, invalidateSapSession } from './session'
import { SAP_ENDPOINTS, SapBodyOf, SapCollectionKey, SapEndpointKey, SapItemOf, SapMethod, SapParamsOf, SapResponseOf } from './endpoints'

type SapRequest = {
  path: string //* relative to the api root, query string included, e.g. 'BusinessPartners?$top=10'
  method?: SapMethod
  body?: unknown
  headers?: Record<string, string>
}

type Attempt<T> = { result: SapResult<T>; isSessionRejected: boolean; usedB1Session?: string }

//? keep this narrow, the session is shared by every user so a false positive forces an app wide re-login
function isSessionRejected(err: any) {
  const status = err?.response?.status
  const sapCode = String(err?.response?.data?.error?.code ?? '')
  const sapMessage = toSapErrorMessage(err?.response?.data?.error)

  if (status === 401) return true
  if (sapCode === '301' || sapCode === '-2001') return true

  return /invalid session|session (has )?(expired|terminated)/i.test(sapMessage)
}

//* every service layer call goes through here, dbCode is explicit so jobs and scripts can call it too
async function sapRequest<T = unknown>(dbCode: string, req: SapRequest): Promise<SapResult<T>> {
  if (!dbCode) return { ok: false, status: 400, code: 'SAP_NO_DATABASE', message: 'No SAP database selected.' }

  const first = await sendOnce<T>(dbCode, req)

  if (!first.isSessionRejected) return first.result

  //* the stored session died before its expiry, drop it and try once with a fresh login
  logger.warn({ dbCode, path: req.path }, 'SAP rejected the stored session, logging in again and retrying once')
  await invalidateSapSession(dbCode, first.usedB1Session)

  const retry = await sendOnce<T>(dbCode, req)

  //! one retry only, a second rejection is a real failure
  if (retry.isSessionRejected) logger.error({ dbCode, path: req.path }, '[SAP_FETCH_ERROR]: session rejected again after a fresh login')

  return retry.result
}

//* the last queued request per database, the next one waits on it
const requestQueue = new Map<string, Promise<unknown>>()

//! service layer runs one request per session at a time, parallel calls stall in ~7s steps, so they wait here instead
function enqueue<T>(dbCode: string, work: () => Promise<T>): Promise<T> {
  const previous = requestQueue.get(dbCode) ?? Promise.resolve()
  const next = previous.then(work, work)

  requestQueue.set(dbCode, next)

  const cleanup = () => {
    if (requestQueue.get(dbCode) === next) requestQueue.delete(dbCode)
  }

  next.then(cleanup, cleanup)

  return next
}

function sendOnce<T>(dbCode: string, req: SapRequest): Promise<Attempt<T>> {
  return enqueue(dbCode, () => sendNow<T>(dbCode, req))
}

async function sendNow<T>(dbCode: string, req: SapRequest): Promise<Attempt<T>> {
  const sapSession = await getSapSession(dbCode)

  //* login itself failed, another login would fail the same way
  if (!sapSession.ok) return { result: { ok: false, status: 502, code: 'SAP_AUTH_FAILED', message: sapSession.message }, isSessionRejected: false } // prettier-ignore

  const usedB1Session = sapSession.session.b1session
  const path = req.path.replace(/^\/+/, '')

  try {
    const response = await axios.request<T>({
      url: `${getSapConfig().apiUrl}/${path}`,
      method: req.method ?? 'GET',
      data: req.body,
      timeout: REQUEST_TIMEOUT,
      httpsAgent: getSapHttpsAgent(),
      headers: { 'Content-Type': 'application/json', ...req.headers, Cookie: toCookieHeader(sapSession.session) }
    })

    return { result: { ok: true, status: response.status, data: response.data }, isSessionRejected: false, usedB1Session }
  } catch (err: any) {
    const response = err?.response
    const sapError = response?.data?.error

    logger.error({ dbCode, path, status: response?.status, sapError }, `[SAP_FETCH_ERROR]: ${err?.message}`)

    const result: SapResult<T> = {
      ok: false,
      status: response?.status ?? 0,
      code: sapError?.code !== undefined ? String(sapError.code) : (err?.code ?? 'SAP_REQUEST_FAILED'),
      message: toSapErrorMessage(sapError) || err?.message || 'Failed to call SAP Service Layer.'
    }

    return { result, isSessionRejected: isSessionRejected(err), usedB1Session }
  }
}

type SapFetchOptions<K extends SapEndpointKey> = {
  query?: SapQuery
  headers?: Record<string, string>
} & ([SapParamsOf<K>] extends [undefined] ? { params?: undefined } : { params: SapParamsOf<K> }) &
  ([SapBodyOf<K>] extends [undefined] ? { body?: undefined } : { body: SapBodyOf<K> })

//* options are optional only when the endpoint needs no params and no body
type SapFetchArgs<K extends SapEndpointKey> = [SapParamsOf<K>, SapBodyOf<K>] extends [undefined, undefined]
  ? [opts?: SapFetchOptions<K>]
  : [opts: SapFetchOptions<K>]

//! built by hand, axios turns spaces into '+' and service layer reads that as a plus sign
function toQueryString(query?: SapQuery) {
  if (!query) return ''

  const parts = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)

  return parts.length > 0 ? `?${parts.join('&')}` : ''
}

//* typed call by endpoint key, see lib/sap/endpoints.ts
export async function sapFetch<K extends SapEndpointKey>(dbCode: string, key: K, ...[opts]: SapFetchArgs<K>) {
  const def = SAP_ENDPOINTS[key]
  const path = typeof def.path === 'function' ? (def.path as (params: unknown) => string)(opts?.params) : def.path

  //* sap caps a page at 20 rows unless asked for more, whatever $top says
  const pageHeader = def.method === 'GET' ? { Prefer: `odata.maxpagesize=${opts?.query?.$top ?? SAP_DEFAULT_PAGE_SIZE}` } : undefined

  return sapRequest<SapResponseOf<K>>(dbCode, {
    path: `${path}${toQueryString(opts?.query)}`,
    method: def.method,
    body: opts?.body,
    headers: { ...pageHeader, ...def.headers, ...opts?.headers }
  })
}

type SapFetchAllOptions = { query?: Omit<SapQuery, '$top'>; pageSize?: number; maxRows?: number }

//* walks a collection page by page until a short page or maxRows
export async function sapFetchAll<K extends SapCollectionKey>(
  dbCode: string,
  key: K,
  { query, pageSize = SAP_DEFAULT_PAGE_SIZE, maxRows = Infinity }: SapFetchAllOptions = {}
): Promise<SapResult<SapItemOf<K>[]>> {
  const rows: SapItemOf<K>[] = []
  let skip = query?.$skip ?? 0
  let status = 200

  while (rows.length < maxRows) {
    const top = Math.min(pageSize, maxRows - rows.length)
    const result = await sapFetch<SapCollectionKey>(dbCode, key, { query: { ...query, $top: top, $skip: skip } })

    if (!result.ok) return result

    const page = result.data.value as SapItemOf<K>[]

    status = result.status
    rows.push(...page)
    skip += page.length

    if (page.length < top) break
  }

  return { ok: true, status, data: rows }
}

//* a small list for a picker, an empty list on failure so the page still renders
export async function sapFetchLookup<K extends SapCollectionKey>(
  dbCode: string,
  key: K,
  opts: { query?: SapQuery } = {}
): Promise<SapItemOf<K>[]> {
  const result = await sapFetch<SapCollectionKey>(dbCode, key, opts)

  if (result.ok) return result.data.value as SapItemOf<K>[]

  logger.error({ dbCode, key, code: result.code, status: result.status }, `[SAP_FETCH_LOOKUP_ERROR]: ${result.message}`)
  return []
}
