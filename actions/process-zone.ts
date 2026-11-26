'use server'

import { action, authenticationMiddleware, tenantMiddleware } from '@/lib/safe-action'

import db from '@/lib/db'
import { Prisma } from '@/prisma/generated/client'
import { DataTableParams, dataTableParamsSchema } from '@/schema/data-table'
import { buildColumnFiltersWhere, buildGlobalFilterWhere, buildOrderBy, getDataTableParams } from '@/lib/data-table'
import { PModels } from '@/types/prisma'
import { codeParamsSchema } from '@/schema/common'
import { logger } from '@/lib/logger'
import { processZoneFormSchema } from '@/schema/process-zone'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { findSameText, isUniqueConstraintError, toDuplicateMessage, toFieldListMessage } from '@/lib/duplicate'
import { DuplicateFields } from '@/types/common'
import { FilterOption } from '@/types/data-table'
import { diffActivity, logActivity } from '@/lib/activity-log'
import { PROCESS_ZONE_ACTIVITY_CONFIG } from '@/lib/activity-configs/process-zone'

export async function getProcessZones(dbCode: string | null) {
  if (!dbCode) return []

  try {
    return await db.processZone.findMany({ where: { dbCode, deletedAt: null, isActive: true }, orderBy: { code: 'asc' } })
  } catch (err: any) {
    logger.error(err, '[GET_PROCESS_ZONES_ERROR]:')
    return []
  }
}

//* list filter only, inactive ones too so old rows can be found
export async function getProcessZoneOptions(dbCode: string | null): Promise<FilterOption[]> {
  if (!dbCode) return []

  try {
    const processZones = await db.processZone.findMany({
      where: { dbCode, deletedAt: null },
      select: { code: true, name: true },
      orderBy: { code: 'asc' }
    })

    return processZones.map((processZone) => ({ label: `${processZone.code} - ${processZone.name}`, value: processZone.code }))
  } catch (err: any) {
    logger.error(err, '[GET_PROCESS_ZONE_OPTIONS_ERROR]:')
    return []
  }
}

export async function getProcessZoneByCode(dbCode: string | null, code?: string | null) {
  if (!dbCode || !code) return null

  try {
    //* a soft-deleted process zone must be restored before it can be viewed or edited again
    return await db.processZone.findFirst({ where: { dbCode, code, deletedAt: null } })
  } catch (err: any) {
    logger.error(err, '[GET_PROCESS_ZONE_BY_CODE_ERROR]:')
    return null
  }
}

export const getProcessZonesClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .action(async ({ ctx }) => getProcessZones(ctx.dbCode))

export async function getDataTableProcessZonesSvr(dbCode: string, params: DataTableParams) {
  const { perPage, offset, globalFilter, sorting, columnFilters, isExport, isShowDeleted } = getDataTableParams(params)

  const modelName: keyof PModels = 'ProcessZone'

  //* initialize where input
  const where: Prisma.ProcessZoneWhereInput = { dbCode, ...(isShowDeleted ? {} : { deletedAt: null }) }

  //* global filter
  if (globalFilter) {
    const filter = buildGlobalFilterWhere<typeof modelName>(globalFilter, {
      stringFields: ['code', 'name', 'description'],
      booleanFields: [{ field: 'isPalletEligible' }, { field: 'isActive' }]
    })

    Object.assign(where, filter)
  }

  //* column filters
  if (columnFilters.length > 0) {
    const currentFilters = where.AND as Prisma.ProcessZoneWhereInput[]

    const filters = buildColumnFiltersWhere<typeof modelName>(columnFilters, {
      booleanFields: [{ field: 'isPalletEligible' }, { field: 'isActive' }],
      dateFields: [{ field: 'createdAt' }, { field: 'updatedAt' }]
    })

    where.AND = [...(currentFilters ?? []), ...filters]
  }

  //* initialize order input
  const orderBy: Prisma.ProcessZoneOrderByWithRelationInput[] = buildOrderBy<typeof modelName>(sorting)

  try {
    const [data, rowCount] = await db.$transaction([
      db.processZone.findMany({ where, ...(isExport ? {} : { skip: offset, take: perPage }), orderBy }),
      db.processZone.count({ where })
    ])

    return { data, rowCount }
  } catch (err: any) {
    logger.error(err, '[GET_DATA_TABLE_PROCESS_ZONES_ERROR]:')
    return { data: [], rowCount: 0 }
  }
}

export const getDataTableProcessZonesSvrClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(dataTableParamsSchema)
  .action(async ({ ctx, parsedInput }) => {
    if (!ctx.ability?.can(PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.PROCESS_ZONES)) return { data: [], rowCount: 0 }
    return getDataTableProcessZonesSvr(ctx.dbCode, parsedInput)
  })

export const upsertProcessZone = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(processZoneFormSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { id, code, ...data } = parsedInput
    const { dbCode, userCode, ability } = ctx
    const actionTag = 'UPSERT_PROCESS_ZONE'
    const isCreate = !id

    const requiredAction = isCreate ? PERMISSIONS_ALLOWED_ACTIONS.CREATE : PERMISSIONS_ALLOWED_ACTIONS.EDIT

    if (!ability?.can(requiredAction, PERMISSIONS_CODES.PROCESS_ZONES)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      //* deleted rows count too, the unique keys include them
      const [existingCode, sameNames] = await Promise.all([
        //* code is locked after create, so an edit skips it
        isCreate ? db.processZone.findFirst({ where: { dbCode, code: { equals: code, mode: 'insensitive' } } }) : null,
        db.processZone.findMany({
          where: { dbCode, name: { equals: data.name, mode: 'insensitive' }, ...(id && { NOT: { id } }) }
        })
      ])

      const existingName = findSameText(sameNames, (row) => row.name, data.name)

      const duplicates: DuplicateFields = []

      if (existingCode) duplicates.push({ field: 'code', name: 'Code', message: toDuplicateMessage('Code', existingCode.deletedAt) })
      if (existingName) duplicates.push({ field: 'name', name: 'Name', message: toDuplicateMessage('Name', existingName.deletedAt) })

      if (duplicates.length > 0) {
        const paths = duplicates.map((d) => ({ field: d.field, message: d.message }))
        const message = toFieldListMessage(duplicates, 'already exists!', 'already exist!')
        return { status: 401, error: true, message, action: actionTag, paths }
      }

      //* update process zone
      if (!isCreate) {
        const existing = await db.processZone.findFirst({ where: { id, dbCode, deletedAt: null } })

        if (!existing) return { status: 404, error: true, message: 'Process zone not found!', action: actionTag }

        //! code is never written here, even if the client sent one
        const processZone = await db.$transaction(async (tx) => {
          const result = await tx.processZone.update({ where: { id }, data: { ...data, updatedBy: userCode } })

          await logActivity(tx, {
            actor: ctx.actor,
            module: 'PROCESS_ZONES',
            action: 'UPDATE',
            dbCode,
            entity: { id: result.id, code: result.code, label: result.name },
            changes: diffActivity(PROCESS_ZONE_ACTIVITY_CONFIG, existing, result)
          })

          return result
        })

        return {
          status: 200,
          error: false,
          message: 'Process zone updated successfully!',
          action: actionTag,
          data: { processZone }
        }
      }

      //* create process zone
      const processZone = await db.$transaction(async (tx) => {
        const result = await tx.processZone.create({ data: { ...data, code, dbCode, createdBy: userCode, updatedBy: userCode } })

        await logActivity(tx, {
          actor: ctx.actor,
          module: 'PROCESS_ZONES',
          action: 'CREATE',
          dbCode,
          entity: { id: result.id, code: result.code, label: result.name },
          changes: diffActivity(PROCESS_ZONE_ACTIVITY_CONFIG, null, result)
        })

        return result
      })

      return { status: 200, error: false, message: 'Process zone created successfully!', action: actionTag, data: { processZone } }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      //* a save that raced past the check above
      if (isUniqueConstraintError(err)) {
        return { status: 409, error: true, message: 'Code or name already exists!', action: actionTag }
      }

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })

export const deleteProcessZone = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(codeParamsSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { dbCode, userCode, ability } = ctx
    const actionTag = 'DELETE_PROCESS_ZONE'

    if (!ability?.can(PERMISSIONS_ALLOWED_ACTIONS.DELETE, PERMISSIONS_CODES.PROCESS_ZONES)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      const processZone = await db.processZone.findFirst({ where: { dbCode, code: parsedInput.code, deletedAt: null } })

      if (!processZone) return { status: 404, error: true, message: 'Process zone not found!', action: actionTag }

      //! the table hides these for system rows, this is the check behind it
      if (processZone.isSystem) {
        return { status: 403, error: true, message: 'System generated process zone cannot be deleted!', action: actionTag }
      }

      const locationCount = await db.location.count({ where: { dbCode, processZoneCode: processZone.code, deletedAt: null } })

      if (locationCount > 0) {
        return { status: 409, error: true, message: 'Process zone is in use by locations!', action: actionTag }
      }

      await db.$transaction(async (tx) => {
        await tx.processZone.update({ where: { id: processZone.id }, data: { deletedAt: new Date(), deletedBy: userCode } })

        await logActivity(tx, {
          actor: ctx.actor,
          module: 'PROCESS_ZONES',
          action: 'DELETE',
          dbCode,
          entity: { id: processZone.id, code: processZone.code, label: processZone.name }
        })
      })

      return { status: 200, error: false, message: 'Process zone deleted successfully!', action: actionTag }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })

export const restoreProcessZone = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(codeParamsSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { dbCode, userCode, ability } = ctx
    const actionTag = 'RESTORE_PROCESS_ZONE'

    if (!ability?.can(PERMISSIONS_ALLOWED_ACTIONS.RESTORE, PERMISSIONS_CODES.PROCESS_ZONES)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      const processZone = await db.processZone.findFirst({ where: { dbCode, code: parsedInput.code } })

      if (!processZone) return { status: 404, error: true, message: 'Process zone not found!', action: actionTag }

      await db.$transaction(async (tx) => {
        await tx.processZone.update({ where: { id: processZone.id }, data: { deletedAt: null, deletedBy: null, updatedBy: userCode } })

        await logActivity(tx, {
          actor: ctx.actor,
          module: 'PROCESS_ZONES',
          action: 'RESTORE',
          dbCode,
          entity: { id: processZone.id, code: processZone.code, label: processZone.name }
        })
      })

      return { status: 200, error: false, message: 'Process zone restored successfully!', action: actionTag }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })
