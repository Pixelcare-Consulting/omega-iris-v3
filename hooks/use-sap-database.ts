'use client'

import { useCallback, useState } from 'react'
import { useAction } from 'next-safe-action/hooks'

import { selectSapDatabaseClient, verifySapDatabaseConnectionClient } from '@/actions/sap-database'
import { DEFAULT_SIGNIN_REDIRECT } from '@/constants/routes'
import { logger } from '@/lib/logger'
import { delay } from '@/lib/utils'

//* the steps a switch runs through, null when idle, 'done' is every step checked just before the page swaps
export type SapDatabaseSwitchStage = 'verifying' | 'updating' | 'preparing' | 'done' | null

//* floor per step, a cached switch would otherwise blink past before it can be read
const MIN_STAGE_MS = 700

//* how long the finished card stays up before the page swaps
const SETTLE_MS = 400

async function atLeast<T>(work: Promise<T>) {
  const [result] = await Promise.all([work, delay(MIN_STAGE_MS)])
  return result
}

//* only same-site paths, so a crafted callbackUrl cannot send the user off site
function toSafeRedirect(redirectTo?: string | null) {
  if (!redirectTo || !redirectTo.startsWith('/')) return DEFAULT_SIGNIN_REDIRECT

  try {
    //! browsers read unregonized origin then redirect to the same origin, so the redirectTo must be on the same origin
    const url = new URL(redirectTo, window.location.origin)
    if (url.origin !== window.location.origin) return DEFAULT_SIGNIN_REDIRECT

    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return DEFAULT_SIGNIN_REDIRECT
  }
}

export function useSapDatabase() {
  const [stage, setStage] = useState<SapDatabaseSwitchStage>(null)
  const [targetDbCode, setTargetDbCode] = useState<string | null>(null)
  const { executeAsync: verifyConnection } = useAction(verifySapDatabaseConnectionClient)
  const { executeAsync: selectDatabase } = useAction(selectSapDatabaseClient)

  //* check sap first, a database that cannot be reached must not become the session's database
  const switchDatabase = useCallback(
    async (dbCode: string, redirectTo?: string | null): Promise<{ isSwitched: boolean; message?: string }> => {
      try {
        setTargetDbCode(dbCode)
        setStage('verifying')

        const verified = await atLeast(verifyConnection({ dbCode }))
        const verifyResult = verified?.data

        if (!verifyResult || verifyResult.error) {
          setStage(null)
          return { isSwitched: false, message: verifyResult?.message ?? 'Could not connect to SAP with this database.' }
        }

        setStage('updating')

        const selected = await atLeast(selectDatabase({ dbCode }))
        const selectResult = selected?.data

        //* the session must now hold the picked database, anything else means it was not saved
        if (!selectResult || selectResult.error || selectResult.data?.dbCode !== dbCode) {
          setStage(null)
          return { isSwitched: false, message: selectResult?.message ?? 'That database is no longer available. Please choose another one.' }
        }

        //* the session is settled, this step is the redirect being queued
        setStage('preparing')
        await delay(MIN_STAGE_MS)

        setStage('done')
        await delay(SETTLE_MS)

        //* full page load, the current url may point to a record the new database does not have
        window.location.assign(toSafeRedirect(redirectTo))

        return { isSwitched: true }
      } catch (err: any) {
        logger.error(err, '[SWITCH_SAP_DATABASE_ERROR]:')
        setStage(null)
        return { isSwitched: false, message: 'Something went wrong! Please try again later.' }
      }
    },
    [verifyConnection, selectDatabase]
  )

  return { stage, targetDbCode, isSwitching: stage !== null, switchDatabase }
}
