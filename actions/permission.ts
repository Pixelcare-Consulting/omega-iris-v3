'use server'

import db from '@/lib/db'
import { Prisma } from '@/prisma/generated/client'
import { action, authenticationMiddleware } from '@/lib/safe-action'
import { logger } from '@/lib/logger'

const COMMON_PERMISSION_ORDER_BY = { name: 'asc' } satisfies Prisma.PermissionOrderByWithRelationInput

export async function getPermissions() {
  try {
    return db.permission.findMany({
      where: { deletedAt: null },
      orderBy: COMMON_PERMISSION_ORDER_BY
    })
  } catch (err: any) {
    logger.error(err, '[GET_PERMISSIONS_ERROR]:')
    return []
  }
}

export const getPermissionsClient = action.use(authenticationMiddleware).action(async () => {
  return getPermissions()
})
