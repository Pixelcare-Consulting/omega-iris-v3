'use server'

import { action, authenticationMiddleware, tenantMiddleware } from '@/lib/safe-action'

import db from '@/lib/db'
import { Prisma } from '@/prisma/generated/client'
import { DataTableParams, dataTableParamsSchema } from '@/schema/data-table'
import { buildColumnFiltersWhere, buildGlobalFilterWhere, buildOrderBy, getDataTableParams } from '@/lib/data-table'
import { PModels } from '@/types/prisma'
import { codeParamsSchema } from '@/schema/common'
import { logger } from '@/lib/logger'
import { manufacturerFormSchema } from '@/schema/manufacturer'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { isUniqueConstraintError, toDuplicateMessage } from '@/lib/duplicate'
import { DuplicateFields } from '@/types/common'
import { capitalize } from 'radash'

export async function getManufacturers(dbCode: string | null) {
  if (!dbCode) return []

  try {
    return await db.manufacturer.findMany({ where: { dbCode, deletedAt: null, isActive: true }, orderBy: { code: 'asc' } })
  } catch (err: any) {
    logger.error(err, '[GET_MANUFACTURERS_ERROR]:')
    return []
  }
}

export async function getManufacturerByCode(dbCode: string | null, code?: string | null) {
  if (!dbCode || !code) return null

  try {
    //* a soft-deleted manufacturer must be restored before it can be viewed or edited again
    return await db.manufacturer.findFirst({ where: { dbCode, code, deletedAt: null } })
  } catch (err: any) {
    logger.error(err, '[GET_MANUFACTURER_BY_CODE_ERROR]:')
    return null
  }
}

export const getManufacturersClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .action(async ({ ctx }) => getManufacturers(ctx.dbCode))

export async function getDataTableManufacturersSvr(dbCode: string, params: DataTableParams) {
  const { perPage, offset, globalFilter, sorting, columnFilters, isExport, isShowDeleted } = getDataTableParams(params)

  const modelName: keyof PModels = 'Manufacturer'

  //* initialize where input
  const where: Prisma.ManufacturerWhereInput = { dbCode, ...(isShowDeleted ? {} : { deletedAt: null }) }

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
    const currentFilters = where.AND as Prisma.ManufacturerWhereInput[]

    const filters = buildColumnFiltersWhere<typeof modelName>(columnFilters, {
      booleanFields: [{ field: 'isActive' }],
      dateFields: [{ field: 'createdAt' }, { field: 'updatedAt' }]
    })

    where.AND = [...(currentFilters ?? []), ...filters]
  }

  //* initialize order input
  const orderBy: Prisma.ManufacturerOrderByWithRelationInput[] = buildOrderBy<typeof modelName>(sorting)

  try {
    const [data, rowCount] = await db.$transaction([
      db.manufacturer.findMany({ where, ...(isExport ? {} : { skip: offset, take: perPage }), orderBy }),
      db.manufacturer.count({ where })
    ])

    return { data, rowCount }
  } catch (err: any) {
    logger.error(err, '[GET_DATA_TABLE_MANUFACTURERS_ERROR]:')
    return { data: [], rowCount: 0 }
  }
}

export const getDataTableManufacturersSvrClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(dataTableParamsSchema)
  .action(async ({ ctx, parsedInput }) => getDataTableManufacturersSvr(ctx.dbCode, parsedInput))

export const upsertManufacturer = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(manufacturerFormSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { id, code, ...data } = parsedInput
    const { dbCode, userCode, ability } = ctx
    const actionTag = 'UPSERT_MANUFACTURER'
    const isCreate = !id

    const requiredAction = isCreate ? PERMISSIONS_ALLOWED_ACTIONS.CREATE : PERMISSIONS_ALLOWED_ACTIONS.EDIT

    if (!ability?.can(requiredAction, PERMISSIONS_CODES.MANUFACTURERS)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      //* deleted rows count too, the unique keys include them
      const [existingCode, existingName] = await Promise.all([
        //* code is locked after create, so an edit skips it
        isCreate ? db.manufacturer.findFirst({ where: { dbCode, code: { equals: code, mode: 'insensitive' } } }) : null,
        db.manufacturer.findFirst({
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

      //* update manufacturer
      if (!isCreate) {
        const existing = await db.manufacturer.findFirst({ where: { id, dbCode, deletedAt: null } })

        if (!existing) return { status: 404, error: true, message: 'Manufacturer not found!', action: actionTag }

        //! the table hides these for system rows, this is the check behind it
        if (existing.isSystem) {
          return { status: 403, error: true, message: 'System generated manufacturer cannot be edited!', action: actionTag }
        }

        //! code is never written here, even if the client sent one
        const manufacturer = await db.manufacturer.update({ where: { id }, data: { ...data, updatedBy: userCode } })

        return {
          status: 200,
          error: false,
          message: 'Manufacturer updated successfully!',
          action: actionTag,
          data: { manufacturer }
        }
      }

      //* create manufacturer
      const manufacturer = await db.manufacturer.create({
        data: { ...data, code, dbCode, createdBy: userCode, updatedBy: userCode }
      })

      return { status: 200, error: false, message: 'Manufacturer created successfully!', action: actionTag, data: { manufacturer } }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      //* a save that raced past the check above
      if (isUniqueConstraintError(err)) {
        return { status: 409, error: true, message: 'Code or name already exists!', action: actionTag }
      }

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })

export const deleteManufacturer = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(codeParamsSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { dbCode, userCode, ability } = ctx
    const actionTag = 'DELETE_MANUFACTURER'

    if (!ability?.can(PERMISSIONS_ALLOWED_ACTIONS.DELETE, PERMISSIONS_CODES.MANUFACTURERS)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      const manufacturer = await db.manufacturer.findFirst({ where: { dbCode, code: parsedInput.code, deletedAt: null } })

      if (!manufacturer) return { status: 404, error: true, message: 'Manufacturer not found!', action: actionTag }

      //! the table hides these for system rows, this is the check behind it
      if (manufacturer.isSystem) {
        return { status: 403, error: true, message: 'System generated manufacturer cannot be deleted!', action: actionTag }
      }

      await db.manufacturer.update({ where: { id: manufacturer.id }, data: { deletedAt: new Date(), deletedBy: userCode } })

      return { status: 200, error: false, message: 'Manufacturer deleted successfully!', action: actionTag }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })

export const restoreManufacturer = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(codeParamsSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { dbCode, userCode, ability } = ctx
    const actionTag = 'RESTORE_MANUFACTURER'

    if (!ability?.can(PERMISSIONS_ALLOWED_ACTIONS.RESTORE, PERMISSIONS_CODES.MANUFACTURERS)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      const manufacturer = await db.manufacturer.findFirst({ where: { dbCode, code: parsedInput.code } })

      if (!manufacturer) return { status: 404, error: true, message: 'Manufacturer not found!', action: actionTag }

      await db.manufacturer.update({
        where: { id: manufacturer.id },
        data: { deletedAt: null, deletedBy: null, updatedBy: userCode }
      })

      return { status: 200, error: false, message: 'Manufacturer restored successfully!', action: actionTag }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })
