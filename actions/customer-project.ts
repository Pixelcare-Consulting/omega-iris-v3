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
import { customerProjectFormSchema } from '@/schema/customer-project'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { findSameText, isUniqueConstraintError, toDuplicateMessage, toFieldListMessage } from '@/lib/duplicate'
import { DuplicateFields } from '@/types/common'
import { diffActivity, logActivity } from '@/lib/activity-log'
import { CUSTOMER_PROJECT_ACTIVITY_CONFIG } from '@/lib/activity-configs/customer-project'

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

//* list filter only, inactive ones too so old rows can be found
export async function getCustomerProjectOptions(dbCode: string | null): Promise<FilterOption[]> {
  if (!dbCode) return []

  try {
    const projects = await db.customerProject.findMany({
      where: { dbCode, deletedAt: null },
      select: { code: true, name: true },
      orderBy: { code: 'asc' }
    })

    return projects.map((project) => ({ label: `${project.code} - ${project.name}`, value: project.code }))
  } catch (err: any) {
    logger.error(err, '[GET_CUSTOMER_PROJECT_OPTIONS_ERROR]:')
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
      stringFields: ['categoryCode'],
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
  .action(async ({ ctx, parsedInput }) => {
    if (!ctx.ability?.can(PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.CUSTOMER_PROJECTS)) return { data: [], rowCount: 0 }
    return getDataTableCustomerProjectsSvr(ctx.dbCode, parsedInput)
  })

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
      const [existingCode, sameNames] = await Promise.all([
        //* code is locked after create, so an edit skips it
        isCreate ? db.customerProject.findFirst({ where: { dbCode, code: { equals: code, mode: 'insensitive' } } }) : null,
        db.customerProject.findMany({
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

      const existing = isCreate
        ? null
        : await db.customerProject.findFirst({ where: { id, dbCode, deletedAt: null }, include: COMMON_CUSTOMER_PROJECT_INCLUDE })

      if (!isCreate && !existing) return { status: 404, error: true, message: 'Customer project not found!', action: actionTag }

      //! the table hides these for system rows, this is the check behind it
      if (existing?.isSystem) {
        return { status: 403, error: true, message: 'System generated customer project cannot be edited!', action: actionTag }
      }

      //* category is locked after create, so only a new project checks it
      if (isCreate) {
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
        //! code and category are never written here, pallet and container codes hold them
        const { categoryCode, ...editable } = data
        const customerProject = await db.$transaction(async (tx) => {
          const result = await tx.customerProject.update({
            where: { id: existing.id },
            data: { ...editable, updatedBy: userCode },
            include: COMMON_CUSTOMER_PROJECT_INCLUDE
          })

          await logActivity(tx, {
            actor: ctx.actor,
            module: 'CUSTOMER_PROJECTS',
            action: 'UPDATE',
            dbCode,
            entity: { id: result.id, code: result.code, label: result.name },
            changes: diffActivity(CUSTOMER_PROJECT_ACTIVITY_CONFIG, existing, result)
          })

          return result
        })

        return {
          status: 200,
          error: false,
          message: 'Customer project updated successfully!',
          action: actionTag,
          data: { customerProject }
        }
      }

      //* create project
      const customerProject = await db.$transaction(async (tx) => {
        const result = await tx.customerProject.create({
          data: { ...data, code, dbCode, createdBy: userCode, updatedBy: userCode },
          include: COMMON_CUSTOMER_PROJECT_INCLUDE
        })

        await logActivity(tx, {
          actor: ctx.actor,
          module: 'CUSTOMER_PROJECTS',
          action: 'CREATE',
          dbCode,
          entity: { id: result.id, code: result.code, label: result.name },
          changes: diffActivity(CUSTOMER_PROJECT_ACTIVITY_CONFIG, null, result)
        })

        return result
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

      const palletCount = await db.pallet.count({ where: { dbCode, customerProjectCode: customerProject.code, deletedAt: null } })

      if (palletCount > 0) {
        return { status: 409, error: true, message: 'Customer project is in use by pallets!', action: actionTag }
      }

      const containerCount = await db.container.count({ where: { dbCode, customerProjectCode: customerProject.code, deletedAt: null } })

      if (containerCount > 0) {
        return { status: 409, error: true, message: 'Customer project is in use by containers!', action: actionTag }
      }

      await db.$transaction(async (tx) => {
        await tx.customerProject.update({ where: { id: customerProject.id }, data: { deletedAt: new Date(), deletedBy: userCode } })

        await logActivity(tx, {
          actor: ctx.actor,
          module: 'CUSTOMER_PROJECTS',
          action: 'DELETE',
          dbCode,
          entity: { id: customerProject.id, code: customerProject.code, label: customerProject.name }
        })
      })

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

      await db.$transaction(async (tx) => {
        await tx.customerProject.update({
          where: { id: customerProject.id },
          data: { deletedAt: null, deletedBy: null, updatedBy: userCode }
        })

        await logActivity(tx, {
          actor: ctx.actor,
          module: 'CUSTOMER_PROJECTS',
          action: 'RESTORE',
          dbCode,
          entity: { id: customerProject.id, code: customerProject.code, label: customerProject.name }
        })
      })

      return { status: 200, error: false, message: 'Customer project restored successfully!', action: actionTag }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })
