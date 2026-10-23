import 'server-only'

import axios from 'axios'

import { logger } from '@/lib/logger'
import { REQUEST_TIMEOUT } from '@/constants/sap'
import { SapResult } from '@/types/sap'
import { getSapConfig, getSapHttpsAgent, toCookieHeader } from './client'
import { getSapSession, invalidateSapSession } from './session'

type SapRequest = {
  path: string //* relative to /b1s/v1, e.g. 'BusinessPartners'
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  params?: Record<string, string | number>
  body?: unknown
  headers?: Record<string, string>
}

type Attempt<T> = { result: SapResult<T>; isSessionRejected: boolean; usedB1Session?: string }

//? keep this narrow, the session is shared by every user so a false positive forces an app wide re-login
function isSessionRejected(err: any) {
  const status = err?.response?.status
  const sapCode = String(err?.response?.data?.error?.code ?? '')
  const sapMessage = String(err?.response?.data?.error?.message?.value ?? '')

  if (status === 401) return true
  if (sapCode === '301' || sapCode === '-2001') return true

  return /invalid session|session (has )?(expired|terminated)/i.test(sapMessage)
}

//* every service layer call goes through here, dbCode is explicit so jobs and scripts can call it too
export async function sapFetch<T = unknown>(dbCode: string, req: SapRequest): Promise<SapResult<T>> {
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

async function sendOnce<T>(dbCode: string, req: SapRequest): Promise<Attempt<T>> {
  const sapSession = await getSapSession(dbCode)

  //* login itself failed, another login would fail the same way
  if (!sapSession.ok) return { result: { ok: false, status: 502, code: 'SAP_AUTH_FAILED', message: sapSession.message }, isSessionRejected: false } // prettier-ignore

  const usedB1Session = sapSession.session.b1session
  const path = req.path.replace(/^\/+/, '')

  try {
    const response = await axios.request<T>({
      url: `${getSapConfig().apiUrl}/${path}`,
      method: req.method ?? 'GET',
      params: req.params,
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
      message: sapError?.message?.value || err?.message || 'Failed to call SAP Service Layer.'
    }

    return { result, isSessionRejected: isSessionRejected(err), usedB1Session }
  }
}
