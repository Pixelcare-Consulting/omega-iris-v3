'use server'

import { action, authenticationMiddleware, tenantMiddleware } from '@/lib/safe-action'

import db from '@/lib/db'
import { Prisma, Site } from '@/prisma/generated/client'
import { buildColumnFiltersWhere, buildGlobalFilterWhere, buildOrderBy, getDataTableParams } from '@/lib/data-table'
import { logger } from '@/lib/logger'
import { nextSequence } from '@/lib/sequence'
import { INBOUND_SEQUENCE, SESSION_SEQUENCE } from '@/lib/session-sequence'
import { PACKAGING_UNIT_ACTIVITY_CONFIG } from '@/lib/activity-configs/packaging-unit'
import { createId } from '@paralleldrive/cuid2'
import { lockSession, SessionConflictError } from '@/lib/session-lock'
import { diffActivity, logActivities, logActivity } from '@/lib/activity-log'
import { SESSION_ACTIVITY_CONFIG } from '@/lib/activity-configs/session'
import { INBOUND_ACTIVITY_CONFIG, INBOUND_ACTIVITY_INCLUDE } from '@/lib/activity-configs/inbound'
import { cancelSessionFormSchema, sessionCodeSchema, startSessionFormSchema } from '@/schema/session'
import { dataTableParamsSchema, DataTableParams } from '@/schema/data-table'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { BUILT_SESSION_TYPES, OPEN_SESSION_STATUSES, SITE_SWITCH_BY_SESSION_TYPE, SiteSwitch } from '@/constants/session'
import { FilterOption } from '@/types/data-table'
import { PModels } from '@/types/prisma'

const COMMON_SESSION_INCLUDE = {
  site: { select: { code: true, name: true } },
  user: { select: { code: true, name: true } },
  pauses: { orderBy: { pausedAt: 'asc' } },
  _count: { select: { inbounds: true } }
} satisfies Prisma.SessionInclude

export type SessionWithInclude = Prisma.SessionGetPayload<{ include: typeof COMMON_SESSION_INCLUDE }>

//* the bar also needs the drafts, to open one or name them on cancel
const OPEN_SESSION_INCLUDE = {
  ...COMMON_SESSION_INCLUDE,
  inbounds: { where: { status: 'DRAFT' }, select: { code: true }, orderBy: { createdAt: 'asc' } }
} satisfies Prisma.SessionInclude

export type OpenSession = Prisma.SessionGetPayload<{ include: typeof OPEN_SESSION_INCLUDE }>

export type SessionSiteOption = Pick<Site, 'code' | 'name' | SiteSwitch>

type DataTableScope = { userCode: number; canViewAll: boolean }

export async function getSessionByCode(dbCode: string | null, code: string) {
  if (!dbCode) return null

  try {
    return await db.session.findFirst({ where: { dbCode, code, deletedAt: null }, include: COMMON_SESSION_INCLUDE })
  } catch (err) {
    logger.error(err, '[GET_SESSION_BY_CODE_ERROR]:')
    return null
  }
}

//* the session the user still holds, in progress or paused
export async function getOpenSession(dbCode: string | null, userCode: number | null) {
  if (!dbCode || !userCode) return null

  try {
    return await db.session.findFirst({
      where: { dbCode, userCode, status: { in: [...OPEN_SESSION_STATUSES] }, deletedAt: null },
      include: OPEN_SESSION_INCLUDE
    })
  } catch (err) {
    logger.error(err, '[GET_OPEN_SESSION_ERROR]:')
    return null
  }
}

//* active sites with their process switches, for the start modal
export async function getSessionSiteOptions(dbCode: string | null): Promise<SessionSiteOption[]> {
  if (!dbCode) return []

  try {
    return await db.site.findMany({
      where: { dbCode, isActive: true, deletedAt: null },
      select: {
        code: true,
        name: true,
        isEnableInbound: true,
        isEnableOutbound: true,
        isEnableMovement: true,
        isEnableCycleCount: true,
        isEnableQcTesting: true,
        isEnableRma: true
      },
      orderBy: { name: 'asc' }
    })
  } catch (err) {
    logger.error(err, '[GET_SESSION_SITE_OPTIONS_ERROR]:')
    return []
  }
}

//* list filters only, inactive rows included
export async function getSessionFilterOptions(
  dbCode: string | null
): Promise<{ siteOptions: FilterOption[]; userOptions: FilterOption[] }> {
  if (!dbCode) return { siteOptions: [], userOptions: [] }

  try {
    const [sites, users] = await Promise.all([
      db.site.findMany({ where: { dbCode }, select: { code: true, name: true }, orderBy: { name: 'asc' } }),
      db.user.findMany({ where: { sessions: { some: { dbCode } } }, select: { name: true }, orderBy: { name: 'asc' } })
    ])

    return {
      siteOptions: sites.map((site) => ({ label: site.name, value: site.code })),
      userOptions: users.map((user) => ({ label: user.name, value: user.name }))
    }
  } catch (err) {
    logger.error(err, '[GET_SESSION_FILTER_OPTIONS_ERROR]:')
    return { siteOptions: [], userOptions: [] }
  }
}

export async function getDataTableSessionsSvr(dbCode: string, params: DataTableParams, scope: DataTableScope) {
  const { perPage, offset, globalFilter, sorting, columnFilters, isExport } = getDataTableParams(params)

  const modelName: keyof PModels = 'Session'

  //* initialize where input, without view all a user sees only their own
  const where: Prisma.SessionWhereInput = { dbCode, deletedAt: null, ...(scope.canViewAll ? {} : { userCode: scope.userCode }) }

  //* global filter
  if (globalFilter) {
    const filter = buildGlobalFilterWhere<typeof modelName>(globalFilter, {
      stringFields: ['code', 'employeeId', 'siteCode', 'cancelReason'],
      relationFields: [
        { relation: 'user', fields: ['name'] },
        { relation: 'site', fields: ['name'] }
      ]
    })

    Object.assign(where, filter)
  }

  //* column filters
  if (columnFilters.length > 0) {
    const currentFilters = where.AND as Prisma.SessionWhereInput[]

    const filters = buildColumnFiltersWhere<typeof modelName>(columnFilters, {
      stringFields: ['type', 'status', 'siteCode'],
      dateFields: [{ field: 'startedAt' }],
      relationFields: [{ id: 'userName', relation: 'user', field: 'name' }]
    })

    where.AND = [...(currentFilters ?? []), ...filters]
  }

  //* newest first unless the table sorts
  const orderBy: Prisma.SessionOrderByWithRelationInput[] =
    sorting.length > 0 ? buildOrderBy<typeof modelName>(sorting) : [{ startedAt: 'desc' }]

  try {
    const [data, rowCount] = await db.$transaction([
      db.session.findMany({ where, include: COMMON_SESSION_INCLUDE, ...(isExport ? {} : { skip: offset, take: perPage }), orderBy }),
      db.session.count({ where })
    ])

    return { data, rowCount }
  } catch (err) {
    logger.error(err, '[GET_DATA_TABLE_SESSIONS_ERROR]:')
    return { data: [], rowCount: 0 }
  }
}

export const getDataTableSessionsSvrClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(dataTableParamsSchema)
  .action(async ({ ctx, parsedInput }) => {
    if (!ctx.ability?.can(PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.SESSIONS)) return { data: [], rowCount: 0 }

    const canViewAll = ctx.ability.can(PERMISSIONS_ALLOWED_ACTIONS.VIEW_ALL, PERMISSIONS_CODES.SESSIONS)

    return getDataTableSessionsSvr(ctx.dbCode, parsedInput, { userCode: ctx.userCode, canViewAll })
  })

export const startSession = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(startSessionFormSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { siteCode, type } = parsedInput
    const { dbCode, userCode } = ctx
    const actionTag = 'START_SESSION'

    if (!ctx.ability?.can(PERMISSIONS_ALLOWED_ACTIONS.CREATE, PERMISSIONS_CODES.SESSIONS)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    if (!BUILT_SESSION_TYPES.includes(type)) {
      return { status: 400, error: true, message: 'This process is not available yet!', action: actionTag }
    }

    try {
      const [site, user] = await Promise.all([
        db.site.findFirst({ where: { dbCode, code: siteCode, isActive: true, deletedAt: null } }),
        db.user.findUnique({ where: { code: userCode }, select: { employeeId: true } })
      ])

      if (!site) return { status: 404, error: true, message: 'Site not found!', action: actionTag }

      if (!site[SITE_SWITCH_BY_SESSION_TYPE[type]]) {
        return { status: 409, error: true, message: 'This process is turned off at this site!', action: actionTag }
      }

      //* the session and an inbound's first draft come in one transaction
      const result = await db.$transaction(async (tx) => {
        //! one open session per user, prisma can't hold that as an index, so the user row is locked until the create lands
        await tx.$queryRaw`SELECT 1 FROM "User" WHERE "code" = ${userCode} FOR UPDATE`

        const openSession = await tx.session.findFirst({
          where: { dbCode, userCode, status: { in: [...OPEN_SESSION_STATUSES] }, deletedAt: null },
          select: { code: true }
        })

        if (openSession) return { openSessionCode: openSession.code }

        const session = await tx.session.create({
          data: {
            dbCode,
            code: await nextSequence(tx, SESSION_SEQUENCE, { dbCode }),
            type,
            siteCode,
            userCode,
            employeeId: user?.employeeId ?? null,
            createdBy: userCode,
            updatedBy: userCode
          }
        })

        await logActivity(tx, {
          actor: ctx.actor,
          module: 'SESSIONS',
          action: 'CREATE',
          dbCode,
          entity: { id: session.id, code: session.code },
          changes: diffActivity(SESSION_ACTIVITY_CONFIG, null, session)
        })

        if (type !== 'INBOUND') return { session, inboundCode: null }

        const inbound = await tx.inbound.create({
          data: {
            dbCode,
            code: await nextSequence(tx, INBOUND_SEQUENCE, { dbCode }),
            sessionCode: session.code,
            createdBy: userCode,
            updatedBy: userCode
          }
        })

        await logActivity(tx, {
          actor: ctx.actor,
          module: 'INBOUNDS',
          action: 'CREATE',
          dbCode,
          entity: { id: inbound.id, code: inbound.code }
        })

        return { session, inboundCode: inbound.code }
      })

      if (!result.session) {
        return { status: 409, error: true, message: `You already have an open session, ${result.openSessionCode}!`, action: actionTag }
      }

      return {
        status: 200,
        error: false,
        message: `Session ${result.session.code} started!`,
        action: actionTag,
        data: { sessionCode: result.session.code, inboundCode: result.inboundCode }
      }
    } catch (err) {
      logger.error(err, '[START_SESSION_ERROR]:')
      return { status: 500, error: true, message: 'Something went wrong! Please try again later.', action: actionTag }
    }
  })

//* the open session the caller may change, its own or any with edit
async function findOwnSession(dbCode: string, sessionCode: string, userCode: number, canEditAny: boolean) {
  const session = await db.session.findFirst({ where: { dbCode, code: sessionCode, deletedAt: null } })

  if (!session) return { error: { status: 404, message: 'Session not found!' } }
  if (session.userCode !== userCode && !canEditAny) return { error: { status: 403, message: 'You are not allowed to do this!' } }

  return { session }
}

export const pauseSession = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(sessionCodeSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { dbCode, userCode } = ctx
    const actionTag = 'PAUSE_SESSION'

    try {
      const canEditAny = !!ctx.ability?.can(PERMISSIONS_ALLOWED_ACTIONS.EDIT, PERMISSIONS_CODES.SESSIONS)
      const { session, error } = await findOwnSession(dbCode, parsedInput.sessionCode, userCode, canEditAny)

      if (error) return { ...error, error: true, action: actionTag }
      if (session.status !== 'IN_PROGRESS')
        return { status: 409, error: true, message: 'Only a session in progress can pause!', action: actionTag }

      await db.$transaction(async (tx) => {
        //* a second click waits here, then sees it already paused
        const current = await lockSession(tx, dbCode, session.code)

        if (current.status !== 'IN_PROGRESS') throw new SessionConflictError('Only a session in progress can pause!')

        await tx.sessionPause.create({ data: { dbCode, sessionCode: session.code } })

        const result = await tx.session.update({ where: { id: session.id }, data: { status: 'PAUSED', updatedBy: userCode } })

        await logActivity(tx, {
          actor: ctx.actor,
          module: 'SESSIONS',
          action: 'UPDATE',
          dbCode,
          entity: { id: result.id, code: result.code },
          changes: diffActivity(SESSION_ACTIVITY_CONFIG, current, result)
        })
      })

      return { status: 200, error: false, message: 'Session paused!', action: actionTag }
    } catch (err) {
      if (err instanceof SessionConflictError) return { status: err.status, error: true, message: err.message, action: actionTag }
      logger.error(err, '[PAUSE_SESSION_ERROR]:')
      return { status: 500, error: true, message: 'Something went wrong! Please try again later.', action: actionTag }
    }
  })

