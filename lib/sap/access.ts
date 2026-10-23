import 'server-only'

import db from '@/lib/db'
import { logger } from '@/lib/logger'
import { Prisma } from '@/prisma/generated/client'
import { SUPER_USER_ROLE_KEY } from '@/constants/role'

//? lives outside /actions so safe-action.ts can import it without a circular dependency

const SAP_DATABASE_ACCESS_ORDER_BY = [{ order: 'asc' }, { name: 'asc' }] satisfies Prisma.SapDatabaseOrderByWithRelationInput[]

//* every active database, for pickers that are not scoped to a role
export async function getActiveSapDatabases() {
  try {
    return await db.sapDatabase.findMany({ where: { isActive: true }, orderBy: SAP_DATABASE_ACCESS_ORDER_BY })
  } catch (err: any) {
    logger.error(err, '[GET_ACTIVE_SAP_DATABASES_ERROR]:')
    return []
  }
}

//* throws on a db error, callers decide what that means
async function findSapDatabasesForRole(roleCode?: number | null) {
  if (!roleCode) return []

  const role = await db.role.findUnique({ where: { code: roleCode, deletedAt: null }, select: { key: true } })
  if (!role) return []

  const isSuperUser = role.key === SUPER_USER_ROLE_KEY

  return db.sapDatabase.findMany({
    where: { isActive: true, ...(!isSuperUser && { roleSapDatabases: { some: { roleCode } } }) },
    orderBy: SAP_DATABASE_ACCESS_ORDER_BY
  })
}

//* databases a role may use, super user always gets all of them
export async function getSapDatabasesForRole(roleCode?: number | null) {
  try {
    return await findSapDatabasesForRole(roleCode)
  } catch (err: any) {
    logger.error(err, '[GET_SAP_DATABASES_FOR_ROLE_ERROR]:')
    return []
  }
}

//* one lookup for whether the database is still allowed and whether the role has any left
//! isError is a failed lookup, not a lost access, so callers must not clear the session's database on it
export async function getSapDatabaseAccess(dbCode?: string | null, roleCode?: number | null) {
  try {
    const sapDatabases = await findSapDatabasesForRole(roleCode)

    return {
      sapDatabases,
      isAllowed: !!dbCode && sapDatabases.some((sapDb) => sapDb.dbCode === dbCode),
      hasAnySapDatabase: sapDatabases.length > 0,
      isError: false
    }
  } catch (err: any) {
    logger.error(err, '[GET_SAP_DATABASE_ACCESS_ERROR]:')
    return { sapDatabases: [], isAllowed: false, hasAnySapDatabase: false, isError: true }
  }
}

//* raw write on the session row, the only way dbCode gets set or cleared
//* updateMany, so a session deleted meanwhile is a no-op instead of a throw
export async function setSessionDbCode(sessionToken: string, dbCode: string | null) {
  await db.authSession.updateMany({ where: { token: sessionToken }, data: { dbCode } })
}
