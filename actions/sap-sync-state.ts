'use server'

import { z } from 'zod'

import db from '@/lib/db'
import { logger } from '@/lib/logger'
import { action, authenticationMiddleware, tenantMiddleware } from '@/lib/safe-action'
import { SAP_SYNC_KEYS, SapSyncKey } from '@/constants/sap-sync'

//* one row per database and key, see SAP_SYNC_KEYS

export async function getSapSyncState(dbCode: string, key: SapSyncKey) {
  try {
    return await db.sapSyncState.findUnique({ where: { dbCode_key: { dbCode, key } } })
  } catch (err: any) {
    logger.error(err, '[GET_SAP_SYNC_STATE_ERROR]:')
    return null
  }
}

//* marks the row running, the start time becomes lastSyncAt once the run completes
export async function startSapSyncRun(dbCode: string, key: SapSyncKey, userCode: number) {
  const startedAt = new Date()

  const run = { lastRunStatus: 'RUNNING', lastRunStartedAt: startedAt, lastRunBy: userCode, lastRunError: null, lastRunFinishedAt: null, lastRunCount: null } as const // prettier-ignore

  const state = await db.sapSyncState.upsert({
    where: { dbCode_key: { dbCode, key } },
    create: { dbCode, key, ...run },
    update: run
  })

  return { startedAt, lastSyncAt: state.lastSyncAt }
}

//! only the run still on record, so a sent start time can't move lastSyncAt anywhere else
//* false when a newer run took over or the start time doesn't match
export async function completeSapSyncRun(dbCode: string, key: SapSyncKey, { startedAt, count }: { startedAt: Date; count: number }) {
  const { count: updated } = await db.sapSyncState.updateMany({
    where: { dbCode, key, lastRunStatus: 'RUNNING', lastRunStartedAt: startedAt },
    data: { lastSyncAt: startedAt, lastRunStatus: 'COMPLETED', lastRunFinishedAt: new Date(), lastRunCount: count }
  })

  return updated > 0
}

//! lastSyncAt stays put, so the next run repeats the window
export async function failSapSyncRun(dbCode: string, key: SapSyncKey, message: string) {
  await db.sapSyncState.update({
    where: { dbCode_key: { dbCode, key } },
    data: { lastRunStatus: 'FAILED', lastRunError: message, lastRunFinishedAt: new Date() }
  })
}

const sapSyncKeySchema = z.object({ key: z.enum(Object.values(SAP_SYNC_KEYS) as [SapSyncKey, ...SapSyncKey[]]) })

//* the state plus who ran it last, for the page header
export const getSapSyncStateClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(sapSyncKeySchema)
  .action(async ({ ctx, parsedInput }) => {
    const state = await getSapSyncState(ctx.dbCode, parsedInput.key)

    if (!state) return null

    const lastRunByUser = state.lastRunBy
      ? await db.user.findUnique({ where: { code: state.lastRunBy }, select: { name: true } }).catch(() => null)
      : null

    return { ...state, lastRunByName: lastRunByUser?.name ?? null }
  })
