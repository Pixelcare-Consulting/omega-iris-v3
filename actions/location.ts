'use server'

import { action, authenticationMiddleware, tenantMiddleware } from '@/lib/safe-action'

import db from '@/lib/db'
import { Prisma } from '@/prisma/generated/client'
import { DataTableParams, dataTableParamsSchema } from '@/schema/data-table'
import { buildColumnFiltersWhere, buildGlobalFilterWhere, buildOrderBy, getDataTableParams } from '@/lib/data-table'
import { PModels } from '@/types/prisma'
import { codeParamsSchema } from '@/schema/common'
import { logger } from '@/lib/logger'
import { FilterOption } from '@/types/data-table'
import { existingLocationCodesSchema, locationFormSchema, locationGenerateFormSchema } from '@/schema/location'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { isUniqueConstraintError, toDuplicateMessage } from '@/lib/duplicate'
import { buildLocationCode, expandLocationRun } from '@/lib/location'
import { createLocationRows, LocationCreateRow } from '@/lib/location-create'
import { createId } from '@paralleldrive/cuid2'
import { diffActivity, logActivities, logActivity } from '@/lib/activity-log'
import { LOCATION_ACTIVITY_CONFIG } from '@/lib/activity-configs/location'

const COMMON_LOCATION_INCLUDE = { site: true, processZone: true } satisfies Prisma.LocationInclude

export type LocationWithRelations = Prisma.LocationGetPayload<{ include: typeof COMMON_LOCATION_INCLUDE }>

//* list filter only, inactive ones too so old rows can be found
export async function getLocationOptions(dbCode: string | null): Promise<FilterOption[]> {
  if (!dbCode) return []

  try {
    const locations = await db.location.findMany({
      where: { dbCode, deletedAt: null },
      select: { code: true },
      orderBy: { code: 'asc' }
    })

    return locations.map((location) => ({ label: location.code, value: location.code }))
  } catch (err: any) {
    logger.error(err, '[GET_LOCATION_OPTIONS_ERROR]:')
    return []
  }
}

export async function getLocationByCode(dbCode: string | null, code?: string | null) {
  if (!dbCode || !code) return null

  try {
    //* a soft-deleted location must be restored before it can be viewed or edited again
    return await db.location.findFirst({ where: { dbCode, code, deletedAt: null }, include: COMMON_LOCATION_INCLUDE })
  } catch (err: any) {
    logger.error(err, '[GET_LOCATION_BY_CODE_ERROR]:')
    return null
  }
}

//* live, active and pallet allowed, for the pallet pickers
export async function getPalletLocations(dbCode: string | null) {
  if (!dbCode) return []

  try {
    return await db.location.findMany({
      where: { dbCode, deletedAt: null, isActive: true, isPalletAllowed: true },
      select: { code: true, name: true },
      orderBy: { code: 'asc' }
    })
  } catch (err: any) {
    logger.error(err, '[GET_PALLET_LOCATIONS_ERROR]:')
    return []
  }
}

export const getPalletLocationsClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .action(async ({ ctx }) => getPalletLocations(ctx.dbCode))

//* live and active, any location, for the container pickers
export async function getActiveLocations(dbCode: string | null) {
  if (!dbCode) return []

  try {
    return await db.location.findMany({
      where: { dbCode, deletedAt: null, isActive: true },
      select: { code: true, name: true, isPalletAllowed: true },
      orderBy: { code: 'asc' }
    })
  } catch (err: any) {
    logger.error(err, '[GET_ACTIVE_LOCATIONS_ERROR]:')
    return []
  }
}

export const getActiveLocationsClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .action(async ({ ctx }) => getActiveLocations(ctx.dbCode))

//* live rows only, ordered by code, missing ids drop out
export async function getLocationsByIds(dbCode: string, ids: string[]) {
  try {
    return await db.location.findMany({
      where: { dbCode, id: { in: ids }, deletedAt: null },
      include: COMMON_LOCATION_INCLUDE,
      orderBy: { code: 'asc' }
    })
  } catch (err: any) {
    logger.error(err, '[GET_LOCATIONS_BY_IDS_ERROR]:')
    return []
  }
}

