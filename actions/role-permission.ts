'use server'

import z from 'zod'

import db from '@/lib/db'
import { action, authenticationMiddleware } from '@/lib/safe-action'
import { logger } from '@/lib/logger'

export async function getRolePermissions(roleCode: number) {
  if (!roleCode) return []

  try {
    return db.rolePermission.findMany({ where: { roleCode } })
  } catch (err: any) {
    logger.error(err, '[GET_ROLE_PERMISSIONS_ERROR]:')
    return []
  }
}

export const getRolePermissionsClient = action
  .use(authenticationMiddleware)
  .inputSchema(z.object({ roleCode: z.number() }))
  .action(async ({ parsedInput }) => {
    return getRolePermissions(parsedInput.roleCode)
  })
