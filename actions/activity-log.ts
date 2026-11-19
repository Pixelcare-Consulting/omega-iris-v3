'use server'

import { z } from 'zod'

import db from '@/lib/db'
import { logger } from '@/lib/logger'
import { action, authenticationMiddleware } from '@/lib/safe-action'
import { canViewActivityModule } from '@/lib/activity-log'
import { ACTIVITY_MODULES, ACTIVITY_TIMELINE_PAGE_SIZE, ActivityModule } from '@/constants/activity-log'
import { Prisma } from '@/prisma/generated/client'
import { DataTableParams, dataTableParamsSchema } from '@/schema/data-table'
import {
  buildColumnFiltersWhere,
  buildGlobalFilterWhere,
  buildOrderBy,
  escapeLikeKeyword,
  getDataTableParams,
  splitGlobalFilterKeywords
} from '@/lib/data-table'
import { PModels } from '@/types/prisma'
import { AppAbility } from '@/lib/rbac'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'

const activityModuleSchema = z.enum(Object.keys(ACTIVITY_MODULES) as [ActivityModule, ...ActivityModule[]])

const activityTimelineSchema = z.object({
  module: activityModuleSchema,
  entityId: z.string().min(1),
  cursor: z.string().nullish(),
  search: z.string().optional(),
  columnFilters: dataTableParamsSchema.shape.columnFilters
})

//* ids of this record's rows whose shown change text holds the keyword
//* only label, from and to are read, so json keys like op or key never match
async function findTimelineIdsByChanges(module: string, entityId: string, keyword: string) {
  const pattern = `%${escapeLikeKeyword(keyword)}%`

  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT T0.id FROM "ActivityLog" T0
    WHERE ((T0.module = ${module} AND T0."entityId" = ${entityId}) OR (T0."parentModule" = ${module} AND T0."parentId" = ${entityId}))
    AND EXISTS (
      SELECT 1 FROM jsonb_path_query(T0.changes, 'strict $.**') AS T1(node)
      WHERE jsonb_typeof(T1.node) = 'object' AND T1.node ? 'label'
      AND (T1.node->>'label' ILIKE ${pattern} OR T1.node->>'from' ILIKE ${pattern} OR T1.node->>'to' ILIKE ${pattern})
    )
  `

  return rows.map((row) => row.id)
}

//! not exported, a 'use server' export is callable from the browser with any access argument
async function getDataTableActivityLogsSvr(params: DataTableParams, access: { ability: AppAbility; dbCode: string | null }) {
  const { perPage, offset, globalFilter, sorting, columnFilters, isExport } = getDataTableParams(params)

  const modelName: keyof PModels = 'ActivityLog'

  //* only modules the user can view, global rows plus the database in use
  const allowedModules = (Object.keys(ACTIVITY_MODULES) as ActivityModule[]).filter((m) => canViewActivityModule(access.ability, m))

  const where: Prisma.ActivityLogWhereInput = {
    AND: [{ module: { in: allowedModules } }, { OR: [{ dbCode: null }, ...(access.dbCode ? [{ dbCode: access.dbCode }] : [])] }]
  }

  //* global filter
  if (globalFilter) {
    const filter = buildGlobalFilterWhere<typeof modelName>(globalFilter, {
      stringFields: ['entityCode', 'entityLabel', 'userName', 'summary']
    })

    where.AND = [...(where.AND as Prisma.ActivityLogWhereInput[]), filter]
  }

  //* column filters
  if (columnFilters.length > 0) {
    const filters = buildColumnFiltersWhere<typeof modelName>(columnFilters, {
      stringFields: ['module', 'action', 'source', 'batchId'],
      dateFields: [{ field: 'createdAt' }]
    })

    where.AND = [...(where.AND as Prisma.ActivityLogWhereInput[]), ...filters]
  }

  const orderBy: Prisma.ActivityLogOrderByWithRelationInput[] = [...buildOrderBy<typeof modelName>(sorting), { id: 'desc' }]

  try {
    const [data, rowCount] = await db.$transaction([
      db.activityLog.findMany({ where, ...(isExport ? {} : { skip: offset, take: perPage }), orderBy }),
      db.activityLog.count({ where })
    ])

    return { data, rowCount }
  } catch (err: any) {
    logger.error(err, '[GET_DATA_TABLE_ACTIVITY_LOGS_ERROR]:')
    return { data: [], rowCount: 0 }
  }
}

export const getDataTableActivityLogsSvrClient = action
  .use(authenticationMiddleware)
  .inputSchema(dataTableParamsSchema)
  .action(async ({ ctx, parsedInput }) => {
    if (!ctx.ability?.can(PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.AUDIT_LOGS)) return { data: [], rowCount: 0 }

    return getDataTableActivityLogsSvr(parsedInput, { ability: ctx.ability, dbCode: ctx.dbCode })
  })

export const getActivityTimelineClient = action
  .use(authenticationMiddleware)
  .inputSchema(activityTimelineSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { module, entityId, cursor, search, columnFilters } = parsedInput
    const empty = { items: [], nextCursor: null }

    if (!canViewActivityModule(ctx.ability, module)) return empty

    const conditions: Prisma.ActivityLogWhereInput[] = [
      {
        OR: [
          { module, entityId },
          { parentModule: module, parentId: entityId }
        ]
      },
      //* global rows always show, sap rows only for the database in use
      { OR: [{ dbCode: null }, ...(ctx.dbCode ? [{ dbCode: ctx.dbCode }] : [])] }
    ]

    try {
      //* every keyword must match the summary, the user or the change text, the same way the table search does
      for (const keyword of splitGlobalFilterKeywords(search ?? '')) {
        const changeIds = await findTimelineIdsByChanges(module, entityId, keyword)
        const likeKeyword = escapeLikeKeyword(keyword)

        conditions.push({
          OR: [
            { summary: { contains: likeKeyword, mode: 'insensitive' } },
            { userName: { contains: likeKeyword, mode: 'insensitive' } },
            { id: { in: changeIds } }
          ]
        })
      }

      if (columnFilters && columnFilters.length > 0) {
        conditions.push(
          ...buildColumnFiltersWhere<'ActivityLog'>(columnFilters, { stringFields: ['action'], dateFields: [{ field: 'createdAt' }] })
        )
      }

      const where: Prisma.ActivityLogWhereInput = { AND: conditions }

      const rows = await db.activityLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: ACTIVITY_TIMELINE_PAGE_SIZE + 1,
        ...(cursor && { cursor: { id: cursor }, skip: 1 })
      })

      const hasMore = rows.length > ACTIVITY_TIMELINE_PAGE_SIZE
      const items = hasMore ? rows.slice(0, ACTIVITY_TIMELINE_PAGE_SIZE) : rows

      return { items, nextCursor: hasMore ? items[items.length - 1].id : null }
    } catch (err: any) {
      logger.error(err, '[GET_ACTIVITY_TIMELINE_ERROR]:')
      return empty
    }
  })
