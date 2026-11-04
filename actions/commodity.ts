'use server'

import { action, authenticationMiddleware, tenantMiddleware } from '@/lib/safe-action'

import db from '@/lib/db'
import { Prisma } from '@/prisma/generated/client'
import { DataTableParams, dataTableParamsSchema } from '@/schema/data-table'
import { buildColumnFiltersWhere, buildGlobalFilterWhere, buildOrderBy, getDataTableParams } from '@/lib/data-table'
import { PModels } from '@/types/prisma'
import { codeParamsSchema } from '@/schema/common'
import { logger } from '@/lib/logger'
import { commodityFormSchema } from '@/schema/commodity'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { isUniqueConstraintError, toDuplicateMessage } from '@/lib/duplicate'
import { DuplicateFields } from '@/types/common'
import { capitalize } from 'radash'

export async function getCommodities(dbCode: string | null) {
  if (!dbCode) return []

  try {
    return await db.commodity.findMany({ where: { dbCode, deletedAt: null, isActive: true }, orderBy: { code: 'asc' } })
  } catch (err: any) {
    logger.error(err, '[GET_COMMODITIES_ERROR]:')
    return []
  }
}

export async function getCommodityByCode(dbCode: string | null, code?: string | null) {
  if (!dbCode || !code) return null

  try {
    //* a soft-deleted commodity must be restored before it can be viewed or edited again
    return await db.commodity.findFirst({ where: { dbCode, code, deletedAt: null } })
  } catch (err: any) {
    logger.error(err, '[GET_COMMODITY_BY_CODE_ERROR]:')
    return null
  }
}

export const getCommoditiesClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .action(async ({ ctx }) => getCommodities(ctx.dbCode))

export async function getDataTableCommoditiesSvr(dbCode: string, params: DataTableParams) {
  const { perPage, offset, globalFilter, sorting, columnFilters, isExport, isShowDeleted } = getDataTableParams(params)

  const modelName: keyof PModels = 'Commodity'

  //* initialize where input
  const where: Prisma.CommodityWhereInput = { dbCode, ...(isShowDeleted ? {} : { deletedAt: null }) }

  //* global filter
  if (globalFilter) {
    const filter = buildGlobalFilterWhere<typeof modelName>(globalFilter, {
      stringFields: ['code', 'name'],
      booleanFields: [{ field: 'isActive' }]
    })

    Object.assign(where, filter)
  }

  //* column filters
  if (columnFilters.length > 0) {
    const currentFilters = where.AND as Prisma.CommodityWhereInput[]

    const filters = buildColumnFiltersWhere<typeof modelName>(columnFilters, {
      booleanFields: [{ field: 'isActive' }],
      dateFields: [{ field: 'createdAt' }, { field: 'updatedAt' }]
    })

    where.AND = [...(currentFilters ?? []), ...filters]
  }

  //* initialize order input
  const orderBy: Prisma.CommodityOrderByWithRelationInput[] = buildOrderBy<typeof modelName>(sorting)

  try {
    const [data, rowCount] = await db.$transaction([
      db.commodity.findMany({ where, ...(isExport ? {} : { skip: offset, take: perPage }), orderBy }),
      db.commodity.count({ where })
    ])

    return { data, rowCount }
  } catch (err: any) {
    logger.error(err, '[GET_DATA_TABLE_COMMODITIES_ERROR]:')
    return { data: [], rowCount: 0 }
  }
}

export const getDataTableCommoditiesSvrClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(dataTableParamsSchema)
  .action(async ({ ctx, parsedInput }) => getDataTableCommoditiesSvr(ctx.dbCode, parsedInput))

export const upsertCommodity = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(commodityFormSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { id, code, ...data } = parsedInput
    const { dbCode, userCode, ability } = ctx
    const actionTag = 'UPSERT_COMMODITY'
    const isCreate = !id

    const requiredAction = isCreate ? PERMISSIONS_ALLOWED_ACTIONS.CREATE : PERMISSIONS_ALLOWED_ACTIONS.EDIT

    if (!ability?.can(requiredAction, PERMISSIONS_CODES.COMMODITIES)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      //* deleted rows count too, the unique keys include them
      const [existingCode, existingName] = await Promise.all([
        //* code is locked after create, so an edit skips it
        isCreate ? db.commodity.findFirst({ where: { dbCode, code: { equals: code, mode: 'insensitive' } } }) : null,
        db.commodity.findFirst({
          where: { dbCode, name: { equals: data.name, mode: 'insensitive' }, ...(id && { NOT: { id } }) }
        })
      ])

      const duplicates: DuplicateFields = []

      if (existingCode) duplicates.push({ field: 'code', name: 'Code', message: toDuplicateMessage('Code', existingCode.deletedAt) })
      if (existingName) duplicates.push({ field: 'name', name: 'Name', message: toDuplicateMessage('Name', existingName.deletedAt) })

      if (duplicates.length > 0) {
        const paths = duplicates.map((d) => ({ field: d.field, message: d.message }))
        const message = duplicates.map((d) => d.name).join(', ')
        return { status: 401, error: true, message: `${capitalize(message)} already exists!`, action: actionTag, paths }
      }

      //* update commodity
      if (!isCreate) {
        const existing = await db.commodity.findFirst({ where: { id, dbCode, deletedAt: null } })

        if (!existing) return { status: 404, error: true, message: 'Commodity not found!', action: actionTag }

        //! the table hides these for system rows, this is the check behind it
        if (existing.isSystem) {
          return { status: 403, error: true, message: 'System generated commodity cannot be edited!', action: actionTag }
        }

        //! code is never written here, even if the client sent one
        const commodity = await db.commodity.update({ where: { id }, data: { ...data, updatedBy: userCode } })

        return {
          status: 200,
          error: false,
          message: 'Commodity updated successfully!',
          action: actionTag,
          data: { commodity }
        }
      }

      //* create commodity
      const commodity = await db.commodity.create({
        data: { ...data, code, dbCode, createdBy: userCode, updatedBy: userCode }
      })

      return { status: 200, error: false, message: 'Commodity created successfully!', action: actionTag, data: { commodity } }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      //* a save that raced past the check above
      if (isUniqueConstraintError(err)) {
        return { status: 409, error: true, message: 'Code or name already exists!', action: actionTag }
      }

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })

export const deleteCommodity = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(codeParamsSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { dbCode, userCode, ability } = ctx
    const actionTag = 'DELETE_COMMODITY'

    if (!ability?.can(PERMISSIONS_ALLOWED_ACTIONS.DELETE, PERMISSIONS_CODES.COMMODITIES)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      const commodity = await db.commodity.findFirst({ where: { dbCode, code: parsedInput.code, deletedAt: null } })

      if (!commodity) return { status: 404, error: true, message: 'Commodity not found!', action: actionTag }

      //! the table hides these for system rows, this is the check behind it
      if (commodity.isSystem) {
        return { status: 403, error: true, message: 'System generated commodity cannot be deleted!', action: actionTag }
      }

      await db.commodity.update({ where: { id: commodity.id }, data: { deletedAt: new Date(), deletedBy: userCode } })

      return { status: 200, error: false, message: 'Commodity deleted successfully!', action: actionTag }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })

export const restoreCommodity = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(codeParamsSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { dbCode, userCode, ability } = ctx
    const actionTag = 'RESTORE_COMMODITY'

    if (!ability?.can(PERMISSIONS_ALLOWED_ACTIONS.RESTORE, PERMISSIONS_CODES.COMMODITIES)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      const commodity = await db.commodity.findFirst({ where: { dbCode, code: parsedInput.code } })

      if (!commodity) return { status: 404, error: true, message: 'Commodity not found!', action: actionTag }

      await db.commodity.update({
        where: { id: commodity.id },
        data: { deletedAt: null, deletedBy: null, updatedBy: userCode }
      })

      return { status: 200, error: false, message: 'Commodity restored successfully!', action: actionTag }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })
