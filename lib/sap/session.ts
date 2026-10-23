import 'server-only'

import db from '@/lib/db'
import { logger } from '@/lib/logger'
import { EXPIRY_BUFFER, SESSION_TIMEOUT } from '@/constants/sap'
import { SapAuthCookies } from '@/types/sap'
import { sapLogin, sapLogout } from './client'

//* one shared service account session per database, reused by every user
//! app signout must never log out of sap, the session belongs to the database not the user

type GetSapSessionResult = { ok: true; session: SapAuthCookies } | { ok: false; message: string }

//* one login at a time per database, so a slow login on one cannot stall another
const refreshInflight = new Map<string, Promise<GetSapSessionResult>>()

function toCookies(stored: { b1Session: string; routeId: string | null }): SapAuthCookies {
  return { b1session: stored.b1Session, routeid: stored.routeId ?? undefined }
}

//* the stored session, plus whether it is still inside its validity window
//* an inactive database is never valid, so the refresh logs its session out
async function readSession(dbCode: string) {
  const stored = await db.sapSession.findUnique({ where: { dbCode }, include: { sapDatabase: { select: { isActive: true } } } })
  const isValid = !!stored?.b1Session && stored.sapDatabase.isActive && stored.expiresAt.getTime() - EXPIRY_BUFFER > Date.now()

  return { stored, isValid }
}

export async function getSapSession(dbCode: string): Promise<GetSapSessionResult> {
  if (!dbCode) return { ok: false, message: 'No SAP database selected.' }

  try {
    //* fast path, a valid session needs no lock
    const cached = await readSession(dbCode)

    if (cached.stored && cached.isValid) return { ok: true, session: toCookies(cached.stored) }

    //* a refresh for this database is already running, wait for it instead of opening a second session
    const inflight = refreshInflight.get(dbCode)

    //! await, so a db error inside the refresh lands in the catch below instead of throwing to the caller
    if (inflight) return await inflight

    const refresh = refreshSapSession(dbCode).finally(() => refreshInflight.delete(dbCode))

    refreshInflight.set(dbCode, refresh)

    return await refresh
  } catch (err: any) {
    logger.error(err, '[GET_SAP_SESSION_ERROR]:')
    return { ok: false, message: 'Could not read the SAP session.' }
  }
}

//* logs the stale session out and opens a new one
async function refreshSapSession(dbCode: string): Promise<GetSapSessionResult> {
  //* another caller may have refreshed while we were queued
  const recheck = await readSession(dbCode)

  if (recheck.stored && recheck.isValid) return { ok: true, session: toCookies(recheck.stored) }

  //* check it is a real active database before logging in
  const sapDatabase = await db.sapDatabase.findFirst({ where: { dbCode, isActive: true }, select: { dbCode: true } })

  if (!sapDatabase) {
    //* turned off while it still had a session, log it out instead of leaking its license
    if (recheck.stored?.b1Session) {
      await sapLogout(toCookies(recheck.stored))
      await db.sapSession.delete({ where: { dbCode } }).catch(() => null)
    }

    return { ok: false, message: `SAP database "${dbCode}" was not found or is inactive.` }
  }

  //* log the old session out first so its license slot is freed
  if (recheck.stored?.b1Session) await sapLogout(toCookies(recheck.stored))

  const login = await sapLogin(dbCode)

  if ('error' in login) return { ok: false, message: login.error }

  const { b1session, routeid } = login.session
  const expiresAt = new Date(Date.now() + (login.sessionTimeout ?? SESSION_TIMEOUT))

  try {
    await db.sapSession.upsert({
      where: { dbCode },
      create: { dbCode, b1Session: b1session, routeId: routeid ?? null, expiresAt },
      update: { b1Session: b1session, routeId: routeid ?? null, expiresAt }
    })

    logger.info({ dbCode, expiresAt }, 'New SAP session saved')
  } catch (err: any) {
    //! nothing can reach this login now, log it out instead of leaking its license
    logger.error(err, '[SAVE_SAP_SESSION_ERROR]:')
    await sapLogout(login.session)

    return { ok: false, message: 'Could not store the new SAP session.' }
  }

  return { ok: true, session: login.session }
}

//* marks the session expired so the next call logs in again
//? sap can end a session before its timeout (service layer restart, admin logout), the time check cannot see that
//! keeps the cookies on purpose, the refresh still needs them to log the old session out
export async function invalidateSapSession(dbCode: string, rejectedB1Session?: string) {
  try {
    const stored = await db.sapSession.findUnique({ where: { dbCode } })

    if (!stored) return

    //* someone already replaced the rejected session, leave the new one alone
    if (rejectedB1Session && stored.b1Session !== rejectedB1Session) return

    await db.sapSession.update({ where: { dbCode }, data: { expiresAt: new Date(0) } })
    logger.warn({ dbCode }, 'SAP session marked as expired, the next call logs in again')
  } catch (err: any) {
    logger.error(err, '[INVALIDATE_SAP_SESSION_ERROR]:')
  }
}
