'use server'

import { action, authenticationMiddleware, tenantMiddleware } from '@/lib/safe-action'

import db from '@/lib/db'
import { Prisma } from '@/prisma/generated/client'
import { DataTableParams, dataTableParamsSchema } from '@/schema/data-table'
import { buildColumnFiltersWhere, buildGlobalFilterWhere, buildOrderBy, getDataTableParams } from '@/lib/data-table'
import { PModels } from '@/types/prisma'
import { codeParamsSchema } from '@/schema/common'
import { logger } from '@/lib/logger'
import { siteFormSchema } from '@/schema/site'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { findSameText, isUniqueConstraintError, toDuplicateMessage, toFieldListMessage } from '@/lib/duplicate'
import { DuplicateFields } from '@/types/common'
import { FilterOption } from '@/types/data-table'

export async function getSites(dbCode: string | null) {
  if (!dbCode) return []

  try {
    return await db.site.findMany({ where: { dbCode, deletedAt: null, isActive: true }, orderBy: { code: 'asc' } })
  } catch (err: any) {
    logger.error(err, '[GET_SITES_ERROR]:')
    return []
  }
}

//* list filter only, inactive ones too so old rows can be found
export async function getSiteOptions(dbCode: string | null): Promise<FilterOption[]> {
  if (!dbCode) return []

  try {
    const sites = await db.site.findMany({
      where: { dbCode, deletedAt: null },
      select: { code: true, name: true },
      orderBy: { code: 'asc' }
    })

    return sites.map((site) => ({ label: `${site.code} - ${site.name}`, value: site.code }))
  } catch (err: any) {
    logger.error(err, '[GET_SITE_OPTIONS_ERROR]:')
    return []
  }
}

export async function getSiteByCode(dbCode: string | null, code?: string | null) {
  if (!dbCode || !code) return null

  try {
    //* a soft-deleted site must be restored before it can be viewed or edited again
    return await db.site.findFirst({ where: { dbCode, code, deletedAt: null } })
  } catch (err: any) {
    logger.error(err, '[GET_SITE_BY_CODE_ERROR]:')
    return null
  }
}

export const getSitesClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .action(async ({ ctx }) => getSites(ctx.dbCode))

export async function getDataTableSitesSvr(dbCode: string, params: DataTableParams) {
  const { perPage, offset, globalFilter, sorting, columnFilters, isExport, isShowDeleted } = getDataTableParams(params)

  const modelName: keyof PModels = 'Site'

  //* initialize where input
  const where: Prisma.SiteWhereInput = { dbCode, ...(isShowDeleted ? {} : { deletedAt: null }) }

  //* global filter
  if (globalFilter) {
    const filter = buildGlobalFilterWhere<typeof modelName>(globalFilter, {
      stringFields: ['code', 'name', 'description'],
      booleanFields: [
        { field: 'isEnableInbound' },
        { field: 'isEnableOutbound' },
        { field: 'isEnableMovement' },
        { field: 'isEnableCycleCount' },
        { field: 'isEnableQcTesting' },
        { field: 'isEnableRma' },
        { field: 'isActive' }
      ]
    })

    Object.assign(where, filter)
  }

  //* column filters
  if (columnFilters.length > 0) {
    const currentFilters = where.AND as Prisma.SiteWhereInput[]

    const filters = buildColumnFiltersWhere<typeof modelName>(columnFilters, {
      booleanFields: [
        { field: 'isEnableInbound' },
        { field: 'isEnableOutbound' },
        { field: 'isEnableMovement' },
        { field: 'isEnableCycleCount' },
        { field: 'isEnableQcTesting' },
        { field: 'isEnableRma' },
        { field: 'isActive' }
      ],
      dateFields: [{ field: 'createdAt' }, { field: 'updatedAt' }]
    })

    where.AND = [...(currentFilters ?? []), ...filters]
  }

  //* initialize order input
  const orderBy: Prisma.SiteOrderByWithRelationInput[] = buildOrderBy<typeof modelName>(sorting)

  try {
    const [data, rowCount] = await db.$transaction([
      db.site.findMany({ where, ...(isExport ? {} : { skip: offset, take: perPage }), orderBy }),
      db.site.count({ where })
    ])

    return { data, rowCount }
  } catch (err: any) {
    logger.error(err, '[GET_DATA_TABLE_SITES_ERROR]:')
    return { data: [], rowCount: 0 }
  }
}

