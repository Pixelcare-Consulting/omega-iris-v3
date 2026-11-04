'use server'

import { generateId } from 'better-auth'
import { isArray } from 'radash'
import { hashPassword, verifyPassword } from 'better-auth/crypto'
import { action, authenticationMiddleware } from '@/lib/safe-action'
import { z } from 'zod'

import db from '@/lib/db'
import { basicInfoFormSchema, changePasswordFormSchema, userFormSchema } from '@/schema/user'
import { DuplicateFields } from '@/types/common'
import { Prisma } from '@/prisma/generated/client'
import { DataTableParams, dataTableParamsSchema } from '@/schema/data-table'
import { buildColumnFiltersWhere, buildGlobalFilterWhere, buildOrderBy, getDataTableParams } from '@/lib/data-table'
import { PModels } from '@/types/prisma'
import { paramsSchema } from '@/schema/common'
import { logger } from '@/lib/logger'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { buildAbilityFor } from '@/lib/rbac'
import { SUPER_USER_ROLE_KEY } from '@/constants/role'
import { toFullName } from '@/lib/user'
import { toFieldListMessage } from '@/lib/duplicate'

const COMMON_USER_INCLUDE = {
  role: true
} satisfies Prisma.UserInclude

export type UserWithInclude = Prisma.UserGetPayload<{ include: typeof COMMON_USER_INCLUDE }>

export async function getUsers(roleKeys?: string[]) {
  try {
    return db.user.findMany({
      where: { deletedAt: null, ...(isArray(roleKeys) && roleKeys.length > 0 && { role: { key: { in: roleKeys } } }) },
      include: COMMON_USER_INCLUDE
    })
  } catch (err: any) {
    logger.error(err, '[GET_USERS_ERROR]:')
    return []
  }
}

export const getUsersClient = action
  .use(authenticationMiddleware)
  .inputSchema(z.object({ roleKeys: z.array(z.string()).optional() }))
  .action(async ({ parsedInput }) => getUsers(parsedInput.roleKeys))

export async function getCurrentUserWithAbility() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user) return null
  const { id, code, name, roleName, roleCode, roleKey, rolePermissions } = session.user

  return {
    userId: id,
    userCode: code,
    name,
    roleName,
    roleCode,
    roleKey,
    ability: buildAbilityFor({ roleKey: roleKey, rolePermissions: roleKey === SUPER_USER_ROLE_KEY ? [] : rolePermissions })
  }
}

export async function getDataTableUsersSvr(params: DataTableParams) {
  const { perPage, offset, globalFilter, sorting, columnFilters, isExport, isShowDeleted } = getDataTableParams(params)

  const modelName: keyof PModels = 'User'

  //* initialize where input
  //* soft-deleted rows stay out unless the Show Deleted toggle is on
  const where: Prisma.UserWhereInput = { ...(isShowDeleted ? {} : { deletedAt: null }) }

  //* global filter
  if (globalFilter) {
    const filter = buildGlobalFilterWhere<typeof modelName>(globalFilter, {
      stringFields: ['fname', 'mname', 'lname', 'suffix', 'name', 'email', 'username'],
      numericFields: ['code'],
      booleanFields: [{ field: 'isActive' }, { field: 'isLocked' }],
      relationFields: [{ relation: 'role', fields: ['name'] }]
    })

    Object.assign(where, filter)
  }

  //* column filters
  if (columnFilters.length > 0) {
    const currentFilters = where.AND as Prisma.UserWhereInput[]

    const filters = buildColumnFiltersWhere<typeof modelName>(columnFilters, {
      booleanFields: [{ field: 'isActive' }, { field: 'isLocked' }],
      dateFields: [{ field: 'createdAt' }, { field: 'updatedAt' }],
      relationFields: [{ id: 'roleName', relation: 'role', field: 'key' }]
    })

    where.AND = [...(currentFilters ?? []), ...filters]
  }

  //* initialize order input
  const orderBy: Prisma.UserOrderByWithRelationInput[] = buildOrderBy<typeof modelName>(sorting, {
    relationFields: [{ id: 'roleName', relation: 'role', field: 'name' }]
  })

  try {
    const [data, rowCount] = await db.$transaction([
      db.user.findMany({ where, ...(isExport ? {} : { skip: offset, take: perPage }), orderBy, include: COMMON_USER_INCLUDE }),
      db.user.count({ where })
    ])

    return { data, rowCount }
  } catch (err: any) {
    logger.error(err, '[GET_DATA_TABLE_USERS_ERROR]:')
    return { data: [], rowCount: 0 }
  }
}

export const getDataTableUsersSvrClient = action
  .use(authenticationMiddleware)
  .inputSchema(dataTableParamsSchema)
  .action(async ({ parsedInput }) => getDataTableUsersSvr(parsedInput))

export async function getUserById(id: string) {
  if (!id) return null

  try {
    return db.user.findUnique({ where: { id, deletedAt: null }, include: COMMON_USER_INCLUDE })
  } catch (err: any) {
    logger.error(err, '[GET_USER_BY_ID_ERROR]:')
    return null
  }
}

export async function getUserByEmail(email: string) {
  if (!email) return null

  try {
    //! must exclude soft-deleted users, better-auth's signInEmail knows nothing about deletedAt
    return db.user.findUnique({ where: { email, deletedAt: null }, include: COMMON_USER_INCLUDE })
  } catch (err: any) {
    logger.error(err, '[GET_USER_BY_EMAIL_ERROR]:')
    return null
  }
}

export async function getUserByUsername(username: string) {
  if (!username) return null

  try {
    return db.user.findUnique({ where: { username, deletedAt: null }, include: COMMON_USER_INCLUDE })
  } catch (err: any) {
    logger.error(err, '[GET_USER_BY_USERNAME_ERROR]:')
    return null
  }
}

export async function getUserByCode(code?: number | null) {
  if (!code) return null

  try {
    //* a soft-deleted user must be restored before they can be viewed or edited again
    return db.user.findUnique({ where: { code, deletedAt: null }, include: COMMON_USER_INCLUDE })
  } catch (err: any) {
    logger.error(err, '[GET_USER_BY_CODE_ERROR]:')
    return null
  }
}

export const getUserByCodeClient = action
  .use(authenticationMiddleware)
  .inputSchema(z.object({ code: z.coerce.number().nullish() }))
  .action(async ({ parsedInput }) => getUserByCode(parsedInput.code))

export const upsertUser = action
  .use(authenticationMiddleware)
  .inputSchema(userFormSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { code, password, confirmPassword, newPassword, newConfirmPassword, roleKey, isForceToChangePassword, isLocked, ...data } =
      parsedInput
    const { userCode } = ctx
    const actionTag = 'UPSERT_USER'

    try {
      const [existingUsername, existingEmail] = await Promise.all([
        db.user.findFirst({
          where: {
            username: data.username,
            ...(code && code !== -1 && { code: { not: code } })
          }
        }),
        db.user.findFirst({
          where: {
            email: data.email,
            ...(code && code !== -1 && { code: { not: code } })
          }
        })
      ])

      const duplicates: DuplicateFields = []

      if (existingUsername) duplicates.push({ field: 'username', name: 'Username', message: 'Username already exists!' })
      if (existingEmail) duplicates.push({ field: 'email', name: 'Email', message: 'Email already exists!' })

      if (duplicates.length > 0) {
        const paths = duplicates.map((d) => ({ field: d.field, message: d.message }))
        const message = toFieldListMessage(duplicates, 'already exists!', 'already exist!')
        return { status: 401, error: true, message, action: actionTag, paths }
      }

      //* update user
      if (code !== -1) {
        const user = await db.user.findUnique({ where: { code }, include: { accounts: { where: { providerId: 'credential' } } } })

        if (!user) return { error: true, status: 404, message: 'User not found!', action: actionTag }

        let hashedPassword = user.accounts?.[0]?.password

        if (newPassword) hashedPassword = await hashPassword(newPassword)

        const isBeingUnlocked = user.isLocked && !isLocked
        const isBeingLocked = !user.isLocked && isLocked
        const name = toFullName(data)

        //* a live cookie must not still work after a password reset or a lock
        const shouldRevokeSessions = Boolean(newPassword) || Boolean(isBeingLocked)

        const updatedUser = await db.$transaction(async (tx) => {
          //* update user
          const result = await tx.user.update({
            where: { code },
            data: {
              ...data,
              name,
              updatedBy: userCode,
              isDefaultPasswordChanged: isForceToChangePassword ? false : true,
              isLocked: isLocked ? true : false,
              failedLoginAttempts: isBeingUnlocked ? 0 : user.failedLoginAttempts
            },
            include: { accounts: { where: { providerId: 'credential' } } }
          })

          //* update account password
          if (newPassword && result.accounts?.[0]?.id) {
            await tx.account.updateMany({
              where: { id: result.accounts[0].id },
              data: { password: hashedPassword }
            })
          }

          //! revoke the EDITED user's sessions, not the caller's, revokeOtherSessions reads the admin's own cookies
          if (shouldRevokeSessions) await tx.authSession.deleteMany({ where: { userId: result.id } })

          return result
        })

        return { status: 200, message: 'User updated successfully!', data: { user: updatedUser }, action: actionTag }
      }

      const hashedPassword = await hashPassword(password!)
      const name = toFullName(data)

      const newUser = await db.$transaction(async (tx) => {
        //* create user
        const user = await tx.user.create({
          data: {
            ...data,
            name,
            createdBy: userCode,
            updatedBy: userCode,
            isDefaultPasswordChanged: isForceToChangePassword ? false : true,
            isLocked: isLocked ? true : false
          },
          include: { role: true }
        })

        //* create account
        await tx.account.create({
          data: {
            id: generateId(),
            userId: user.id,
            providerId: 'credential',
            accountId: user.id,
            password: hashedPassword
          }
        })

        return user
      })

      return { status: 200, message: 'User created successfully!', data: { user: newUser }, action: actionTag }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      if (err?.statusCode === 422) return { status: 422, message: 'Email already exists!', action: actionTag }
      if (err?.status === 409) return { status: 409, message: 'Username already exists!', action: actionTag }

      return {
        status: 500,
        error: true,
        message: err instanceof Error ? err.message : 'Something went wrong!',
        action: actionTag
      }
    }
  })

export const updateBasicInfo = action
  .use(authenticationMiddleware)
  .inputSchema(basicInfoFormSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { code, roleKey, ...data } = parsedInput
    const { userCode } = ctx
    const actionTag = 'UPDATE_BASIC_INFO'

    try {
      //! a user may only edit their own basic info, admin edits go through upsertUser
      if (code !== userCode) return { status: 403, error: true, message: 'You are not allowed to edit this profile!', action: actionTag }

      const [existingUsername, existingEmail] = await Promise.all([
        db.user.findFirst({
          where: {
            username: data.username,
            code: { not: code }
          }
        }),
        db.user.findFirst({
          where: {
            email: data.email,
            code: { not: code }
          }
        })
      ])

      const duplicates: DuplicateFields = []

      if (existingUsername) duplicates.push({ field: 'username', name: 'Username', message: 'Username already exists!' })
      if (existingEmail) duplicates.push({ field: 'email', name: 'Email', message: 'Email already exists!' })

      if (duplicates.length > 0) {
        const paths = duplicates.map((d) => ({ field: d.field, message: d.message }))
        const message = toFieldListMessage(duplicates, 'already exists!', 'already exist!')
        return { status: 401, error: true, message, action: actionTag, paths }
      }

      //* update user
      const user = await db.user.findUnique({ where: { code } })

      if (!user) return { error: true, status: 404, message: 'User not found!', action: actionTag }

      const name = toFullName(data)

      const updatedUser = await db.user.update({
        where: { code },
        data: { ...data, name, updatedBy: userCode }
      })

      return { status: 200, message: 'Basic info updated successfully!', data: { user: updatedUser }, action: actionTag }
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

export const changePassword = action
  .use(authenticationMiddleware)
  .inputSchema(changePasswordFormSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { code, oldPassword, newPassword } = parsedInput
    const { userCode } = ctx

    //* default tag, replaced once the db says which flow this is
    let actionTag = 'CHANGE_PASSWORD'

    try {
      //! a user may only change their own password, admin resets go through upsertUser
      if (code !== userCode) return { status: 403, error: true, message: 'You are not allowed to change this password!', action: actionTag }

      const existingUser = await db.user.findUnique({
        where: { code: userCode },
        include: { accounts: { where: { providerId: 'credential' }, take: 1 } }
      })

      if (!existingUser) return { status: 404, error: true, message: 'User not found!', action: actionTag }

      const account = existingUser.accounts?.[0]

      //! no credential account means nothing to update, never report this as success
      if (!account?.password) {
        return {
          status: 409,
          error: true,
          message: 'This account has no password set. Please contact an administrator.',
          action: actionTag
        }
      }

      //! the forced flow comes from the db, never the client, it decides whether the old password is checked
      const isForceToChangePassword = !existingUser.isDefaultPasswordChanged
      actionTag = isForceToChangePassword ? 'CHANGED_DEFAULT_PASSWORD' : 'UPDATE_PROFILE_CHANGE_PASSWORD'

      if (!newPassword) return { status: 400, error: true, message: 'New password is required!', action: actionTag }

      //* normal profile change, the old password is the proof of identity
      if (!isForceToChangePassword) {
        if (!oldPassword) return { status: 400, error: true, message: 'Old password is required!', action: actionTag, path: 'oldPassword' }

        const isPasswordMatch = await verifyPassword({ hash: account.password, password: oldPassword })

        if (!isPasswordMatch) {
          return { status: 409, error: true, message: 'Old password does not match!', action: actionTag, path: 'oldPassword' }
        }
      }

      //* a forced change rides the caller's session, but the new password still may not be the one they were handed
      const isSameAsCurrent = await verifyPassword({ hash: account.password, password: newPassword })

      if (isSameAsCurrent) {
        return {
          status: 409,
          error: true,
          message: 'New password must be different from your current password!',
          action: actionTag,
          path: 'newPassword'
        }
      }

      const hashedPassword = await hashPassword(newPassword)

      const updatedUser = await db.$transaction(async (tx) => {
        //* update user
        const user = await tx.user.update({
          where: { code: userCode },
          data: { updatedBy: userCode, isDefaultPasswordChanged: true }
        })

        //! update the credential account by its id, not the user id
        await tx.account.update({ where: { id: account.id }, data: { password: hashedPassword } })

        return user
      })

      //* clear every other session so an old cookie stops working
      //! the password is already committed, a failure here must not fail the request
      try {
        await auth.api.revokeOtherSessions({ headers: await headers() })
      } catch (err: any) {
        logger.error(err, '[CHANGE_PASSWORD_REVOKE_SESSIONS_ERROR]:')
      }

      return { status: 200, error: false, message: 'Password changed successfully!', data: { user: updatedUser }, action: actionTag }
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

export const deleteUser = action
  .use(authenticationMiddleware)
  .inputSchema(paramsSchema)
  .action(async ({ ctx, parsedInput }) => {
    const actionTag = 'DELETE_USER'

    try {
      const user = await db.user.findUnique({ where: { code: parsedInput.code } })

      if (!user) return { error: true, status: 404, message: 'User not found!', action: actionTag }

      //! the table only hides the row actions for system users, this is the check behind it
      if (user.isSystem) {
        return { error: true, status: 403, message: 'System generated user cannot be deleted!', action: actionTag }
      }

      await db.$transaction(async (tx) => {
        await tx.user.update({ where: { code: parsedInput.code }, data: { deletedAt: new Date(), deletedBy: ctx.userCode } })

        //! getSession and proxy.ts don't check deletedAt, a soft-deleted user would keep loading pages until their session expires
        await tx.authSession.deleteMany({ where: { userId: user.id } })
      })

      return { status: 200, message: 'User deleted successfully!', action: actionTag }
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

export const restoreUser = action
  .use(authenticationMiddleware)
  .inputSchema(paramsSchema)
  .action(async ({ ctx, parsedInput }) => {
    const actionTag = 'RESTORE_USER'

    try {
      const user = await db.user.findUnique({ where: { code: parsedInput.code } })

      if (!user) return { error: true, status: 404, message: 'User not found!', action: actionTag }

      await db.user.update({ where: { code: parsedInput.code }, data: { deletedAt: null, deletedBy: null, updatedBy: ctx.userCode } })

      return { status: 200, message: 'User restored successfully!', action: actionTag }
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