export const resumeSession = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(sessionCodeSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { dbCode, userCode } = ctx
    const actionTag = 'RESUME_SESSION'

    try {
      const canEditAny = !!ctx.ability?.can(PERMISSIONS_ALLOWED_ACTIONS.EDIT, PERMISSIONS_CODES.SESSIONS)
      const { session, error } = await findOwnSession(dbCode, parsedInput.sessionCode, userCode, canEditAny)

      if (error) return { ...error, error: true, action: actionTag }
      if (session.status !== 'PAUSED') return { status: 409, error: true, message: 'Session is not paused!', action: actionTag }

      await db.$transaction(async (tx) => {
        const current = await lockSession(tx, dbCode, session.code)

        if (current.status !== 'PAUSED') throw new SessionConflictError('Session is not paused!')

        await tx.sessionPause.updateMany({ where: { dbCode, sessionCode: session.code, resumedAt: null }, data: { resumedAt: new Date() } })

        const result = await tx.session.update({ where: { id: session.id }, data: { status: 'IN_PROGRESS', updatedBy: userCode } })

        await logActivity(tx, {
          actor: ctx.actor,
          module: 'SESSIONS',
          action: 'UPDATE',
          dbCode,
          entity: { id: result.id, code: result.code },
          changes: diffActivity(SESSION_ACTIVITY_CONFIG, current, result)
        })
      })

      return { status: 200, error: false, message: 'Session resumed!', action: actionTag }
    } catch (err) {
      if (err instanceof SessionConflictError) return { status: err.status, error: true, message: err.message, action: actionTag }
      logger.error(err, '[RESUME_SESSION_ERROR]:')
      return { status: 500, error: true, message: 'Something went wrong! Please try again later.', action: actionTag }
    }
  })

export const completeSession = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(sessionCodeSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { dbCode, userCode } = ctx
    const actionTag = 'COMPLETE_SESSION'

    try {
      const canEditAny = !!ctx.ability?.can(PERMISSIONS_ALLOWED_ACTIONS.EDIT, PERMISSIONS_CODES.SESSIONS)
      const { session, error } = await findOwnSession(dbCode, parsedInput.sessionCode, userCode, canEditAny)

      if (error) return { ...error, error: true, action: actionTag }

      if (!(OPEN_SESSION_STATUSES as readonly string[]).includes(session.status)) {
        return { status: 409, error: true, message: 'Session is already closed!', action: actionTag }
      }

      //* unique ids were made on each submit, this only closes the session
      await db.$transaction(async (tx) => {
        const current = await lockSession(tx, dbCode, session.code)

        if (!(OPEN_SESSION_STATUSES as readonly string[]).includes(current.status))
          throw new SessionConflictError('Session is already closed!')

        //* checked under the lock, so no draft can start while it completes
        const drafts = await tx.inbound.findMany({
          where: { dbCode, sessionCode: session.code, status: 'DRAFT' },
          select: { code: true }
        })

        if (drafts.length > 0) {
          const codes = drafts.map((row) => row.code).join(', ')
          throw new SessionConflictError(`Submit or delete ${codes} before completing the session!`)
        }

        const now = new Date()

        await tx.sessionPause.updateMany({ where: { dbCode, sessionCode: session.code, resumedAt: null }, data: { resumedAt: now } })

        const result = await tx.session.update({
          where: { id: session.id },
          data: { status: 'COMPLETED', endedAt: now, updatedBy: userCode }
        })

        await logActivity(tx, {
          actor: ctx.actor,
          module: 'SESSIONS',
          action: 'UPDATE',
          dbCode,
          entity: { id: result.id, code: result.code },
          changes: diffActivity(SESSION_ACTIVITY_CONFIG, current, result)
        })
      })

      return { status: 200, error: false, message: `Session ${session.code} completed!`, action: actionTag }
    } catch (err) {
      if (err instanceof SessionConflictError) return { status: err.status, error: true, message: err.message, action: actionTag }
      logger.error(err, '[COMPLETE_SESSION_ERROR]:')
      return { status: 500, error: true, message: 'Something went wrong! Please try again later.', action: actionTag }
    }
  })

export const cancelSession = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(cancelSessionFormSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { sessionCode, reason } = parsedInput
    const { dbCode, userCode } = ctx
    const actionTag = 'CANCEL_SESSION'

    try {
      const canEditAny = !!ctx.ability?.can(PERMISSIONS_ALLOWED_ACTIONS.EDIT, PERMISSIONS_CODES.SESSIONS)
      const { session, error } = await findOwnSession(dbCode, sessionCode, userCode, canEditAny)

      if (error) return { ...error, error: true, action: actionTag }

      if (!(OPEN_SESSION_STATUSES as readonly string[]).includes(session.status)) {
        return { status: 409, error: true, message: 'Session is already closed!', action: actionTag }
      }

      //* drafts and submitted inbounds go with it, their unique ids are soft deleted
      await db.$transaction(
        async (tx) => {
          const current = await lockSession(tx, dbCode, session.code)

          if (!(OPEN_SESSION_STATUSES as readonly string[]).includes(current.status))
            throw new SessionConflictError('Session is already closed!')

          const now = new Date()

          await tx.sessionPause.updateMany({ where: { dbCode, sessionCode: session.code, resumedAt: null }, data: { resumedAt: now } })

          const result = await tx.session.update({
            where: { id: session.id },
            data: { status: 'CANCELLED', endedAt: now, cancelReason: reason, updatedBy: userCode }
          })

          const inbounds = await tx.inbound.findMany({
            where: { dbCode, sessionCode: session.code, status: { in: ['DRAFT', 'SUBMITTED'] } },
            include: INBOUND_ACTIVITY_INCLUDE
          })

          await tx.inbound.updateMany({
            where: { id: { in: inbounds.map((row) => row.id) } },
            data: { status: 'CANCELLED', cancelReason: reason, updatedBy: userCode }
          })

          //? units changed after submit go too, revisit later
          //* split children share the inbound item, so they are caught here
          const units = await tx.packagingUnit.findMany({
            where: { dbCode, deletedAt: null, inboundItem: { inboundCode: { in: inbounds.map((row) => row.code) } } }
          })

          await tx.packagingUnit.updateMany({
            where: { id: { in: units.map((unit) => unit.id) } },
            data: { deletedAt: now, deletedBy: userCode }
          })

          await logActivity(tx, {
            actor: ctx.actor,
            module: 'SESSIONS',
            action: 'UPDATE',
            dbCode,
            entity: { id: result.id, code: result.code },
            changes: diffActivity(SESSION_ACTIVITY_CONFIG, current, result)
          })

          //* one row per cancelled inbound, so its own activity tab shows it
          await logActivities(
            tx,
            inbounds.map((inbound) => ({
              actor: ctx.actor,
              module: 'INBOUNDS',
              action: 'UPDATE',
              dbCode,
              entity: { id: inbound.id, code: inbound.code },
              changes: diffActivity(INBOUND_ACTIVITY_CONFIG, inbound, { ...inbound, status: 'CANCELLED', cancelReason: reason })
            }))
          )

          if (units.length > 0) {
            const batchId = createId()
            const summary = `Deleted by cancelling session ${session.code}`

            //* one row per unit, then one summary for the session
            await logActivities(tx, [
              ...units.map((unit) => ({
                actor: ctx.actor,
                module: 'PACKAGING_UNITS' as const,
                action: 'DELETE' as const,
                dbCode,
                batchId,
                summary,
                entity: { id: unit.id, code: unit.code },
                changes: diffActivity(PACKAGING_UNIT_ACTIVITY_CONFIG, unit, null)
              })),
              {
                actor: ctx.actor,
                module: 'PACKAGING_UNITS' as const,
                action: 'BULK_DELETE' as const,
                dbCode,
                batchId,
                summary,
                changes: { fields: [], meta: { deleted: units.length } }
              }
            ])
          }
        },
        { timeout: 30000 }
      )

      return { status: 200, error: false, message: `Session ${session.code} cancelled!`, action: actionTag }
    } catch (err) {
      if (err instanceof SessionConflictError) return { status: err.status, error: true, message: err.message, action: actionTag }
      logger.error(err, '[CANCEL_SESSION_ERROR]:')
      return { status: 500, error: true, message: 'Something went wrong! Please try again later.', action: actionTag }
    }
  })
