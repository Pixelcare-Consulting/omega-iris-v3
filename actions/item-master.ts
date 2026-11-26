'use server'

import { action, authenticationMiddleware, tenantMiddleware } from '@/lib/safe-action'
import db from '@/lib/db'
import { ItemMaster, Prisma } from '@/prisma/generated/client'
import { DataTableParams, dataTableParamsSchema } from '@/schema/data-table'
import { buildColumnFiltersWhere, buildGlobalFilterWhere, buildOrderBy, getDataTableParams } from '@/lib/data-table'
import { PModels } from '@/types/prisma'
import { codeParamsSchema } from '@/schema/common'
import { logger } from '@/lib/logger'
import { getDisk } from '@/lib/storage'
import { ItemMasterForm, itemMasterFormSchema, itemMasterThumbnailSchema } from '@/schema/item-master'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { FILE_ATTACHMENT_MODULES } from '@/constants/file-attachment'
import { findSameText, isUniqueConstraintError, toDuplicateMessage, toFieldListMessage } from '@/lib/duplicate'
import { DuplicateFields } from '@/types/common'
import { sapFetch } from '@/lib/sap/service-layer'
import { SapItemGroup, SapManufacturer } from '@/types/sap'
import { diffActivity, logActivity } from '@/lib/activity-log'
import { ITEM_MASTER_ACTIVITY_CONFIG } from '@/lib/activity-configs/item-master'

export type ItemMasterRow = ItemMaster

export type ItemMasterLookups = { itemGroups: SapItemGroup[]; manufacturers: SapManufacturer[]; isError: boolean }

//* sap owns these once an item is synced
const SAP_OWNED_FIELDS = ['ItemCode', 'ItemName', 'FirmCode', 'ItmsGrpCod'] as const

export async function getItemMasterByCode(dbCode: string | null, itemCode?: string | null) {
  if (!dbCode || !itemCode) return null

  try {
    //* a soft-deleted item must be restored before it can be viewed or edited again
    return await db.itemMaster.findFirst({ where: { dbCode, ItemCode: itemCode, deletedAt: null } })
  } catch (err: any) {
    logger.error(err, '[GET_ITEM_MASTER_BY_CODE_ERROR]:')
    return null
  }
}

//* isError lets a caller tell a failed lookup from an empty one
export async function getItemMasterLookups(dbCode: string): Promise<ItemMasterLookups> {
  const [itemGroups, manufacturers] = await Promise.all([
    sapFetch(dbCode, 'itemGroups.list', { query: { $select: 'Number,GroupName', $orderby: 'GroupName' } }),
    sapFetch(dbCode, 'manufacturers.list', { query: { $select: 'Code,ManufacturerName', $orderby: 'ManufacturerName' } })
  ])

  //* sapFetch already logs a failed call
  return {
    itemGroups: itemGroups.ok ? itemGroups.data.value : [],
    manufacturers: manufacturers.ok ? manufacturers.data.value : [],
    isError: !itemGroups.ok || !manufacturers.ok
  }
}

export const getItemMasterLookupsClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .action(async ({ ctx }) => getItemMasterLookups(ctx.dbCode))

export async function getDataTableItemMastersSvr(dbCode: string, params: DataTableParams) {
  const { perPage, offset, globalFilter, sorting, columnFilters, isExport, isShowDeleted } = getDataTableParams(params)

  const modelName: keyof PModels = 'ItemMaster'

  //* initialize where input
  const where: Prisma.ItemMasterWhereInput = { dbCode, ...(isShowDeleted ? {} : { deletedAt: null }) }

  //* global filter
  if (globalFilter) {
    const filter = buildGlobalFilterWhere<typeof modelName>(globalFilter, {
      stringFields: ['ItemCode', 'ItemName', 'FirmName', 'ItmsGrpNam', 'notes'],
      booleanFields: [{ field: 'isActive' }]
    })

    Object.assign(where, filter)
  }

  //* column filters
  if (columnFilters.length > 0) {
    const currentFilters = where.AND as Prisma.ItemMasterWhereInput[]

    const filters = buildColumnFiltersWhere<typeof modelName>(columnFilters, {
      stringFields: ['syncStatus', { field: 'FirmName', nullable: true }, { field: 'ItmsGrpNam', nullable: true }],
      booleanFields: [{ field: 'isActive' }],
      dateFields: [{ field: 'createdAt' }, { field: 'updatedAt' }, { field: 'syncedAt', nullable: true }]
    })

    where.AND = [...(currentFilters ?? []), ...filters]
  }

  //* initialize order input
  const orderBy: Prisma.ItemMasterOrderByWithRelationInput[] = buildOrderBy<typeof modelName>(sorting)

  try {
    const [data, rowCount] = await db.$transaction([
      db.itemMaster.findMany({ where, ...(isExport ? {} : { skip: offset, take: perPage }), orderBy }),
      db.itemMaster.count({ where })
    ])

    return { data, rowCount }
  } catch (err: any) {
    logger.error(err, '[GET_DATA_TABLE_ITEM_MASTERS_ERROR]:')
    return { data: [], rowCount: 0 }
  }
}

export const getDataTableItemMastersSvrClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(dataTableParamsSchema)
  .action(async ({ ctx, parsedInput }) => {
    if (!ctx.ability?.can(PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.ITEM_MASTERS)) return { data: [], rowCount: 0 }
    return getDataTableItemMastersSvr(ctx.dbCode, parsedInput)
  })

//* names the picked codes from sap, null when sap is unreachable
async function resolveSapNames(dbCode: string, data: Pick<ItemMasterForm, 'FirmCode' | 'ItmsGrpCod'>) {
  const lookups = await getItemMasterLookups(dbCode)

  if (lookups.isError) return null

  const manufacturer = data.FirmCode !== null ? lookups.manufacturers.find((m) => m.Code === data.FirmCode) : null
  const itemGroup = data.ItmsGrpCod !== null ? lookups.itemGroups.find((g) => g.Number === data.ItmsGrpCod) : null

  const unavailable: DuplicateFields = []

  if (data.FirmCode !== null && !manufacturer) {
    unavailable.push({ field: 'FirmCode', name: 'Manufacturer', message: 'Manufacturer is not available!' })
  }

  if (data.ItmsGrpCod !== null && !itemGroup) {
    unavailable.push({ field: 'ItmsGrpCod', name: 'Group', message: 'Group is not available!' })
  }

  return { unavailable, FirmName: manufacturer?.ManufacturerName ?? null, ItmsGrpNam: itemGroup?.GroupName ?? null }
}

export const upsertItemMaster = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(itemMasterFormSchema)
  .action(async ({ ctx, parsedInput }) => {
    //! thumbnail is left out, setItemMasterThumbnail owns it
    const { id, thumbnail: _thumbnail, ...input } = parsedInput
    const { dbCode, userCode, ability } = ctx
    const actionTag = 'UPSERT_ITEM_MASTER'
    const isCreate = !id

    const requiredAction = isCreate ? PERMISSIONS_ALLOWED_ACTIONS.CREATE : PERMISSIONS_ALLOWED_ACTIONS.EDIT

    if (!ability?.can(requiredAction, PERMISSIONS_CODES.ITEM_MASTERS)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      const existing = isCreate ? null : await db.itemMaster.findFirst({ where: { id, dbCode, deletedAt: null } })

      if (!isCreate && !existing) return { status: 404, error: true, message: 'Item master not found!', action: actionTag }

      const isSynced = existing?.syncStatus === 'SYNCED'

      //* a synced item keeps its sap fields, whatever was sent
      const data = isSynced ? { ...input, ...Object.fromEntries(SAP_OWNED_FIELDS.map((field) => [field, existing[field]])) } : input

      //* deleted rows count too, the unique key includes them
      if (!isSynced) {
        const sameCodes = await db.itemMaster.findMany({
          where: { dbCode, ItemCode: { equals: data.ItemCode, mode: 'insensitive' }, ...(id && { NOT: { id } }) }
        })

        const existingCode = findSameText(sameCodes, (row) => row.ItemCode, data.ItemCode)

        if (existingCode) {
          const message = toDuplicateMessage('MFG P/N', existingCode.deletedAt)
          return { status: 401, error: true, message, action: actionTag, paths: [{ field: 'ItemCode', message }] }
        }
      }

      //* only a changed pick asks sap, keeping a code sap dropped is fine
      const isPickChanged = !existing || existing.FirmCode !== data.FirmCode || existing.ItmsGrpCod !== data.ItmsGrpCod
      const hasPicks = data.FirmCode !== null || data.ItmsGrpCod !== null
      let names = { FirmName: existing?.FirmName ?? null, ItmsGrpNam: existing?.ItmsGrpNam ?? null }

      //* blank pickers need no names, so sap is skipped
      if (!isSynced && isPickChanged && !hasPicks) names = { FirmName: null, ItmsGrpNam: null }

      if (!isSynced && isPickChanged && hasPicks) {
        const resolved = await resolveSapNames(dbCode, data)

        if (!resolved) return { status: 502, error: true, message: 'Could not load SAP manufacturers and groups', action: actionTag } // prettier-ignore

        if (resolved.unavailable.length > 0) {
          const paths = resolved.unavailable.map((u) => ({ field: u.field, message: u.message }))
          const message = toFieldListMessage(resolved.unavailable, 'is not available!', 'are not available!')
          return { status: 401, error: true, message, action: actionTag, paths }
        }

        names = { FirmName: resolved.FirmName, ItmsGrpNam: resolved.ItmsGrpNam }
      }

      //* update item, a failed one goes back to pending once edited
      if (existing) {
        const itemMaster = await db.$transaction(async (tx) => {
          const result = await tx.itemMaster.update({
            where: { id: existing.id },
            data: {
              ...data,
              ...names,
              ...(existing.syncStatus === 'FAILED' && { syncStatus: 'PENDING', syncError: null }),
              updatedBy: userCode
            }
          })

          await logActivity(tx, {
            actor: ctx.actor,
            module: 'ITEM_MASTERS',
            action: 'UPDATE',
            dbCode,
            entity: { id: result.id, code: result.ItemCode, label: result.ItemName },
            changes: diffActivity(ITEM_MASTER_ACTIVITY_CONFIG, existing, result)
          })

          return result
        })

        return { status: 200, error: false, message: 'Item master updated successfully!', action: actionTag, data: { itemMaster } }
      }

      //* create item
      const itemMaster = await db.$transaction(async (tx) => {
        const result = await tx.itemMaster.create({ data: { ...data, ...names, dbCode, createdBy: userCode, updatedBy: userCode } })

        await logActivity(tx, {
          actor: ctx.actor,
          module: 'ITEM_MASTERS',
          action: 'CREATE',
          dbCode,
          entity: { id: result.id, code: result.ItemCode, label: result.ItemName },
          changes: diffActivity(ITEM_MASTER_ACTIVITY_CONFIG, null, result)
        })

        return result
      })

      return { status: 200, error: false, message: 'Item master created successfully!', action: actionTag, data: { itemMaster } }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      //* a save that raced past the check above
      if (isUniqueConstraintError(err)) {
        return { status: 409, error: true, message: 'MFG P/N already exists!', action: actionTag }
      }

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })

export const setItemMasterThumbnail = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(itemMasterThumbnailSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { id, thumbnail } = parsedInput
    const { dbCode, userCode, ability } = ctx
    const actionTag = 'SET_ITEM_MASTER_THUMBNAIL'

    //* the thumbnail is part of creating or editing the item, either one is enough
    const canSetThumbnail =
      ability?.can(PERMISSIONS_ALLOWED_ACTIONS.CREATE, PERMISSIONS_CODES.ITEM_MASTERS) ||
      ability?.can(PERMISSIONS_ALLOWED_ACTIONS.EDIT, PERMISSIONS_CODES.ITEM_MASTERS)

    if (!canSetThumbnail) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      const itemMaster = await db.itemMaster.findFirst({ where: { id, dbCode, deletedAt: null } })

      if (!itemMaster) return { status: 404, error: true, message: 'Item master not found!', action: actionTag }

      if (itemMaster.thumbnail === thumbnail) {
        return { status: 200, error: false, message: 'Thumbnail saved!', action: actionTag, data: { itemMaster } }
      }

      //! only a file uploaded for this item can become its thumbnail
      if (thumbnail) {
        const fileAttachment = await db.fileAttachment.findFirst({
          where: { id: thumbnail, moduleName: FILE_ATTACHMENT_MODULES.ITEM_MASTERS, referenceId: id },
          select: { id: true }
        })

        if (!fileAttachment) return { status: 400, error: true, message: 'Thumbnail file not found!', action: actionTag }
      }

      const updated = await db.$transaction(async (tx) => {
        const result = await tx.itemMaster.update({ where: { id }, data: { thumbnail, updatedBy: userCode } })

        //* a file id means nothing to a reader, so only say what happened
        const change = !itemMaster.thumbnail ? 'Added' : thumbnail ? 'Changed' : 'Removed'

        await logActivity(tx, {
          actor: ctx.actor,
          module: 'ITEM_MASTERS',
          action: 'UPDATE',
          dbCode,
          entity: { id: result.id, code: result.ItemCode, label: result.ItemName },
          changes: { fields: [{ key: 'thumbnail', label: 'Thumbnail', from: null, to: change }] }
        })

        return result
      })

      //* the column moves first, a failed file delete only leaves a stray file
      if (itemMaster.thumbnail) await deleteThumbnailFile(itemMaster.thumbnail)

      return { status: 200, error: false, message: 'Thumbnail saved!', action: actionTag, data: { itemMaster: updated } }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })

//* drops the old thumbnail row and its file, errors are only logged
async function deleteThumbnailFile(fileAttachmentId: string) {
  try {
    const fileAttachment = await db.fileAttachment.findUnique({ where: { id: fileAttachmentId } })

    if (!fileAttachment) return

    await db.fileAttachment.delete({ where: { id: fileAttachment.id } })
    await getDisk(fileAttachment.disk).delete(fileAttachment.key)
  } catch (err: any) {
    logger.error(err, '[DELETE_ITEM_MASTER_THUMBNAIL_ERROR]:')
  }
}

export const deleteItemMaster = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(codeParamsSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { dbCode, userCode, ability } = ctx
    const actionTag = 'DELETE_ITEM_MASTER'

    if (!ability?.can(PERMISSIONS_ALLOWED_ACTIONS.DELETE, PERMISSIONS_CODES.ITEM_MASTERS)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      const itemMaster = await db.itemMaster.findFirst({ where: { dbCode, ItemCode: parsedInput.code, deletedAt: null } })

      if (!itemMaster) return { status: 404, error: true, message: 'Item master not found!', action: actionTag }

      if (itemMaster.syncStatus === 'SYNCED') {
        return { status: 409, error: true, message: "Synced item masters can't be deleted!", action: actionTag }
      }

      //* the thumbnail stays, a restore brings it back
      await db.$transaction(async (tx) => {
        await tx.itemMaster.update({ where: { id: itemMaster.id }, data: { deletedAt: new Date(), deletedBy: userCode } })

        await logActivity(tx, {
          actor: ctx.actor,
          module: 'ITEM_MASTERS',
          action: 'DELETE',
          dbCode,
          entity: { id: itemMaster.id, code: itemMaster.ItemCode, label: itemMaster.ItemName }
        })
      })

      return { status: 200, error: false, message: 'Item master deleted successfully!', action: actionTag }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })

export const restoreItemMaster = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(codeParamsSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { dbCode, userCode, ability } = ctx
    const actionTag = 'RESTORE_ITEM_MASTER'

    if (!ability?.can(PERMISSIONS_ALLOWED_ACTIONS.RESTORE, PERMISSIONS_CODES.ITEM_MASTERS)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      const itemMaster = await db.itemMaster.findFirst({ where: { dbCode, ItemCode: parsedInput.code } })

      if (!itemMaster) return { status: 404, error: true, message: 'Item master not found!', action: actionTag }

      await db.$transaction(async (tx) => {
        await tx.itemMaster.update({ where: { id: itemMaster.id }, data: { deletedAt: null, deletedBy: null, updatedBy: userCode } })

        await logActivity(tx, {
          actor: ctx.actor,
          module: 'ITEM_MASTERS',
          action: 'RESTORE',
          dbCode,
          entity: { id: itemMaster.id, code: itemMaster.ItemCode, label: itemMaster.ItemName }
        })
      })

      return { status: 200, error: false, message: 'Item master restored successfully!', action: actionTag }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })
