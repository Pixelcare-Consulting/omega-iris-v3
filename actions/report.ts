'use server'

import { Prisma } from '@/prisma/generated/client'

import db from '@/lib/db'
import { logger } from '@/lib/logger'
import { action, authenticationMiddleware } from '@/lib/safe-action'

const COMMON_REPORT_ORDER_BY = { code: 'asc' } satisfies Prisma.ReportOrderByWithRelationInput

export async function getReports() {
  try {
    return db.report.findMany({ where: { deletedAt: null }, orderBy: COMMON_REPORT_ORDER_BY })
  } catch (err: any) {
    logger.error(err, '[GET_REPORTS_ERROR]:')
    return []
  }
}

export const getReportsClient = action.use(authenticationMiddleware).action(async () => {
  return getReports()
})
