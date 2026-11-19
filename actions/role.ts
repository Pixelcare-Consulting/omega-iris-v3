'use server'

import { action, authenticationMiddleware } from '@/lib/safe-action'

import db from '@/lib/db'
import { Prisma } from '@/prisma/generated/client'
import { DataTableParams, dataTableParamsSchema } from '@/schema/data-table'
import { buildColumnFiltersWhere, buildGlobalFilterWhere, getDataTableParams } from '@/lib/data-table'
import { PModels } from '@/types/prisma'
import { paramsSchema } from '@/schema/common'
import { logger } from '@/lib/logger'
import { roleFormSchema } from '@/schema/role'
import { FilterOption } from '@/types/data-table'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { diffActivity, logActivity } from '@/lib/activity-log'
import { ROLE_ACTIVITY_CONFIG, ROLE_ACTIVITY_INCLUDE } from '@/lib/activity-configs/role'

const ROLE_DETAIL_INCLUDE = {
  rolePermissions: true,
  roleSapDatabases: {
    include: { sapDatabase: true },
    orderBy: [{ sapDatabase: { order: 'asc' } }, { sapDatabase: { name: 'asc' } }]
  }
} satisfies Prisma.RoleInclude

export async function getRoles() {
  try {
    return db.role.findMany({ where: { deletedAt: null } })
  } catch (err: any) {
    logger.error(err, '[GET_ROLES_ERROR]:')
    return []
  }
}

//* list filter only, form pickers use the live rows
export async function getRoleOptions(): Promise<FilterOption[]> {
  try {
    const roles = await db.role.findMany({ where: { deletedAt: null }, select: { key: true, name: true }, orderBy: { name: 'asc' } })
    return roles.map((role) => ({ label: role.name, value: role.key }))
  } catch (err: any) {
    logger.error(err, '[GET_ROLE_OPTIONS_ERROR]:')
    return []
  }
}

export async function getRoleByCode(code?: number | null) {
  if (!code) return null

  try {
    //* a soft-deleted role must be restored before it can be viewed or edited again
    return db.role.findUnique({ where: { code, deletedAt: null }, include: ROLE_DETAIL_INCLUDE })
  } catch (err: any) {
    logger.error(err, '[GET_ROLE_BY_CODE_ERROR]:')
    return null
  }
}

export const getRolesClient = action.use(authenticationMiddleware).action(async () => getRoles())

export async function getDataTableRolesSvr(params: DataTableParams) {
  const { perPage, offset, globalFilter, sorting, columnFilters, isExport, isShowDeleted } = getDataTableParams(params)

  const modelName: keyof PModels = 'Role'

  //* initialize where input
  //* soft-deleted rows stay out unless the Show Deleted toggle is on
  const where: Prisma.RoleWhereInput = { ...(isShowDeleted ? {} : { deletedAt: null }) }

  //* global filter
  if (globalFilter) {
    const filter = buildGlobalFilterWhere<typeof modelName>(globalFilter, {
      stringFields: ['name', 'description', 'color'],
      numericFields: ['code']
    })

    Object.assign(where, filter)
  }

  //* column filters
  if (columnFilters.length > 0) {
    const currentFilters = where.AND as Prisma.RoleWhereInput[]

    const filters = buildColumnFiltersWhere<typeof modelName>(columnFilters, {
      stringFields: [{ field: 'color', nullable: true }],
      dateFields: [{ field: 'createdAt' }, { field: 'updatedAt' }]
    })

    where.AND = [...(currentFilters ?? []), ...filters]
  }

  //* initialize order input
  const orderBy: Prisma.RoleOrderByWithRelationInput[] = sorting.map(({ id, desc }) => ({ [id]: desc ? 'desc' : 'asc' }))

  try {
    const [data, rowCount] = await db.$transaction([
      db.role.findMany({ where, ...(isExport ? {} : { skip: offset, take: perPage }), orderBy }),
      db.role.count({ where })
    ])

    return { data, rowCount }
  } catch (err: any) {
    logger.error(err, '[GET_DATA_TABLE_ROLES_ERROR]:')
    return { data: [], rowCount: 0 }
  }
}

export const getDataTableRolesSvrClient = action
  .use(authenticationMiddleware)
  .inputSchema(dataTableParamsSchema)
  .action(async ({ ctx, parsedInput }) => {
    if (!ctx.ability?.can(PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.ROLES)) return { data: [], rowCount: 0 }
    return getDataTableRolesSvr(parsedInput)
  })

