'use server'

import { action, authenticationMiddleware, tenantMiddleware } from '@/lib/safe-action'

import db from '@/lib/db'
import { Prisma } from '@/prisma/generated/client'
import { DataTableParams, dataTableParamsSchema } from '@/schema/data-table'
import { buildColumnFiltersWhere, buildGlobalFilterWhere, buildOrderBy, getDataTableParams } from '@/lib/data-table'
import { PModels } from '@/types/prisma'
import { codeParamsSchema } from '@/schema/common'
import { logger } from '@/lib/logger'
import { customerProjectFormSchema } from '@/schema/customer-project'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { isUniqueConstraintError, toDuplicateMessage } from '@/lib/duplicate'
import { DuplicateFields } from '@/types/common'
import { capitalize } from 'radash'

const COMMON_CUSTOMER_PROJECT_INCLUDE = { category: true } satisfies Prisma.CustomerProjectInclude

export type CustomerProjectWithRelations = Prisma.CustomerProjectGetPayload<{ include: typeof COMMON_CUSTOMER_PROJECT_INCLUDE }>

export async function getCustomerProjects(dbCode: string | null) {
  if (!dbCode) return []

  try {
    return await db.customerProject.findMany({
      where: { dbCode, deletedAt: null, isActive: true },
      include: COMMON_CUSTOMER_PROJECT_INCLUDE,
      orderBy: { code: 'asc' }
    })
  } catch (err: any) {
    logger.error(err, '[GET_CUSTOMER_PROJECTS_ERROR]:')
    return []
  }
}

export async function getCustomerProjectByCode(dbCode: string | null, code?: string | null) {
  if (!dbCode || !code) return null

  try {
    //* a soft-deleted project must be restored before it can be viewed or edited again
    return await db.customerProject.findFirst({ where: { dbCode, code, deletedAt: null }, include: COMMON_CUSTOMER_PROJECT_INCLUDE })
  } catch (err: any) {
    logger.error(err, '[GET_CUSTOMER_PROJECT_BY_CODE_ERROR]:')
    return null
  }
}

export const getCustomerProjectsClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .action(async ({ ctx }) => getCustomerProjects(ctx.dbCode))

export async function getDataTableCustomerProjectsSvr(dbCode: string, params: DataTableParams) {
  const { perPage, offset, globalFilter, sorting, columnFilters, isExport, isShowDeleted } = getDataTableParams(params)

  const modelName: keyof PModels = 'CustomerProject'

  //* initialize where input
  const where: Prisma.CustomerProjectWhereInput = { dbCode, ...(isShowDeleted ? {} : { deletedAt: null }) }

  //* global filter
  if (globalFilter) {
    const filter = buildGlobalFilterWhere<typeof modelName>(globalFilter, {
      stringFields: ['code', 'name', 'description', 'categoryCode'],
      booleanFields: [{ field: 'isActive' }],
      relationFields: [{ relation: 'category', fields: ['name'], relationNullable: true }]
    })

    Object.assign(where, filter)
  }

  //* column filters
  if (columnFilters.length > 0) {
    const currentFilters = where.AND as Prisma.CustomerProjectWhereInput[]

    const filters = buildColumnFiltersWhere<typeof modelName>(columnFilters, {
      stringFields: [{ field: 'categoryCode', nullable: true }],
      booleanFields: [{ field: 'isActive' }],
      dateFields: [{ field: 'createdAt' }, { field: 'updatedAt' }]
    })

    where.AND = [...(currentFilters ?? []), ...filters]
  }

  //* initialize order input
  const orderBy: Prisma.CustomerProjectOrderByWithRelationInput[] = buildOrderBy<typeof modelName>(sorting)

  try {
    const [data, rowCount] = await db.$transaction([
      db.customerProject.findMany({
        where,
        include: COMMON_CUSTOMER_PROJECT_INCLUDE,
        ...(isExport ? {} : { skip: offset, take: perPage }),
        orderBy
      }),
      db.customerProject.count({ where })
    ])

    return { data, rowCount }
  } catch (err: any) {
    logger.error(err, '[GET_DATA_TABLE_CUSTOMER_PROJECTS_ERROR]:')
    return { data: [], rowCount: 0 }
  }
}

export const getDataTableCustomerProjectsSvrClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(dataTableParamsSchema)
  .action(async ({ ctx, parsedInput }) => getDataTableCustomerProjectsSvr(ctx.dbCode, parsedInput))

export const upsertCustomerProject = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(customerProjectFormSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { id, code, ...data } = parsedInput
    const { dbCode, userCode, ability } = ctx
    const actionTag = 'UPSERT_CUSTOMER_PROJECT'
    const isCreate = !id

    const requiredAction = isCreate ? PERMISSIONS_ALLOWED_ACTIONS.CREATE : PERMISSIONS_ALLOWED_ACTIONS.EDIT

    if (!ability?.can(requiredAction, PERMISSIONS_CODES.CUSTOMER_PROJECTS)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      //* deleted rows count too, the unique keys include them
      const [existingCode, existingName] = await Promise.all([
        //* code is locked after create, so an edit skips it
        isCreate ? db.customerProject.findFirst({ where: { dbCode, code: { equals: code, mode: 'insensitive' } } }) : null,
        db.customerProject.findFirst({
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

      const existing = isCreate ? null : await db.customerProject.findFirst({ where: { id, dbCode, deletedAt: null } })

      if (!isCreate && !existing) return { status: 404, error: true, message: 'Customer project not found!', action: actionTag }

      //! the table hides these for system rows, this is the check behind it
      if (existing?.isSystem) {
        return { status: 403, error: true, message: 'System generated customer project cannot be edited!', action: actionTag }
      }

      //* only a changed category is checked, keeping an inactive one is fine
      if (data.categoryCode && data.categoryCode !== existing?.categoryCode) {
        const category = await db.projectCategory.findFirst({
          where: { dbCode, code: data.categoryCode, deletedAt: null, isActive: true },
          select: { id: true }
        })

        if (!category) {
          const message = 'Category is not available!'
          return { status: 401, error: true, message, action: actionTag, paths: [{ field: 'categoryCode', message }] }
        }
      }

      //* update project
      if (existing) {
        //! code is never written here, even if the client sent one
        const customerProject = await db.customerProject.update({ where: { id: existing.id }, data: { ...data, updatedBy: userCode } })

        return {
          status: 200,
          error: false,
          message: 'Customer project updated successfully!',
          action: actionTag,
          data: { customerProject }
        }
      }

      //* create project
      const customerProject = await db.customerProject.create({
        data: { ...data, code, dbCode, createdBy: userCode, updatedBy: userCode }
      })

      return { status: 200, error: false, message: 'Customer project created successfully!', action: actionTag, data: { customerProject } }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      //* a save that raced past the check above
      if (isUniqueConstraintError(err)) {
        return { status: 409, error: true, message: 'Code or name already exists!', action: actionTag }
      }

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })

export const deleteCustomerProject = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(codeParamsSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { dbCode, userCode, ability } = ctx
    const actionTag = 'DELETE_CUSTOMER_PROJECT'

    if (!ability?.can(PERMISSIONS_ALLOWED_ACTIONS.DELETE, PERMISSIONS_CODES.CUSTOMER_PROJECTS)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      const customerProject = await db.customerProject.findFirst({ where: { dbCode, code: parsedInput.code, deletedAt: null } })

      if (!customerProject) return { status: 404, error: true, message: 'Customer project not found!', action: actionTag }

      //! the table hides these for system rows, this is the check behind it
      if (customerProject.isSystem) {
        return { status: 403, error: true, message: 'System generated customer project cannot be deleted!', action: actionTag }
      }

      await db.customerProject.update({ where: { id: customerProject.id }, data: { deletedAt: new Date(), deletedBy: userCode } })

      return { status: 200, error: false, message: 'Customer project deleted successfully!', action: actionTag }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })

export const restoreCustomerProject = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(codeParamsSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { dbCode, userCode, ability } = ctx
    const actionTag = 'RESTORE_CUSTOMER_PROJECT'

    if (!ability?.can(PERMISSIONS_ALLOWED_ACTIONS.RESTORE, PERMISSIONS_CODES.CUSTOMER_PROJECTS)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      const customerProject = await db.customerProject.findFirst({ where: { dbCode, code: parsedInput.code } })

      if (!customerProject) return { status: 404, error: true, message: 'Customer project not found!', action: actionTag }

      await db.customerProject.update({
        where: { id: customerProject.id },
        data: { deletedAt: null, deletedBy: null, updatedBy: userCode }
      })

      return { status: 200, error: false, message: 'Customer project restored successfully!', action: actionTag }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })
