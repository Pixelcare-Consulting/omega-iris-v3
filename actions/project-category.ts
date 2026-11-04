'use server'

import { action, authenticationMiddleware, tenantMiddleware } from '@/lib/safe-action'

import db from '@/lib/db'
import { Prisma } from '@/prisma/generated/client'
import { DataTableParams, dataTableParamsSchema } from '@/schema/data-table'
import { buildColumnFiltersWhere, buildGlobalFilterWhere, buildOrderBy, getDataTableParams } from '@/lib/data-table'
import { PModels } from '@/types/prisma'
import { codeParamsSchema } from '@/schema/common'
import { logger } from '@/lib/logger'
import { projectCategoryFormSchema } from '@/schema/project-category'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { isUniqueConstraintError, toDuplicateMessage } from '@/lib/duplicate'
import { DuplicateFields } from '@/types/common'
import { capitalize } from 'radash'

export async function getProjectCategories(dbCode: string | null) {
  if (!dbCode) return []

  try {
    return await db.projectCategory.findMany({ where: { dbCode, deletedAt: null }, orderBy: { code: 'asc' } })
  } catch (err: any) {
    logger.error(err, '[GET_PROJECT_CATEGORIES_ERROR]:')
    return []
  }
}

export async function getProjectCategoryByCode(dbCode: string | null, code?: string | null) {
  if (!dbCode || !code) return null

  try {
    //* a soft-deleted category must be restored before it can be viewed or edited again
    return await db.projectCategory.findFirst({ where: { dbCode, code, deletedAt: null } })
  } catch (err: any) {
    logger.error(err, '[GET_PROJECT_CATEGORY_BY_CODE_ERROR]:')
    return null
  }
}

export const getProjectCategoriesClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .action(async ({ ctx }) => getProjectCategories(ctx.dbCode))

export async function getDataTableProjectCategoriesSvr(dbCode: string, params: DataTableParams) {
  const { perPage, offset, globalFilter, sorting, columnFilters, isExport, isShowDeleted } = getDataTableParams(params)

  const modelName: keyof PModels = 'ProjectCategory'

  //* initialize where input
  const where: Prisma.ProjectCategoryWhereInput = { dbCode, ...(isShowDeleted ? {} : { deletedAt: null }) }

  //* global filter
  if (globalFilter) {
    const filter = buildGlobalFilterWhere<typeof modelName>(globalFilter, {
      stringFields: ['code', 'name', 'description'],
      booleanFields: [{ field: 'isActive' }]
    })

    Object.assign(where, filter)
  }

  //* column filters
  if (columnFilters.length > 0) {
    const currentFilters = where.AND as Prisma.ProjectCategoryWhereInput[]

    const filters = buildColumnFiltersWhere<typeof modelName>(columnFilters, {
      booleanFields: [{ field: 'isActive' }],
      dateFields: [{ field: 'createdAt' }, { field: 'updatedAt' }]
    })

    where.AND = [...(currentFilters ?? []), ...filters]
  }

  //* initialize order input
  const orderBy: Prisma.ProjectCategoryOrderByWithRelationInput[] = buildOrderBy<typeof modelName>(sorting)

  try {
    const [data, rowCount] = await db.$transaction([
      db.projectCategory.findMany({ where, ...(isExport ? {} : { skip: offset, take: perPage }), orderBy }),
      db.projectCategory.count({ where })
    ])

    return { data, rowCount }
  } catch (err: any) {
    logger.error(err, '[GET_DATA_TABLE_PROJECT_CATEGORIES_ERROR]:')
    return { data: [], rowCount: 0 }
  }
}

export const getDataTableProjectCategoriesSvrClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(dataTableParamsSchema)
  .action(async ({ ctx, parsedInput }) => getDataTableProjectCategoriesSvr(ctx.dbCode, parsedInput))

export const upsertProjectCategory = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(projectCategoryFormSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { id, code, ...data } = parsedInput
    const { dbCode, userCode, ability } = ctx
    const actionTag = 'UPSERT_PROJECT_CATEGORY'
    const isCreate = !id

    const requiredAction = isCreate ? PERMISSIONS_ALLOWED_ACTIONS.CREATE : PERMISSIONS_ALLOWED_ACTIONS.EDIT

    if (!ability?.can(requiredAction, PERMISSIONS_CODES.PROJECT_CATEGORIES)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      //* deleted rows count too, the unique keys include them
      const [existingCode, existingName] = await Promise.all([
        //* code is locked after create, so an edit skips it
        isCreate ? db.projectCategory.findFirst({ where: { dbCode, code: { equals: code, mode: 'insensitive' } } }) : null,
        db.projectCategory.findFirst({
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

      //* update category
      if (!isCreate) {
        const existing = await db.projectCategory.findFirst({ where: { id, dbCode, deletedAt: null } })

        if (!existing) return { status: 404, error: true, message: 'Project category not found!', action: actionTag }

        //! the table hides these for system rows, this is the check behind it
        if (existing.isSystem) {
          return { status: 403, error: true, message: 'System generated project category cannot be edited!', action: actionTag }
        }

        //! code is never written here, even if the client sent one
        const projectCategory = await db.projectCategory.update({ where: { id }, data: { ...data, updatedBy: userCode } })

        return {
          status: 200,
          error: false,
          message: 'Project category updated successfully!',
          action: actionTag,
          data: { projectCategory }
        }
      }

      //* create category
      const projectCategory = await db.projectCategory.create({
        data: { ...data, code, dbCode, createdBy: userCode, updatedBy: userCode }
      })

      return { status: 200, error: false, message: 'Project category created successfully!', action: actionTag, data: { projectCategory } }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      //* a save that raced past the check above
      if (isUniqueConstraintError(err)) {
        return { status: 409, error: true, message: 'Code or name already exists!', action: actionTag }
      }

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })

export const deleteProjectCategory = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(codeParamsSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { dbCode, userCode, ability } = ctx
    const actionTag = 'DELETE_PROJECT_CATEGORY'

    if (!ability?.can(PERMISSIONS_ALLOWED_ACTIONS.DELETE, PERMISSIONS_CODES.PROJECT_CATEGORIES)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      const projectCategory = await db.projectCategory.findFirst({ where: { dbCode, code: parsedInput.code, deletedAt: null } })

      if (!projectCategory) return { status: 404, error: true, message: 'Project category not found!', action: actionTag }

      //! the table hides these for system rows, this is the check behind it
      if (projectCategory.isSystem) {
        return { status: 403, error: true, message: 'System generated project category cannot be deleted!', action: actionTag }
      }

      const projectCount = await db.customerProject.count({ where: { dbCode, categoryCode: projectCategory.code, deletedAt: null } })

      if (projectCount > 0) {
        return { status: 409, error: true, message: 'Category is in use by customer projects!', action: actionTag }
      }

      await db.projectCategory.update({ where: { id: projectCategory.id }, data: { deletedAt: new Date(), deletedBy: userCode } })

      return { status: 200, error: false, message: 'Project category deleted successfully!', action: actionTag }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })

export const restoreProjectCategory = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(codeParamsSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { dbCode, userCode, ability } = ctx
    const actionTag = 'RESTORE_PROJECT_CATEGORY'

    if (!ability?.can(PERMISSIONS_ALLOWED_ACTIONS.RESTORE, PERMISSIONS_CODES.PROJECT_CATEGORIES)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      const projectCategory = await db.projectCategory.findFirst({ where: { dbCode, code: parsedInput.code } })

      if (!projectCategory) return { status: 404, error: true, message: 'Project category not found!', action: actionTag }

      await db.projectCategory.update({
        where: { id: projectCategory.id },
        data: { deletedAt: null, deletedBy: null, updatedBy: userCode }
      })

      return { status: 200, error: false, message: 'Project category restored successfully!', action: actionTag }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })
