'use server'

import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { action, authenticationMiddleware } from '@/lib/safe-action'
import { getActiveSapDatabases, getSapDatabaseAccess, getSapDatabasesForRole, setSessionDbCode } from '@/lib/sap/access'
import { getSapSession } from '@/lib/sap/session'
import { chooseSapDatabaseFormSchema } from '@/schema/sap-database'
import { PERMISSIONS_CODES } from '@/constants/permission'

//* databases a role may use, super user always gets all of them
export async function getSapDatabasesByRoleCode(roleCode?: number | null) {
  return getSapDatabasesForRole(roleCode)
}

export const getSapDatabasesClient = action.use(authenticationMiddleware).action(async ({ ctx }) => {
  return getSapDatabasesByRoleCode(ctx.roleCode)
})

//* the role form's full list, only for users who can save a role
export const getActiveSapDatabasesClient = action.use(authenticationMiddleware).action(async ({ ctx }) => {
  const { ability } = ctx
  const canEditRole = !!ability && (ability.can('create', PERMISSIONS_CODES.ROLES) || ability.can('edit', PERMISSIONS_CODES.ROLES))

  if (!canEditRole) return []

  return getActiveSapDatabases()
})

//* opens or reuses the shared session for a database, so an unreachable one is caught before it is chosen
export const verifySapDatabaseConnectionClient = action
  .use(authenticationMiddleware)
  .inputSchema(chooseSapDatabaseFormSchema)
  .action(async ({ ctx, parsedInput: { dbCode } }) => {
    const actionTag = 'VERIFY_SAP_DATABASE_CONNECTION'

    try {
      const { isAllowed, isError } = await getSapDatabaseAccess(dbCode, ctx.roleCode)

      if (isError)
        return { error: true, status: 503, message: 'Could not check your database access. Please try again.', action: actionTag }
      if (!isAllowed) return { error: true, status: 403, message: 'You have no access to this database.', action: actionTag }

      const sapSession = await getSapSession(dbCode)

      if (!sapSession.ok) return { error: true, status: 502, message: sapSession.message, action: actionTag }

      return { error: false, status: 200, message: 'SAP connection successful', action: actionTag }
    } catch (err: any) {
      logger.error(err, '[VERIFY_SAP_DATABASE_CONNECTION_ERROR]:')
      return { error: true, status: 500, message: 'Could not connect to SAP with this database.', action: actionTag }
    }
  })

//* the only writer of the session's dbCode
export const selectSapDatabaseClient = action
  .use(authenticationMiddleware)
  .inputSchema(chooseSapDatabaseFormSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { dbCode } = parsedInput
    const actionTag = 'SELECT_SAP_DATABASE'

    try {
      const { isAllowed, isError } = await getSapDatabaseAccess(dbCode, ctx.roleCode)

      if (isError)
        return { error: true, status: 503, message: 'Could not check your database access. Please try again.', action: actionTag }
      if (!isAllowed) return { error: true, status: 403, message: 'You have no access to this database.', action: actionTag }

      //* check sap first, a database that cannot be reached must not become the session's database
      const sapSession = await getSapSession(dbCode)

      if (!sapSession.ok) return { error: true, status: 502, message: sapSession.message, action: actionTag }

      await setSessionDbCode(ctx.sessionToken, dbCode)

      //! refresh the cookie cache, otherwise the proxy reads the old dbCode for up to 5 minutes
      const refreshed = await auth.api.getSession({ headers: await headers(), query: { disableCookieCache: true } })

      //* the session ended while we were checking sap
      if (!refreshed) return { error: true, status: 401, message: 'Your session has expired. Please sign in again.', action: actionTag }

      //* read it back, the database may have been turned off or unassigned while we were checking sap
      const recheck = await getSapDatabaseAccess(refreshed.session.dbCode, ctx.roleCode)

      if (recheck.isError || refreshed.session.dbCode !== dbCode || !recheck.isAllowed) {
        await setSessionDbCode(ctx.sessionToken, null)

        //* refresh the cookie again, it still holds the database we just cleared
        await auth.api.getSession({ headers: await headers(), query: { disableCookieCache: true } })

        if (recheck.isError) {
          return { error: true, status: 503, message: 'Could not check your database access. Please try again.', action: actionTag }
        }

        return { error: true, status: 409, message: 'That database is no longer available. Please choose another one.', action: actionTag }
      }

      return { error: false, status: 200, message: 'Database selected successfully!', action: actionTag, data: { dbCode } }
    } catch (err: any) {
      logger.error(err, '[SELECT_SAP_DATABASE_ERROR]:')
      return { error: true, status: 500, message: 'Something went wrong! Please try again later.', action: actionTag }
    }
  })