export const upsertRole = action
  .use(authenticationMiddleware)
  .inputSchema(roleFormSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { code, permissions, roles, sapDatabases, ...data } = parsedInput
    const { userCode, ability } = ctx
    const actionTag = 'UPSERT_ROLE'
    const isCreate = !code || code === -1

    const requiredAction = isCreate ? PERMISSIONS_ALLOWED_ACTIONS.CREATE : PERMISSIONS_ALLOWED_ACTIONS.EDIT

    if (!ability?.can(requiredAction, PERMISSIONS_CODES.ROLES)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }
    const uniqueSapDatabases = [...new Set(sapDatabases)] //* a repeated code would break the composite key

    try {
      const existingRole = await db.role.findFirst({ where: { key: data.key, ...(code && code !== -1 && { code: { not: code } }) } })

      //* check if existing
      if (existingRole) return { error: true, status: 401, message: 'Key already exists!', action: actionTag }

      //* update role
      if (code && code !== -1) {
        const before = await db.role.findUnique({ where: { code }, include: ROLE_ACTIVITY_INCLUDE })

        const updatedRole = await db.$transaction(async (tx) => {
          //* update role
          const role = await tx.role.update({ where: { code }, data: { ...data, updatedBy: userCode } })

          //* delete the existing role permissions records
          await tx.rolePermission.deleteMany({ where: { roleCode: role.code } })

          //* create new role permissions
          await tx.rolePermission.createMany({
            data: permissions
              .filter((p) => p.actions.length > 0)
              .map((p) => ({ roleCode: role.code, permissionCode: p.code, actions: p.actions }))
          })

          //* replace the role sap databases the same way
          await tx.roleSapDatabase.deleteMany({ where: { roleCode: role.code } })

          await tx.roleSapDatabase.createMany({
            data: uniqueSapDatabases.map((dbCode) => ({ roleCode: role.code, sapDatabaseCode: dbCode }))
          })

          const after = await tx.role.findUnique({ where: { code }, include: ROLE_ACTIVITY_INCLUDE })

          await logActivity(tx, {
            actor: ctx.actor,
            module: 'ROLES',
            action: 'UPDATE',
            entity: { id: role.id, code: role.code, label: role.name },
            changes: diffActivity(ROLE_ACTIVITY_CONFIG, before, after)
          })

          return role
        })

        return {
          status: 200,
          message: 'Role updated successfully!',
          action: actionTag,
          data: { role: updatedRole }
        }
      }

      //* create role
      const newRole = await db.$transaction(async (tx) => {
        const role = await tx.role.create({
          data: {
            ...data,
            createdBy: userCode,
            updatedBy: userCode,
            rolePermissions: {
              createMany: {
                data: permissions.filter((p) => p.actions.length > 0).map((p) => ({ permissionCode: p.code, actions: p.actions }))
              }
            },
            roleSapDatabases: {
              createMany: {
                data: uniqueSapDatabases.map((dbCode) => ({ sapDatabaseCode: dbCode }))
              }
            }
          },
          include: ROLE_ACTIVITY_INCLUDE
        })

        await logActivity(tx, {
          actor: ctx.actor,
          module: 'ROLES',
          action: 'CREATE',
          entity: { id: role.id, code: role.code, label: role.name },
          changes: diffActivity(ROLE_ACTIVITY_CONFIG, null, role)
        })

        return role
      })

      return { status: 200, message: 'Role created successfully!', action: actionTag, data: { role: newRole } }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      return {
        error: true,
        status: 500,
        message: err instanceof Error ? err.message : 'Something went wrong!',
        action: actionTag
      }
    }
  })

export const deleteRole = action
  .use(authenticationMiddleware)
  .inputSchema(paramsSchema)
  .action(async ({ ctx, parsedInput }) => {
    const actionTag = 'DELETE_ROLE'

    if (!ctx.ability?.can(PERMISSIONS_ALLOWED_ACTIONS.DELETE, PERMISSIONS_CODES.ROLES)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      const role = await db.role.findUnique({ where: { code: parsedInput.code } })

      if (!role) return { error: true, status: 404, message: 'Role not found!', action: actionTag }

      //! the table only hides delete for system roles, this is the check behind it
      if (role.isSystem) {
        return { error: true, status: 403, message: 'System generated role cannot be deleted!', action: actionTag }
      }

      await db.$transaction(async (tx) => {
        await tx.role.update({ where: { code: parsedInput.code }, data: { deletedAt: new Date(), deletedBy: ctx.userCode } })
        await logActivity(tx, {
          actor: ctx.actor,
          module: 'ROLES',
          action: 'DELETE',
          entity: { id: role.id, code: role.code, label: role.name }
        })
      })

      return { status: 200, message: 'Role deleted successfully!', action: actionTag }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      return {
        status: 500,
        error: true,
        message: err instanceof Error ? err.message : 'Something went wrong!',
        action: actionTag
      }
    }
  })

export const restoreRole = action
  .use(authenticationMiddleware)
  .inputSchema(paramsSchema)
  .action(async ({ ctx, parsedInput }) => {
    const actionTag = 'RESTORE_ROLE'

    if (!ctx.ability?.can(PERMISSIONS_ALLOWED_ACTIONS.RESTORE, PERMISSIONS_CODES.ROLES)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      const role = await db.role.findUnique({ where: { code: parsedInput.code } })

      if (!role) return { error: true, status: 404, message: 'Role not found!', action: actionTag }

      await db.$transaction(async (tx) => {
        await tx.role.update({ where: { code: parsedInput.code }, data: { deletedAt: null, deletedBy: null, updatedBy: ctx.userCode } })
        await logActivity(tx, {
          actor: ctx.actor,
          module: 'ROLES',
          action: 'RESTORE',
          entity: { id: role.id, code: role.code, label: role.name }
        })
      })

      return { status: 200, message: 'Role restored successfully!', action: actionTag }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      return {
        status: 500,
        error: true,
        message: err instanceof Error ? err.message : 'Something went wrong!',
        action: actionTag
      }
    }
  })