export async function getDataTableLocationsSvr(dbCode: string, params: DataTableParams) {
  const { perPage, offset, globalFilter, sorting, columnFilters, isExport, isShowDeleted } = getDataTableParams(params)

  const modelName: keyof PModels = 'Location'

  //* initialize where input
  const where: Prisma.LocationWhereInput = { dbCode, ...(isShowDeleted ? {} : { deletedAt: null }) }

  //* global filter, type is an enum so contains would fail
  if (globalFilter) {
    const filter = buildGlobalFilterWhere<typeof modelName>(globalFilter, {
      stringFields: ['code', 'name', 'siteCode', 'processZoneCode', 'bayCode', 'levelCode', 'rackCode'],
      booleanFields: [{ field: 'isActive' }, { field: 'isPalletAllowed' }]
    })

    Object.assign(where, filter)
  }

  //* column filters
  if (columnFilters.length > 0) {
    const currentFilters = where.AND as Prisma.LocationWhereInput[]

    const filters = buildColumnFiltersWhere<typeof modelName>(columnFilters, {
      stringFields: [
        { field: 'type', nullable: true },
        'siteCode',
        'processZoneCode',
        'bayCode',
        { field: 'levelCode', nullable: true },
        { field: 'rackCode', nullable: true }
      ],
      booleanFields: [{ field: 'isActive' }, { field: 'isPalletAllowed' }],
      dateFields: [{ field: 'createdAt' }, { field: 'updatedAt' }]
    })

    where.AND = [...(currentFilters ?? []), ...filters]
  }

  //* initialize order input
  const orderBy: Prisma.LocationOrderByWithRelationInput[] = buildOrderBy<typeof modelName>(sorting)

  try {
    const [data, rowCount] = await db.$transaction([
      db.location.findMany({ where, include: COMMON_LOCATION_INCLUDE, ...(isExport ? {} : { skip: offset, take: perPage }), orderBy }),
      db.location.count({ where })
    ])

    return { data, rowCount }
  } catch (err: any) {
    logger.error(err, '[GET_DATA_TABLE_LOCATIONS_ERROR]:')
    return { data: [], rowCount: 0 }
  }
}

export const getDataTableLocationsSvrClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(dataTableParamsSchema)
  .action(async ({ ctx, parsedInput }) => {
    //* view only, label select all goes through isExport and must not need export
    if (!ctx.ability?.can(PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.LOCATIONS)) return { data: [], rowCount: 0 }
    return getDataTableLocationsSvr(ctx.dbCode, parsedInput)
  })

//* deleted rows included, they still hold the code
export const getExistingLocationCodesClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(existingLocationCodesSchema)
  .action(async ({ ctx, parsedInput }) => {
    if (parsedInput.codes.length === 0) return []

    try {
      return await db.location.findMany({
        where: { dbCode: ctx.dbCode, code: { in: parsedInput.codes } },
        select: { code: true, deletedAt: true }
      })
    } catch (err: any) {
      logger.error(err, '[GET_EXISTING_LOCATION_CODES_ERROR]:')
      return []
    }
  })

export const upsertLocation = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(locationFormSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { id, type, siteCode, processZoneCode, bayCode, levelCode, rackCode, name, isActive, isPalletAllowed } = parsedInput
    const { dbCode, userCode, ability } = ctx
    const actionTag = 'UPSERT_LOCATION'
    const isCreate = !id

    const requiredAction = isCreate ? PERMISSIONS_ALLOWED_ACTIONS.CREATE : PERMISSIONS_ALLOWED_ACTIONS.EDIT

    if (!ability?.can(requiredAction, PERMISSIONS_CODES.LOCATIONS)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      //* update location
      if (!isCreate) {
        const existing = await db.location.findFirst({ where: { id, dbCode, deletedAt: null } })

        if (!existing) return { status: 404, error: true, message: 'Location not found!', action: actionTag }

        //! turning pallets off would strand the pallets already here
        if (existing.isPalletAllowed && !isPalletAllowed) {
          const palletCount = await db.pallet.count({ where: { dbCode, locationCode: existing.code, deletedAt: null } })

          if (palletCount > 0) {
            return { status: 409, error: true, message: 'Location has pallets on it, move them off first!', action: actionTag }
          }
        }

        //! code parts are locked, only these change
        const location = await db.$transaction(async (tx) => {
          const result = await tx.location.update({
            where: { id },
            data: { name: name ?? existing.code, type, isActive, isPalletAllowed, updatedBy: userCode }
          })

          await logActivity(tx, {
            actor: ctx.actor,
            module: 'LOCATIONS',
            action: 'UPDATE',
            dbCode,
            entity: { id: result.id, code: result.code, label: result.name },
            changes: diffActivity(LOCATION_ACTIVITY_CONFIG, existing, result)
          })

          return result
        })

        return { status: 200, error: false, message: 'Location updated successfully!', action: actionTag, data: { location } }
      }

      const [site, processZone] = await Promise.all([
        db.site.findFirst({ where: { dbCode, code: siteCode, deletedAt: null, isActive: true } }),
        db.processZone.findFirst({ where: { dbCode, code: processZoneCode, deletedAt: null, isActive: true } })
      ])

      if (!site) return { status: 404, error: true, message: 'Site not found!', action: actionTag }
      if (!processZone) return { status: 404, error: true, message: 'Process zone not found!', action: actionTag }

      //* create location
      const parts = { siteCode, processZoneCode, bayCode, levelCode, rackCode }
      const code = buildLocationCode(parts)
      const row: LocationCreateRow = { ...parts, code, name: name ?? code, type, isActive, isPalletAllowed }

      const location = await db.$transaction(async (tx) => {
        const { createdCount } = await createLocationRows(tx, { dbCode, userCode, rows: [row] })

        //* zero means it existed, or a save raced past the check
        if (createdCount === 0) return null

        const result = await tx.location.findFirstOrThrow({ where: { dbCode, code } })

        await logActivity(tx, {
          actor: ctx.actor,
          module: 'LOCATIONS',
          action: 'CREATE',
          dbCode,
          entity: { id: result.id, code: result.code, label: result.name },
          changes: diffActivity(LOCATION_ACTIVITY_CONFIG, null, result)
        })

        return result
      })

      if (!location) {
        const duplicate = await db.location.findFirst({ where: { dbCode, code }, select: { deletedAt: true } })
        const message = toDuplicateMessage('Code', duplicate?.deletedAt ?? null)

        return { status: 401, error: true, message, action: actionTag, paths: [{ field: 'code', message }] }
      }

      return { status: 200, error: false, message: 'Location created successfully!', action: actionTag, data: { location } }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      if (isUniqueConstraintError(err)) {
        return { status: 409, error: true, message: 'Code already exists!', action: actionTag }
      }

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })

export const generateLocations = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(locationGenerateFormSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { siteCode, lines, excludedCodes } = parsedInput
    const { dbCode, userCode, ability } = ctx
    const actionTag = 'GENERATE_LOCATIONS'

    if (!ability?.can(PERMISSIONS_ALLOWED_ACTIONS.CREATE, PERMISSIONS_CODES.LOCATIONS)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      const zoneCodes = [...new Set(lines.map((line) => line.processZoneCode))]

      const [site, processZones] = await Promise.all([
        db.site.findFirst({ where: { dbCode, code: siteCode, deletedAt: null, isActive: true } }),
        db.processZone.findMany({ where: { dbCode, code: { in: zoneCodes }, deletedAt: null, isActive: true }, select: { code: true } })
      ])

      if (!site) return { status: 404, error: true, message: 'Site not found!', action: actionTag }

      const missingZone = zoneCodes.find((zoneCode) => !processZones.some((zone) => zone.code === zoneCode))

      if (missingZone) return { status: 404, error: true, message: `Process zone ${missingZone} not found!`, action: actionTag }

      //* rebuild on the server, never trust the client list
      const expanded = expandLocationRun(siteCode, lines)
      const excluded = new Set(excludedCodes)

      const rows: LocationCreateRow[] = expanded
        .filter((row) => !row.isRepeated && !excluded.has(row.code))
        .map(({ code, siteCode, processZoneCode, bayCode, levelCode, rackCode, type, isPalletAllowed }) => ({
          code,
          name: code,
          siteCode,
          processZoneCode,
          bayCode,
          levelCode,
          rackCode,
          type,
          isActive: true, //* new locations start active, the edit form changes it
          isPalletAllowed
        }))

      if (rows.length === 0) return { status: 400, error: true, message: 'No locations to create!', action: actionTag }

      const { createdCount } = await db.$transaction(
        async (tx) => {
          const result = await createLocationRows(tx, { dbCode, userCode, rows })
          const created = await tx.location.findMany({ where: { dbCode, code: { in: result.createdCodes }, deletedAt: null } })
          const batchId = createId()

          //* one row per location, then one summary for the run
          await logActivities(tx, [
            ...created.map((location) => ({
              actor: ctx.actor,
              module: 'LOCATIONS' as const,
              action: 'CREATE' as const,
              dbCode,
              batchId,
              summary: 'Created by bulk generate',
              entity: { id: location.id, code: location.code, label: location.name },
              changes: diffActivity(LOCATION_ACTIVITY_CONFIG, null, location)
            })),
            {
              actor: ctx.actor,
              module: 'LOCATIONS' as const,
              action: 'BULK_CREATE' as const,
              dbCode,
              batchId,
              changes: { fields: [], meta: { created: result.createdCount, skipped: expanded.length - result.createdCount } }
            }
          ])

          return result
        },
        { timeout: 30000 }
      )

      const skippedCount = expanded.length - createdCount

      return {
        status: 200,
        error: false,
        message: `${createdCount} locations created, ${skippedCount} skipped!`,
        action: actionTag,
        data: { createdCount, skippedCount }
      }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })

export const deleteLocation = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(codeParamsSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { dbCode, userCode, ability } = ctx
    const actionTag = 'DELETE_LOCATION'

    if (!ability?.can(PERMISSIONS_ALLOWED_ACTIONS.DELETE, PERMISSIONS_CODES.LOCATIONS)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      const location = await db.location.findFirst({ where: { dbCode, code: parsedInput.code, deletedAt: null } })

      if (!location) return { status: 404, error: true, message: 'Location not found!', action: actionTag }

      const palletCount = await db.pallet.count({ where: { dbCode, locationCode: location.code, deletedAt: null } })

      if (palletCount > 0) {
        return { status: 409, error: true, message: 'Location is in use by pallets!', action: actionTag }
      }

      //! containers point here too, after the pallet check so that one still runs first
      const containerCount = await db.container.count({ where: { dbCode, locationCode: location.code, deletedAt: null } })

      if (containerCount > 0) {
        return { status: 409, error: true, message: 'Location is in use by containers!', action: actionTag }
      }

      //* any live unit here blocks it
      const unitCount = await db.packagingUnit.count({ where: { dbCode, locationCode: location.code, deletedAt: null } })

      if (unitCount > 0) {
        return { status: 409, error: true, message: 'Location is in use by unique IDs!', action: actionTag }
      }

      await db.$transaction(async (tx) => {
        await tx.location.update({ where: { id: location.id }, data: { deletedAt: new Date(), deletedBy: userCode } })

        await logActivity(tx, {
          actor: ctx.actor,
          module: 'LOCATIONS',
          action: 'DELETE',
          dbCode,
          entity: { id: location.id, code: location.code, label: location.name }
        })
      })

      return { status: 200, error: false, message: 'Location deleted successfully!', action: actionTag }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })

export const restoreLocation = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(codeParamsSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { dbCode, userCode, ability } = ctx
    const actionTag = 'RESTORE_LOCATION'

    if (!ability?.can(PERMISSIONS_ALLOWED_ACTIONS.RESTORE, PERMISSIONS_CODES.LOCATIONS)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      const location = await db.location.findFirst({ where: { dbCode, code: parsedInput.code }, include: COMMON_LOCATION_INCLUDE })

      if (!location) return { status: 404, error: true, message: 'Location not found!', action: actionTag }

      //! a live location on a deleted parent is not allowed
      if (location.site.deletedAt) return { status: 409, error: true, message: 'Restore the site first!', action: actionTag }
      if (location.processZone.deletedAt) {
        return { status: 409, error: true, message: 'Restore the process zone first!', action: actionTag }
      }

      await db.$transaction(async (tx) => {
        await tx.location.update({ where: { id: location.id }, data: { deletedAt: null, deletedBy: null, updatedBy: userCode } })

        await logActivity(tx, {
          actor: ctx.actor,
          module: 'LOCATIONS',
          action: 'RESTORE',
          dbCode,
          entity: { id: location.id, code: location.code, label: location.name }
        })
      })

      return { status: 200, error: false, message: 'Location restored successfully!', action: actionTag }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })
