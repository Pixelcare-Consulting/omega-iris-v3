'use server'

import z from 'zod'

import db from '@/lib/db'
import { logger } from '@/lib/logger'
import { action, authenticationMiddleware } from '@/lib/safe-action'
import { Prisma } from '@/prisma/generated/client'

const COMMON_ROLE_REPORT_INCLUDE = {
  role: { select: { code: true, name: true } },
  report: true
} satisfies Prisma.RoleReportInclude

const COMMON_ROLE_REPORT_ORDER_BY = { report: { code: 'asc' } } satisfies Prisma.RoleReportOrderByWithRelationInput

export async function getRoleReportsByRoleCode(roleCode?: number | null) {
  if (!roleCode) return []

  try {
    return db.roleReport.findMany({
      where: { roleCode },
      include: COMMON_ROLE_REPORT_INCLUDE,
      orderBy: COMMON_ROLE_REPORT_ORDER_BY
    })
  } catch (err: any) {
    logger.error(err, '[GET_ROLE_REPORTS_BY_ROLE_CODE_ERROR]:')
    return []
  }
}

export const getRoleReportsClient = action
  .use(authenticationMiddleware)
  .inputSchema(z.object({ roleCode: z.coerce.number().nullish() }))
  .action(async ({ parsedInput }) => {
    return getRoleReportsByRoleCode(parsedInput.roleCode)
  })