export const getDataTableSitesSvrClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(dataTableParamsSchema)
  .action(async ({ ctx, parsedInput }) => getDataTableSitesSvr(ctx.dbCode, parsedInput))

export const upsertSite = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(siteFormSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { id, code, ...data } = parsedInput
    const { dbCode, userCode, ability } = ctx
    const actionTag = 'UPSERT_SITE'
    const isCreate = !id

    const requiredAction = isCreate ? PERMISSIONS_ALLOWED_ACTIONS.CREATE : PERMISSIONS_ALLOWED_ACTIONS.EDIT

    if (!ability?.can(requiredAction, PERMISSIONS_CODES.SITES)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      //* deleted rows count too, the unique keys include them
      const [existingCode, sameNames] = await Promise.all([
        //* code is locked after create, so an edit skips it
        isCreate ? db.site.findFirst({ where: { dbCode, code: { equals: code, mode: 'insensitive' } } }) : null,
        db.site.findMany({
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

      //* update site
      if (!isCreate) {
        const existing = await db.site.findFirst({ where: { id, dbCode, deletedAt: null } })

        if (!existing) return { status: 404, error: true, message: 'Site not found!', action: actionTag }

        //! the table hides these for system rows, this is the check behind it
        if (existing.isSystem) {
          return { status: 403, error: true, message: 'System generated site cannot be edited!', action: actionTag }
        }

        //! code is never written here, even if the client sent one
        const site = await db.site.update({ where: { id }, data: { ...data, updatedBy: userCode } })

        return {
          status: 200,
          error: false,
          message: 'Site updated successfully!',
          action: actionTag,
          data: { site }
        }
      }

      //* create site
      const site = await db.site.create({
        data: { ...data, code, dbCode, createdBy: userCode, updatedBy: userCode }
      })

      return { status: 200, error: false, message: 'Site created successfully!', action: actionTag, data: { site } }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      //* a save that raced past the check above
      if (isUniqueConstraintError(err)) {
        return { status: 409, error: true, message: 'Code or name already exists!', action: actionTag }
      }

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })

export const deleteSite = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(codeParamsSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { dbCode, userCode, ability } = ctx
    const actionTag = 'DELETE_SITE'

    if (!ability?.can(PERMISSIONS_ALLOWED_ACTIONS.DELETE, PERMISSIONS_CODES.SITES)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      const site = await db.site.findFirst({ where: { dbCode, code: parsedInput.code, deletedAt: null } })

      if (!site) return { status: 404, error: true, message: 'Site not found!', action: actionTag }

      //! the table hides these for system rows, this is the check behind it
      if (site.isSystem) {
        return { status: 403, error: true, message: 'System generated site cannot be deleted!', action: actionTag }
      }

      const locationCount = await db.location.count({ where: { dbCode, siteCode: site.code, deletedAt: null } })

      if (locationCount > 0) {
        return { status: 409, error: true, message: 'Site is in use by locations!', action: actionTag }
      }

      await db.site.update({ where: { id: site.id }, data: { deletedAt: new Date(), deletedBy: userCode } })

      return { status: 200, error: false, message: 'Site deleted successfully!', action: actionTag }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })

export const restoreSite = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(codeParamsSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { dbCode, userCode, ability } = ctx
    const actionTag = 'RESTORE_SITE'

    if (!ability?.can(PERMISSIONS_ALLOWED_ACTIONS.RESTORE, PERMISSIONS_CODES.SITES)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      const site = await db.site.findFirst({ where: { dbCode, code: parsedInput.code } })

      if (!site) return { status: 404, error: true, message: 'Site not found!', action: actionTag }

      await db.site.update({
        where: { id: site.id },
        data: { deletedAt: null, deletedBy: null, updatedBy: userCode }
      })

      return { status: 200, error: false, message: 'Site restored successfully!', action: actionTag }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })
