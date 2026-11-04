'use server'

import { action, authenticationMiddleware, tenantMiddleware } from '@/lib/safe-action'
import db from '@/lib/db'
import { Prisma } from '@/prisma/generated/client'
import { DataTableParams, dataTableParamsSchema } from '@/schema/data-table'
import { buildColumnFiltersWhere, buildGlobalFilterWhere, buildOrderBy, getDataTableParams } from '@/lib/data-table'
import { PModels } from '@/types/prisma'
import { codeParamsSchema } from '@/schema/common'
import { logger } from '@/lib/logger'
import { getDisk } from '@/lib/storage'
import { itemMasterFormSchema, itemMasterThumbnailSchema } from '@/schema/item-master'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { FILE_ATTACHMENT_MODULES } from '@/constants/file-attachment'
import { findSameText, isUniqueConstraintError, toDuplicateMessage, toFieldListMessage } from '@/lib/duplicate'
import { DuplicateFields } from '@/types/common'

const REFERENCE_SELECT = { code: true, name: true, isActive: true, deletedAt: true } as const

const COMMON_ITEM_MASTER_INCLUDE = {
  manufacturer: { select: REFERENCE_SELECT },
  commodity: { select: REFERENCE_SELECT }
} satisfies Prisma.ItemMasterInclude

export type ItemMasterWithRelations = Prisma.ItemMasterGetPayload<{ include: typeof COMMON_ITEM_MASTER_INCLUDE }>

export async function getItemMasterByCode(dbCode: string | null, code?: string | null) {
  if (!dbCode || !code) return null

  try {
    //* a soft-deleted item must be restored before it can be viewed or edited again
    return await db.itemMaster.findFirst({ where: { dbCode, code, deletedAt: null }, include: COMMON_ITEM_MASTER_INCLUDE })
  } catch (err: any) {
    logger.error(err, '[GET_ITEM_MASTER_BY_CODE_ERROR]:')
    return null
  }
}

export async function getDataTableItemMastersSvr(dbCode: string, params: DataTableParams) {
  const { perPage, offset, globalFilter, sorting, columnFilters, isExport, isShowDeleted } = getDataTableParams(params)

  const modelName: keyof PModels = 'ItemMaster'

  //* initialize where input
  const where: Prisma.ItemMasterWhereInput = { dbCode, ...(isShowDeleted ? {} : { deletedAt: null }) }

  //* global filter
  if (globalFilter) {
    const filter = buildGlobalFilterWhere<typeof modelName>(globalFilter, {
      stringFields: ['code', 'description', 'notes', 'manufacturerCode', 'commodityCode'],
      booleanFields: [{ field: 'isActive' }],
      relationFields: [
        { relation: 'manufacturer', fields: ['name'], relationNullable: true },
        { relation: 'commodity', fields: ['name'], relationNullable: true }
      ]
    })

    Object.assign(where, filter)
  }

  //* column filters
  if (columnFilters.length > 0) {
    const currentFilters = where.AND as Prisma.ItemMasterWhereInput[]

    const filters = buildColumnFiltersWhere<typeof modelName>(columnFilters, {
      stringFields: [
        { field: 'manufacturerCode', nullable: true },
        { field: 'commodityCode', nullable: true }
      ],
      booleanFields: [{ field: 'isActive' }],
      dateFields: [{ field: 'createdAt' }, { field: 'updatedAt' }]
    })

    where.AND = [...(currentFilters ?? []), ...filters]
  }

  //* initialize order input
  const orderBy: Prisma.ItemMasterOrderByWithRelationInput[] = buildOrderBy<typeof modelName>(sorting)

  try {
    const [data, rowCount] = await db.$transaction([
      db.itemMaster.findMany({
        where,
        include: COMMON_ITEM_MASTER_INCLUDE,
        ...(isExport ? {} : { skip: offset, take: perPage }),
        orderBy
      }),
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
  .action(async ({ ctx, parsedInput }) => getDataTableItemMastersSvr(ctx.dbCode, parsedInput))

export const upsertItemMaster = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(itemMasterFormSchema)
  .action(async ({ ctx, parsedInput }) => {
    //! thumbnail is left out, setItemMasterThumbnail owns it
    const { id, thumbnail: _thumbnail, ...data } = parsedInput
    const { dbCode, userCode, ability } = ctx
    const actionTag = 'UPSERT_ITEM_MASTER'
    const isCreate = !id

    const requiredAction = isCreate ? PERMISSIONS_ALLOWED_ACTIONS.CREATE : PERMISSIONS_ALLOWED_ACTIONS.EDIT

    if (!ability?.can(requiredAction, PERMISSIONS_CODES.ITEM_MASTERS)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      //* deleted rows count too, the unique key includes them
      const sameCodes = await db.itemMaster.findMany({
        where: { dbCode, code: { equals: data.code, mode: 'insensitive' }, ...(id && { NOT: { id } }) }
      })

      const existingCode = findSameText(sameCodes, (row) => row.code, data.code)

      const duplicates: DuplicateFields = []

      if (existingCode) {
        duplicates.push({ field: 'code', name: 'MFG P/N', message: toDuplicateMessage('MFG P/N', existingCode.deletedAt) })
      }

      if (duplicates.length > 0) {
        const paths = duplicates.map((d) => ({ field: d.field, message: d.message }))
        const message = toFieldListMessage(duplicates, 'already exists!', 'already exist!')
        return { status: 401, error: true, message, action: actionTag, paths }
      }

      const existing = isCreate ? null : await db.itemMaster.findFirst({ where: { id, dbCode, deletedAt: null } })

      if (!isCreate && !existing) return { status: 404, error: true, message: 'Item not found!', action: actionTag }

      //* only a changed pick is checked, keeping an inactive one is fine
      const [manufacturer, commodity] = await Promise.all([
        data.manufacturerCode && data.manufacturerCode !== existing?.manufacturerCode
          ? db.manufacturer.findFirst({
              where: { dbCode, code: data.manufacturerCode, deletedAt: null, isActive: true },
              select: { id: true }
            })
          : true,
        data.commodityCode && data.commodityCode !== existing?.commodityCode
          ? db.commodity.findFirst({ where: { dbCode, code: data.commodityCode, deletedAt: null, isActive: true }, select: { id: true } })
          : true
      ])

      const unavailable: DuplicateFields = []

      if (!manufacturer) unavailable.push({ field: 'manufacturerCode', name: 'Manufacturer', message: 'Manufacturer is not available!' })
      if (!commodity) unavailable.push({ field: 'commodityCode', name: 'Commodity', message: 'Commodity is not available!' })

      if (unavailable.length > 0) {
        const paths = unavailable.map((u) => ({ field: u.field, message: u.message }))
        const message = toFieldListMessage(unavailable, 'is not available!', 'are not available!')
        return { status: 401, error: true, message, action: actionTag, paths }
      }

      //* update item
      if (existing) {
        const itemMaster = await db.itemMaster.update({ where: { id: existing.id }, data: { ...data, updatedBy: userCode } })

        return { status: 200, error: false, message: 'Item updated successfully!', action: actionTag, data: { itemMaster } }
      }

      //* create item
      const itemMaster = await db.itemMaster.create({ data: { ...data, dbCode, createdBy: userCode, updatedBy: userCode } })

      return { status: 200, error: false, message: 'Item created successfully!', action: actionTag, data: { itemMaster } }
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

      if (!itemMaster) return { status: 404, error: true, message: 'Item not found!', action: actionTag }

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

      const updated = await db.itemMaster.update({ where: { id }, data: { thumbnail, updatedBy: userCode } })

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
      const itemMaster = await db.itemMaster.findFirst({ where: { dbCode, code: parsedInput.code, deletedAt: null } })

      if (!itemMaster) return { status: 404, error: true, message: 'Item not found!', action: actionTag }

      //* the thumbnail stays, a restore brings it back
      await db.itemMaster.update({ where: { id: itemMaster.id }, data: { deletedAt: new Date(), deletedBy: userCode } })

      return { status: 200, error: false, message: 'Item deleted successfully!', action: actionTag }
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
      const itemMaster = await db.itemMaster.findFirst({ where: { dbCode, code: parsedInput.code } })

      if (!itemMaster) return { status: 404, error: true, message: 'Item not found!', action: actionTag }

      await db.itemMaster.update({ where: { id: itemMaster.id }, data: { deletedAt: null, deletedBy: null, updatedBy: userCode } })

      return { status: 200, error: false, message: 'Item restored successfully!', action: actionTag }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })
