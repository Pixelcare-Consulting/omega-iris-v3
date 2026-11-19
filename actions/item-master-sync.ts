'use server'

import db from '@/lib/db'
import { logger } from '@/lib/logger'
import { action, authenticationMiddleware, tenantMiddleware } from '@/lib/safe-action'
import { sapFetch } from '@/lib/sap/service-layer'
import { toChangedSinceFilter, toSyncSinceDate } from '@/lib/sap/sync'
import { chunkArray } from '@/lib/utils'
import { escapeLikeKeyword } from '@/lib/data-table'
import { Prisma } from '@/prisma/generated/client'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { SAP_SYNC_FROM_PAGE_SIZE, SAP_SYNC_KEYS } from '@/constants/sap-sync'
import { completeSapSyncRun, failSapSyncRun, startSapSyncRun } from '@/actions/sap-sync-state'
import {
  ITEM_CODE_MAX_LENGTH,
  itemMasterSyncFailSchema,
  itemMasterSyncFinishSchema,
  itemMasterSyncFromSapPageSchema,
  itemMasterSyncToSapSchema
} from '@/schema/item-master'
import { BatchError, BatchErrorEntry, BatchStepResult } from '@/types/batch'
import { createId } from '@paralleldrive/cuid2'
import { diffActivity, hasActivityChanges, LogActivityInput, logActivity, toActivityRows, toActivitySummary } from '@/lib/activity-log'
import { ITEM_MASTER_ACTIVITY_CONFIG } from '@/lib/activity-configs/item-master'
import type { ItemMaster } from '@/prisma/generated/client'
import { SapItem } from '@/types/sap'

const SYNC_KEY = SAP_SYNC_KEYS.ITEM_MASTER_FROM_SAP
const PULL_FIELDS = 'ItemCode,ItemName,ItemsGroupCode,Manufacturer'
const LOOKUP_CHUNK_SIZE = 500 //* codes per existing row lookup

const FORBIDDEN = { status: 403, error: true, message: 'You are not allowed to do this!' } as const

//* only portal flagged items, and only changed ones after the first sync
function toPullFilter(since: string | null) {
  const changed = toChangedSinceFilter(since)
  return changed ? `U_Portal_Sync eq 'Y' and ${changed}` : `U_Portal_Sync eq 'Y'`
}

export const startItemMasterSyncFromSap = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .action(async ({ ctx }) => {
    const { dbCode, userCode, ability } = ctx
    const actionTag = 'START_ITEM_MASTER_SYNC_FROM_SAP'

    if (!ability?.can(PERMISSIONS_ALLOWED_ACTIONS.SYNC_FROM_SAP, PERMISSIONS_CODES.ITEM_MASTERS)) return { ...FORBIDDEN, action: actionTag }

    try {
      const { startedAt, lastSyncAt } = await startSapSyncRun(dbCode, SYNC_KEY, userCode)
      const since = toSyncSinceDate(lastSyncAt)

      const count = await sapFetch(dbCode, 'items.count', { query: { $filter: toPullFilter(since) } })

      if (!count.ok) {
        await failSapSyncRun(dbCode, SYNC_KEY, count.message)
        return { status: count.status || 502, error: true, message: count.message, action: actionTag }
      }

      const data = { since, startedAt: startedAt.toISOString(), total: Number(count.data) || 0 }

      return { status: 200, error: false, message: 'Sync started', action: actionTag, data }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)
      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })

//* one page of sap items into the portal, matched on item code without case
export const syncItemMastersFromSapPage = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(itemMasterSyncFromSapPageSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { dbCode, userCode, ability } = ctx
    const { startedAt, since, skip, metaData } = parsedInput
    const actionTag = 'SYNC_ITEM_MASTERS_FROM_SAP_PAGE'

    if (!ability?.can(PERMISSIONS_ALLOWED_ACTIONS.SYNC_FROM_SAP, PERMISSIONS_CODES.ITEM_MASTERS)) return { ...FORBIDDEN, action: actionTag }

    //! blank names would overwrite good ones, so empty lookups fail the page
    if (metaData.itemGroups.length === 0 || metaData.manufacturers.length === 0) {
      return { status: 400, error: true, message: 'SAP manufacturers and groups are not loaded', action: actionTag }
    }

    try {
      const page = await sapFetch(dbCode, 'items.list', {
        query: { $select: PULL_FIELDS, $filter: toPullFilter(since), $orderby: 'ItemCode', $top: SAP_SYNC_FROM_PAGE_SIZE, $skip: skip }
      })

      if (!page.ok) throw new Error(page.message)

      const groupNames = new Map(metaData.itemGroups.map((g) => [g.Number, g.GroupName]))
      const manufacturerNames = new Map(metaData.manufacturers.map((m) => [m.Code, m.ManufacturerName]))

      const errors: BatchError[] = []
      const rows: SapItem[] = []

      page.data.value.forEach((item, index) => {
        if (item.ItemCode?.trim()) return rows.push(item)

        errors.push({ key: `skip-${skip + index}`, label: '(no code)', entries: [{ field: 'MFG P/N', message: 'Missing required field' }] })
      })

      //* existing rows by lowercased code, deleted ones too
      const existingRows = (
        await Promise.all(
          chunkArray(rows, LOOKUP_CHUNK_SIZE).map((chunk) =>
            db.itemMaster.findMany({
              //! insensitive equals runs as ILIKE, a code ending in \ would throw unless escaped
              //* whole rows, they are the before side of the activity diff
              where: { dbCode, OR: chunk.map((item) => ({ ItemCode: { equals: escapeLikeKeyword(item.ItemCode), mode: 'insensitive' as const } })) } // prettier-ignore
            })
          )
        )
      ).flat()

      const existingByCode = new Map(existingRows.map((row) => [row.ItemCode.toLowerCase(), row]))

      const now = new Date()
      //* all three run together in one transaction at the end of the page
      const updates: Prisma.PrismaPromise<unknown>[] = [] //* updates to items already in the portal
      const creates: Prisma.ItemMasterCreateManyInput[] = [] //* new items, saved with one createMany
      const activities: LogActivityInput[] = [] //* one activity row per item that is new or changed
      const seen = new Set<string>()

      //* one batch per run, the finish summary row carries the same id
      const activityBase = { actor: ctx.actor, module: 'ITEM_MASTERS' as const, dbCode, batchId: `${SYNC_KEY}:${startedAt}` }

      for (const item of rows) {
        const lowered = item.ItemCode.toLowerCase()

        //* sap keeps codes unique without case, a repeat in one page is skipped
        if (seen.has(lowered)) continue
        seen.add(lowered)

        const sapFields = {
          ItemCode: item.ItemCode,
          ItemName: item.ItemName || null,
          FirmCode: item.Manufacturer ?? null,
          FirmName:
            item.Manufacturer !== null && item.Manufacturer !== undefined ? (manufacturerNames.get(item.Manufacturer) ?? null) : null,
          ItmsGrpCod: item.ItemsGroupCode ?? null,
          ItmsGrpNam:
            item.ItemsGroupCode !== null && item.ItemsGroupCode !== undefined ? (groupNames.get(item.ItemsGroupCode) ?? null) : null,
          syncStatus: 'SYNCED' as const,
          syncedAt: now,
          syncError: null
        }

        const existing = existingByCode.get(lowered)

        //* portal only fields and deletedAt are never touched
        if (existing) {
          updates.push(db.itemMaster.update({ where: { id: existing.id }, data: { ...sapFields, updatedBy: userCode } }))

          //* an unchanged item writes no activity, most rows in the lookback window are
          const changes = diffActivity(ITEM_MASTER_ACTIVITY_CONFIG, existing, { ...existing, ...sapFields })

          if (hasActivityChanges(changes)) {
            activities.push({
              ...activityBase,
              action: 'UPDATE',
              entity: { id: existing.id, code: sapFields.ItemCode, label: sapFields.ItemName },
              changes,
              summary: `${toActivitySummary('UPDATE', changes)} from SAP`
            })
          }
        } else {
          //* the id is made here so its activity row can point at it
          const created = { ...sapFields, id: createId(), dbCode, createdBy: userCode, updatedBy: userCode }
          creates.push(created)

          activities.push({
            ...activityBase,
            action: 'CREATE',
            entity: { id: created.id, code: created.ItemCode, label: created.ItemName },
            changes: diffActivity(ITEM_MASTER_ACTIVITY_CONFIG, null, created as ItemMaster),
            summary: 'Created from SAP'
          })
        }
      }

      //* the activity rows ride in the same transaction, one insert for the page
      await db.$transaction([
        ...updates,
        db.itemMaster.createMany({ data: creates, skipDuplicates: true }),
        db.activityLog.createMany({ data: toActivityRows(activities) })
      ])

      const result: BatchStepResult & { fetched: number } = {
        succeeded: updates.length + creates.length,
        errors,
        fetched: page.data.value.length
      }

      return { status: 200, error: false, message: 'Page synced', action: actionTag, data: result }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)
      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })

export const finishItemMasterSyncFromSap = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(itemMasterSyncFinishSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { dbCode, ability } = ctx
    const actionTag = 'FINISH_ITEM_MASTER_SYNC_FROM_SAP'

    if (!ability?.can(PERMISSIONS_ALLOWED_ACTIONS.SYNC_FROM_SAP, PERMISSIONS_CODES.ITEM_MASTERS)) return { ...FORBIDDEN, action: actionTag }

    try {
      const isCompleted = await completeSapSyncRun(dbCode, SYNC_KEY, {
        startedAt: new Date(parsedInput.startedAt),
        count: parsedInput.count
      })

      if (!isCompleted) return { status: 409, error: true, message: 'A newer sync replaced this one, its result was not saved', action: actionTag } // prettier-ignore

      //* the run's summary, its batch id matches the page rows so View records lists what changed
      await logActivity(db, {
        actor: ctx.actor,
        module: 'ITEM_MASTERS',
        action: 'SYNC_FROM_SAP',
        dbCode,
        batchId: `${SYNC_KEY}:${parsedInput.startedAt}`,
        summary: `Pulled ${parsedInput.count} ${parsedInput.count === 1 ? 'item' : 'items'} from SAP`,
        changes: { fields: [], meta: { count: parsedInput.count } }
      })

      return { status: 200, error: false, message: 'Sync completed', action: actionTag }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)
      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })

export const failItemMasterSyncFromSap = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(itemMasterSyncFailSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { dbCode, ability } = ctx
    const actionTag = 'FAIL_ITEM_MASTER_SYNC_FROM_SAP'

    if (!ability?.can(PERMISSIONS_ALLOWED_ACTIONS.SYNC_FROM_SAP, PERMISSIONS_CODES.ITEM_MASTERS)) return { ...FORBIDDEN, action: actionTag }

    try {
      await failSapSyncRun(dbCode, SYNC_KEY, parsedInput.message)
      return { status: 200, error: false, message: 'Sync failure saved', action: actionTag }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)
      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })

//* pushes pending or failed items to sap, the server reloads each row by id
export const syncItemMastersToSap = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(itemMasterSyncToSapSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { dbCode, userCode, ability } = ctx
    const actionTag = 'SYNC_ITEM_MASTERS_TO_SAP'

    if (!ability?.can(PERMISSIONS_ALLOWED_ACTIONS.SYNC_TO_SAP, PERMISSIONS_CODES.ITEM_MASTERS)) return { ...FORBIDDEN, action: actionTag }

    try {
      const rows = await db.itemMaster.findMany({
        where: { id: { in: parsedInput.ids }, dbCode, deletedAt: null, syncStatus: { in: ['PENDING', 'FAILED'] } }
      })

      const errors: BatchError[] = []
      let succeeded = 0

      //* an id that didn't load was synced or deleted since the list loaded
      const loadedIds = new Set(rows.map((row) => row.id))

      parsedInput.ids
        .filter((id) => !loadedIds.has(id))
        .forEach((id) =>
          errors.push({ key: id, label: id, entries: [{ field: 'Item', message: 'Item master is already synced or was deleted' }] })
        )

      //* one at a time, sapFetch queues per database anyway
      for (const row of rows) {
        const entries: BatchErrorEntry[] = []

        //* check required fields, names match the form labels
        if (!row.ItemCode) entries.push({ field: 'MFG P/N', message: 'Missing required field' })
        else if (row.ItemCode.length > ITEM_CODE_MAX_LENGTH) entries.push({ field: 'MFG P/N', message: `Must be at most ${ITEM_CODE_MAX_LENGTH} characters` }) // prettier-ignore

        if (!row.ItemName) entries.push({ field: 'Description', message: 'Missing required field' })

        if (entries.length > 0) {
          errors.push({ key: row.id, label: row.ItemCode, entries })
          continue
        }

        //* a blank manufacturer or group is left out, sap uses its defaults
        const result = await sapFetch(dbCode, 'items.create', {
          body: {
            ItemCode: row.ItemCode,
            ItemName: row.ItemName!,
            ...(row.FirmCode !== null && { Manufacturer: row.FirmCode }),
            ...(row.ItmsGrpCod !== null && { ItemsGroupCode: row.ItmsGrpCod }),
            U_Portal_Sync: 'Y'
          }
        })

        if (result.ok) {
          //! only the row as sent, a rename during the call would link the wrong code
          const linked = await db.$transaction(async (tx) => {
            const result = await tx.itemMaster.updateMany({
              where: { id: row.id, ItemCode: row.ItemCode, syncStatus: { not: 'SYNCED' } },
              data: { syncStatus: 'SYNCED', syncedAt: new Date(), syncError: null, updatedBy: userCode }
            })

            if (result.count > 0) {
              await logActivity(tx, {
                actor: ctx.actor,
                module: 'ITEM_MASTERS',
                action: 'SYNC_TO_SAP',
                dbCode,
                entity: { id: row.id, code: row.ItemCode, label: row.ItemName }
              })
            }

            return result
          })

          if (linked.count > 0) succeeded++
          else errors.push({ key: row.id, label: row.ItemCode, entries: [{ field: 'Item', message: `Created in SAP as ${row.ItemCode}, but the item master changed meanwhile. Run Sync from SAP to link it.` }] }) // prettier-ignore

          continue
        }

        //* failed item
        //! never turn a synced row back to failed, another push may have won the race
        await db.itemMaster.updateMany({
          where: { id: row.id, syncStatus: { not: 'SYNCED' } },
          data: { syncStatus: 'FAILED', syncError: result.message, updatedBy: userCode }
        })

        const message = /already exist/i.test(result.message) ? `${result.message.replace(/\.$/, '')}. Run Sync from SAP to link it.` : result.message // prettier-ignore
        errors.push({ key: row.id, label: row.ItemCode, entries: [{ field: 'SAP Error', message }] })
      }

      const data: BatchStepResult = { succeeded, errors }

      return { status: 200, error: false, message: `${succeeded} of ${parsedInput.ids.length} synced to SAP`, action: actionTag, data }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)
      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })
