import { createMiddleware, createSafeActionClient } from 'next-safe-action'
import { logger } from './logger'
import { headers } from 'next/headers'
import { auth } from './auth'
import db from './db'
import { buildAbilityFor } from './rbac'
import { toFullName } from './user'
import { getSapDatabaseAccess } from './sap/access'

function handleServerError(error: Error) {
  logger.error(error)
  throw error
}

//? ISSUE - ReferenceError: Cannot access 'action' before initialization
//? DESCRIPTION - The issue occured cause by circular dependency - e.g when importing something from other source which also uses action e.g /action/users.ts
//* SOLUTION - Don't import something from other file which uses action or something inside safe-action.ts

export const authenticationMiddleware = createMiddleware().define(async ({ next }) => {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session || !session.user) throw { code: 401, message: 'Unauthorized!', action: 'AUTHENTICATION_MIDDLEWARE' }

  const user = await db.user.findUnique({
    where: { id: session.user.id, deletedAt: null, deletedBy: null },
    include: {
      role: {
        include: { rolePermissions: { include: { permission: true } } }
      }
    }
  })

  if (!user) throw { code: 401, message: 'Unauthorized!', action: 'AUTHENTICATION_MIDDLEWARE' }

  const { id, code, role } = user

  const rolePermissions = role.rolePermissions.map((rp) => ({
    id: rp.permission.id,
    code: rp.permission.code,
    actions: rp.actions
  }))

  const fullName = toFullName(user)

  const ability = buildAbilityFor({ roleKey: role.key, rolePermissions })

  return next({
    ctx: {
      fullName,
      userId: id,
      userCode: code,
      roleCode: role.code,
      roleKey: role.key,
      roleName: role.name,
      ability,
      sessionToken: session.session.token,
      dbCode: session.session.dbCode ?? null //* null for global actions, tenantMiddleware narrows it for sap ones
    }
  })
})

//* chain after authenticationMiddleware on any action that touches sap data, ctx.dbCode is a string after this
export const tenantMiddleware = createMiddleware<{ ctx: { dbCode: string | null; roleCode: number } }>().define(async ({ next, ctx }) => {
  if (!ctx.dbCode) throw { code: 401, message: 'No SAP database selected!', action: 'TENANT_MIDDLEWARE' }

  //* the session keeps the database it was given, so access removed after picking is only caught here
  const { isAllowed, isError } = await getSapDatabaseAccess(ctx.dbCode, ctx.roleCode)

  if (isError) throw { code: 503, message: 'Could not check SAP database access!', action: 'TENANT_MIDDLEWARE' }
  if (!isAllowed) throw { code: 403, message: 'No access to this SAP database!', action: 'TENANT_MIDDLEWARE' }

  return next({ ctx: { dbCode: ctx.dbCode } })
})

export const action = createSafeActionClient({ handleServerError })
