'use server'

import { action, authenticationMiddleware, tenantMiddleware } from '@/lib/safe-action'

import db from '@/lib/db'
import { Prisma } from '@/prisma/generated/client'
import { logger } from '@/lib/logger'
import { buildColumnFiltersWhere, buildGlobalFilterWhere, buildOrderBy, getDataTableParams } from '@/lib/data-table'
import { getOverReceivedParts, getShortParts, getSuggestedTotalStock, isPartOnPo } from '@/lib/inbound'
import { nextSequence, reserveSequence } from '@/lib/sequence'
import { INBOUND_SEQUENCE } from '@/lib/session-sequence'
import { PACKAGING_UNIT_SEQUENCE } from '@/lib/packaging-unit-sequence'
import { formatPackagingUnitCode } from '@/lib/packaging-unit'
import { createId } from '@paralleldrive/cuid2'
import { lockSession, SessionConflictError, toClosedSessionMessage } from '@/lib/session-lock'
import type { AppAbility } from '@/lib/rbac'
import { diffActivity, logActivities, logActivity } from '@/lib/activity-log'
import { INBOUND_ACTIVITY_CONFIG, INBOUND_ACTIVITY_INCLUDE } from '@/lib/activity-configs/inbound'
import { PACKAGING_UNIT_ACTIVITY_CONFIG } from '@/lib/activity-configs/packaging-unit'
import type { ActivityActor } from '@/types/activity-log'
import { sapFetch } from '@/lib/sap/service-layer'
import { sapString } from '@/lib/sap/endpoints'
import {
  createInboundDraftSchema,
  inboundCodeSchema,
  inboundItemFormSchema,
  inboundItemImportSchema,
  inboundItemKeySchema,
  inboundItemMasterTableParamsSchema,
  inboundSubmitSchema,
  purchaseOrderQuerySchema,
  saveInboundDraftSchema,
  InboundItemForm,
  InboundItemMasterTableParams
} from '@/schema/inbound'
import { DataTableParams, dataTableParamsSchema } from '@/schema/data-table'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { SAP_CLOSED_LINE_STATUS, SAP_OPEN_DOCUMENT_STATUS } from '@/constants/inbound'
import { IMPORT_GENERIC_ERROR_ENTRY, INBOUND_ITEM_IMPORT_COLUMNS } from '@/constants/import'
import { PModels } from '@/types/prisma'
import type { BatchError, BatchStepResult } from '@/types/batch'
import type { CodeName } from '@/types/common'
import type { FilterOption } from '@/types/data-table'
import type { SapPurchaseOrder } from '@/types/sap'

const COMMON_INBOUND_INCLUDE = {
  session: {
    select: {
      code: true,
      status: true,
      siteCode: true,
      userCode: true,
      site: { select: { code: true, name: true } },
      user: { select: { code: true, name: true } }
    }
  },
  location: { select: { code: true, name: true, isActive: true, deletedAt: true } },
  customerProject: {
    select: {
      code: true,
      name: true,
      isActive: true,
      deletedAt: true,
      category: { select: { code: true, name: true, isPoRequired: true, isMandatoryQc: true } }
    }
  },
  items: {
    include: {
      itemMaster: { select: { ItemCode: true, ItemName: true, FirmName: true } },
      commodity: { select: { code: true, name: true } },
      packagingType: { select: { code: true, name: true } }
    },
    orderBy: { lineNum: 'asc' }
  }
} satisfies Prisma.InboundInclude

type InboundPayload = Prisma.InboundGetPayload<{ include: typeof COMMON_INBOUND_INCLUDE }>

//* decimals become numbers, a client component can't take a Decimal
export type InboundItemWithInclude = Omit<InboundPayload['items'][number], 'cost' | 'totalStock'> & {
  cost: number | null
  totalStock: number
}

export type InboundWithInclude = Omit<InboundPayload, 'items'> & { items: InboundItemWithInclude[] }

export type InboundCategory = NonNullable<InboundPayload['customerProject']>['category']

const INBOUND_LIST_INCLUDE = {
  session: {
    select: {
      code: true,
      userCode: true,
      site: { select: { code: true, name: true } },
      user: { select: { code: true, name: true } }
    }
  },
  location: { select: { code: true, name: true } },
  customerProject: { select: { code: true, name: true } }
} satisfies Prisma.InboundInclude

//* the package count and total come from a group by, a client component can't take a Decimal
export type InboundListRow = Prisma.InboundGetPayload<{ include: typeof INBOUND_LIST_INCLUDE }> & {
  packageCount: number
  totalStock: number
}

type InboundScope = { userCode: number; canViewAll: boolean }

//* a po as the form shows it, names from the sap lookups, manufacturer from the item master
export type InboundPurchaseOrderLine = {
  LineNum: number
  ItemCode: string
  ItemDescription: string
  ManufacturerName: string | null
  Quantity: number
  OpenQuantity: number
  Price: number
}

export type InboundPurchaseOrder = SapPurchaseOrder & { DocumentLines: InboundPurchaseOrderLine[] }

//* one row of the mfg p/n picker
export type InboundItemMasterRow = { ItemCode: string; ItemName: string | null; FirmName: string | null; isOnPo: boolean }

export type InboundOption = CodeName & { label: string; value: string }

export type InboundProjectOption = InboundOption & { category: InboundCategory }

export type InboundReferenceOptions = { commodityOptions: InboundOption[]; packagingTypeOptions: InboundOption[] }

type FieldError = { field: string; message: string }

const toOption = <T extends CodeName>(row: T) => ({ ...row, label: `${row.code} · ${row.name}`, value: row.code })

const PO_HEADER_FIELDS = 'DocEntry,DocNum,CardCode,CardName,DocDate,DocDueDate,DocumentStatus'
const PO_LINE_FIELDS = 'LineNum,ItemCode,ItemDescription,Quantity,RemainingOpenQuantity,Price,LineStatus'

function toInboundView(inbound: InboundPayload): InboundWithInclude {
  return {
    ...inbound,
    items: inbound.items.map((item) => ({
      ...item,
      cost: item.cost?.toNumber() ?? null,
      totalStock: item.totalStock.toNumber()
    }))
  }
}

//* an open po by the number sap users see, null when sap has no such open po
export async function getPurchaseOrderByNum(dbCode: string, poNum: string): Promise<InboundPurchaseOrder | null> {
  if (!/^\d+$/.test(poNum)) return null

  //* one call for the header and only the line fields used, a plain read sends every line field
  const result = await sapFetch(dbCode, 'purchaseOrders.lines', {
    query: {
      $expand: `PurchaseOrders($select=${PO_HEADER_FIELDS}),PurchaseOrders/DocumentLines($select=${PO_LINE_FIELDS})`,
      $filter: `PurchaseOrders/DocEntry eq PurchaseOrders/DocumentLines/DocEntry and PurchaseOrders/DocNum eq ${poNum} and PurchaseOrders/DocumentStatus eq ${sapString(SAP_OPEN_DOCUMENT_STATUS)}` // prettier-ignore
    }
  })

  if (!result.ok) throw new Error(result.message)

  const rows = result.data.value

  if (rows.length === 0) return null

  //* closed lines can't be received, so they never need a package
  const lines = rows
    .map((row) => row['PurchaseOrders/DocumentLines'])
    .filter((line) => line.LineStatus !== SAP_CLOSED_LINE_STATUS)
    .sort((a, b) => a.LineNum - b.LineNum)

  const itemMasters = await db.itemMaster.findMany({
    where: { dbCode, ItemCode: { in: lines.map((line) => line.ItemCode) } },
    select: { ItemCode: true, FirmName: true }
  })

  const manufacturerNames = new Map(itemMasters.map((row) => [row.ItemCode, row.FirmName]))

  return {
    ...rows[0].PurchaseOrders,
    DocumentLines: lines.map((line) => ({
      LineNum: line.LineNum,
      ItemCode: line.ItemCode,
      ItemDescription: line.ItemDescription,
      ManufacturerName: manufacturerNames.get(line.ItemCode) ?? null,
      Quantity: line.Quantity,
      OpenQuantity: line.RemainingOpenQuantity,
      Price: line.Price
    }))
  }
}

type InboundEditor = { userCode: number; ability: AppAbility | null }

//* the session owner, or anyone who may edit other sessions
const canEditSession = (session: { userCode: number }, editor: InboundEditor) =>
  session.userCode === editor.userCode || !!editor.ability?.can(PERMISSIONS_ALLOWED_ACTIONS.EDIT, PERMISSIONS_CODES.SESSIONS)

//* a draft whose session is still running, or the envelope that says why not
async function findEditableInbound(dbCode: string, inboundCode: string, editor: InboundEditor) {
  const inbound = await db.inbound.findFirst({
    where: { dbCode, code: inboundCode },
    include: { ...INBOUND_ACTIVITY_INCLUDE, session: true, projectCategory: true }
  })

  if (!inbound) return { error: { status: 404, message: 'Inbound not found!' } }
  if (!canEditSession(inbound.session, editor)) return { error: { status: 403, message: 'You are not allowed to do this!' } }
  if (inbound.status !== 'DRAFT') return { error: { status: 409, message: 'Only a draft inbound can change!' } }
  if (inbound.session.status !== 'IN_PROGRESS') return { error: { status: 409, message: toClosedSessionMessage(inbound.session.status) } }

  return { inbound }
}

//* the same checks again under the session lock, returns the draft as it is now
async function lockEditableInbound(tx: Prisma.TransactionClient, inbound: { id: string; dbCode: string; sessionCode: string }) {
  const session = await lockSession(tx, inbound.dbCode, inbound.sessionCode)

  if (session.status !== 'IN_PROGRESS') throw new SessionConflictError(toClosedSessionMessage(session.status))

  const current = await tx.inbound.findUniqueOrThrow({ where: { id: inbound.id }, include: INBOUND_ACTIVITY_INCLUDE })

  if (current.status !== 'DRAFT') throw new SessionConflictError('Only a draft inbound can change!')

  return current
}

export async function getInboundByCode(dbCode: string | null, code: string): Promise<InboundWithInclude | null> {
  if (!dbCode) return null

  try {
    const inbound = await db.inbound.findFirst({ where: { dbCode, code }, include: COMMON_INBOUND_INCLUDE })
    return inbound ? toInboundView(inbound) : null
  } catch (err) {
    logger.error(err, '[GET_INBOUND_BY_CODE_ERROR]:')
    return null
  }
}

//* the view page read, null when missing or from someone else's session without view all
export async function getInboundForView(dbCode: string | null, code: string, scope: InboundScope): Promise<InboundWithInclude | null> {
  const inbound = await getInboundByCode(dbCode, code)

  if (!inbound) return null
  if (!scope.canViewAll && inbound.session.userCode !== scope.userCode) return null

  return inbound
}

//* list filters only, inactive rows included
export async function getInboundFilterOptions(
  dbCode: string | null
): Promise<{ siteOptions: FilterOption[]; userOptions: FilterOption[]; projectOptions: FilterOption[] }> {
  if (!dbCode) return { siteOptions: [], userOptions: [], projectOptions: [] }

  try {
    const [sites, users, projects] = await Promise.all([
      db.site.findMany({ where: { dbCode }, select: { code: true, name: true }, orderBy: { name: 'asc' } }),
      db.user.findMany({ where: { sessions: { some: { dbCode, type: 'INBOUND' } } }, select: { name: true }, orderBy: { name: 'asc' } }),
      db.customerProject.findMany({ where: { dbCode }, select: { code: true, name: true }, orderBy: { code: 'asc' } })
    ])

    return {
      siteOptions: sites.map((site) => ({ label: site.name, value: site.code })),
      userOptions: users.map((user) => ({ label: user.name, value: user.name })),
      projectOptions: projects.map((project) => ({ label: `${project.code} - ${project.name}`, value: project.code }))
    }
  } catch (err) {
    logger.error(err, '[GET_INBOUND_FILTER_OPTIONS_ERROR]:')
    return { siteOptions: [], userOptions: [], projectOptions: [] }
  }
}

export async function getDataTableInboundsSvr(dbCode: string, params: DataTableParams, scope: InboundScope) {
  const { perPage, offset, globalFilter, sorting, columnFilters, isExport } = getDataTableParams(params)

  const modelName: keyof PModels = 'Inbound'

  //* initialize where input, without view all a user sees only their own sessions' inbounds
  const where: Prisma.InboundWhereInput = { dbCode, ...(scope.canViewAll ? {} : { session: { userCode: scope.userCode } }) }

  //* global filter
  if (globalFilter) {
    const filter = buildGlobalFilterWhere<typeof modelName>(globalFilter, {
      stringFields: ['code', 'sessionCode', 'poNum', 'notes', 'cancelReason'],
      relationFields: [
        { relation: 'location', fields: ['name'], relationNullable: true },
        { relation: 'customerProject', fields: ['name'], relationNullable: true },
        { relation: 'session', fields: ['user.name'] }
      ]
    })

    Object.assign(where, filter)
  }

  //* column filters
  if (columnFilters.length > 0) {
    const currentFilters = where.AND as Prisma.InboundWhereInput[]

    const filters = buildColumnFiltersWhere<typeof modelName>(columnFilters, {
      stringFields: ['status', 'customerProjectCode'],
      dateFields: [{ field: 'submittedAt', nullable: true }],
      relationFields: [
        { id: 'siteCode', relation: 'session', field: 'siteCode' },
        { id: 'userName', relation: 'session', field: 'user.name' }
      ]
    })

    where.AND = [...(currentFilters ?? []), ...filters]
  }

  //* newest first unless the table sorts
  const orderBy: Prisma.InboundOrderByWithRelationInput[] =
    sorting.length > 0 ? buildOrderBy<typeof modelName>(sorting) : [{ createdAt: 'desc' }]

  try {
    const [inbounds, rowCount] = await db.$transaction([
      db.inbound.findMany({ where, include: INBOUND_LIST_INCLUDE, ...(isExport ? {} : { skip: offset, take: perPage }), orderBy }),
      db.inbound.count({ where })
    ])

    //* prisma can't sum a relation in findMany, so the page's packages are grouped once
    const totals = await db.inboundItem.groupBy({
      by: ['inboundCode'],
      where: { dbCode, inboundCode: { in: inbounds.map((row) => row.code) } },
      _count: { _all: true },
      _sum: { totalStock: true }
    })

    const totalsByCode = new Map(totals.map((row) => [row.inboundCode, row]))

    const data: InboundListRow[] = inbounds.map((row) => {
      const total = totalsByCode.get(row.code)
      return { ...row, packageCount: total?._count._all ?? 0, totalStock: total?._sum.totalStock?.toNumber() ?? 0 }
    })

    return { data, rowCount }
  } catch (err) {
    logger.error(err, '[GET_DATA_TABLE_INBOUNDS_ERROR]:')
    return { data: [] as InboundListRow[], rowCount: 0 }
  }
}

export const getDataTableInboundsSvrClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(dataTableParamsSchema)
  .action(async ({ ctx, parsedInput }) => {
    if (!ctx.ability?.can(PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.INBOUNDS))
      return { data: [] as InboundListRow[], rowCount: 0 }

    const canViewAll = ctx.ability.can(PERMISSIONS_ALLOWED_ACTIONS.VIEW_ALL, PERMISSIONS_CODES.INBOUNDS)

    return getDataTableInboundsSvr(ctx.dbCode, parsedInput, { userCode: ctx.userCode, canViewAll })
  })

export async function getInboundsBySession(dbCode: string | null, sessionCode: string): Promise<InboundWithInclude[]> {
  if (!dbCode) return []

  try {
    const inbounds = await db.inbound.findMany({
      where: { dbCode, sessionCode },
      include: COMMON_INBOUND_INCLUDE,
      orderBy: { createdAt: 'asc' }
    })
    return inbounds.map(toInboundView)
  } catch (err) {
    logger.error(err, '[GET_INBOUNDS_BY_SESSION_ERROR]:')
    return []
  }
}

//* active locations at the session's site
export async function getInboundLocationOptions(dbCode: string | null, siteCode: string): Promise<InboundOption[]> {
  if (!dbCode) return []

  try {
    const locations = await db.location.findMany({
      where: { dbCode, siteCode, isActive: true, deletedAt: null },
      select: { code: true, name: true },
      orderBy: { code: 'asc' }
    })

    return locations.map(toOption)
  } catch (err) {
    logger.error(err, '[GET_INBOUND_LOCATION_OPTIONS_ERROR]:')
    return []
  }
}

//* active projects with their category switches
export async function getInboundProjectOptions(dbCode: string | null): Promise<InboundProjectOption[]> {
  if (!dbCode) return []

  try {
    const projects = await db.customerProject.findMany({
      where: { dbCode, isActive: true, deletedAt: null },
      select: { code: true, name: true, category: { select: { code: true, name: true, isPoRequired: true, isMandatoryQc: true } } },
      orderBy: { code: 'asc' }
    })

    return projects.map(toOption)
  } catch (err) {
    logger.error(err, '[GET_INBOUND_PROJECT_OPTIONS_ERROR]:')
    return []
  }
}

export async function getInboundReferenceOptions(dbCode: string | null): Promise<InboundReferenceOptions> {
  if (!dbCode) return { commodityOptions: [], packagingTypeOptions: [] }

  try {
    const where = { dbCode, isActive: true, deletedAt: null }
    const select = { code: true, name: true }

    const [commodities, packagingTypes] = await Promise.all([
      db.commodity.findMany({ where, select, orderBy: { name: 'asc' } }),
      db.packagingType.findMany({ where, select, orderBy: { name: 'asc' } })
    ])

    return { commodityOptions: commodities.map(toOption), packagingTypeOptions: packagingTypes.map(toOption) }
  } catch (err) {
    logger.error(err, '[GET_INBOUND_REFERENCE_OPTIONS_ERROR]:')
    return { commodityOptions: [], packagingTypeOptions: [] }
  }
}

export const getPurchaseOrderClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(purchaseOrderQuerySchema)
  .action(async ({ ctx, parsedInput }) => {
    //* a sap failure is not the same as a closed po, the step says which
    try {
      return { purchaseOrder: await getPurchaseOrderByNum(ctx.dbCode, parsedInput.poNum), isSapError: false }
    } catch (err) {
      logger.error(err, '[GET_PURCHASE_ORDER_ERROR]:')
      return { purchaseOrder: null, isSapError: true }
    }
  })

//* the mfg p/n picker, only the po's parts when the category needs a po, every active part when it doesn't
export async function getDataTableInboundItemMastersSvr(dbCode: string, params: InboundItemMasterTableParams) {
  const { perPage, offset, globalFilter, isExport } = getDataTableParams(params)

  const modelName: keyof PModels = 'ItemMaster'

  try {
    const inbound = await db.inbound.findFirst({
      where: { dbCode, code: params.inboundCode },
      select: { poNum: true, projectCategory: { select: { isPoRequired: true } } }
    })

    const isPoRequired = !!inbound?.projectCategory?.isPoRequired
    const purchaseOrder = isPoRequired && inbound?.poNum ? await getPurchaseOrderByNum(dbCode, inbound.poNum) : null
    const poLines = purchaseOrder?.DocumentLines ?? []

    const filters: Prisma.ItemMasterWhereInput[] = [{ dbCode, isActive: true, deletedAt: null }]

    if (globalFilter)
      filters.push(buildGlobalFilterWhere<typeof modelName>(globalFilter, { stringFields: ['ItemCode', 'ItemName', 'FirmName'] }))

    //* no po yet means nothing to pick
    if (isPoRequired) filters.push({ ItemCode: { in: poLines.map((line) => line.ItemCode), mode: 'insensitive' } })

    const where: Prisma.ItemMasterWhereInput = { AND: filters }

    const [items, rowCount] = await db.$transaction([
      db.itemMaster.findMany({
        where,
        select: { ItemCode: true, ItemName: true, FirmName: true },
        orderBy: { ItemCode: 'asc' },
        ...(isExport ? {} : { skip: offset, take: perPage })
      }),
      db.itemMaster.count({ where })
    ])

    const rows: InboundItemMasterRow[] = items.map((row) => ({ ...row, isOnPo: isPartOnPo(row.ItemCode, poLines) }))

    return { data: rows, rowCount }
  } catch (err) {
    logger.error(err, '[GET_DATA_TABLE_INBOUND_ITEM_MASTERS_ERROR]:')
    return { data: [] as InboundItemMasterRow[], rowCount: 0 }
  }
}

export const getDataTableInboundItemMastersSvrClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(inboundItemMasterTableParamsSchema)
  .action(async ({ ctx, parsedInput }) => getDataTableInboundItemMastersSvr(ctx.dbCode, parsedInput))

export const createInboundDraft = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(createInboundDraftSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { dbCode, userCode } = ctx
    const actionTag = 'CREATE_INBOUND_DRAFT'

    if (!ctx.ability?.can(PERMISSIONS_ALLOWED_ACTIONS.CREATE, PERMISSIONS_CODES.INBOUNDS)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      const session = await db.session.findFirst({ where: { dbCode, code: parsedInput.sessionCode, deletedAt: null } })

      if (!session) return { status: 404, error: true, message: 'Session not found!', action: actionTag }
      if (!canEditSession(session, ctx)) return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
      if (session.type !== 'INBOUND') return { status: 409, error: true, message: 'This is not an inbound session!', action: actionTag }
      if (session.status !== 'IN_PROGRESS')
        return { status: 409, error: true, message: 'Resume the session to start an inbound!', action: actionTag }

      const inbound = await db.$transaction(async (tx) => {
        //* a complete or cancel running now finishes first, then this sees it closed
        const current = await lockSession(tx, dbCode, session.code)

        if (current.status !== 'IN_PROGRESS') throw new SessionConflictError(toClosedSessionMessage(current.status))

        const result = await tx.inbound.create({
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
          entity: { id: result.id, code: result.code }
        })

        return result
      })

      return {
        status: 200,
        error: false,
        message: `Inbound ${inbound.code} started!`,
        action: actionTag,
        data: { inboundCode: inbound.code }
      }
    } catch (err) {
      if (err instanceof SessionConflictError) return { status: err.status, error: true, message: err.message, action: actionTag }
      logger.error(err, '[CREATE_INBOUND_DRAFT_ERROR]:')
      return { status: 500, error: true, message: 'Something went wrong! Please try again later.', action: actionTag }
    }
  })

//* the auto save, a po change drops the packages, so it needs isClearItems when there are any
export const saveInboundDraft = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(saveInboundDraftSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { code, locationCode, customerProjectCode, poNum, isPartialReceived, notes, isClearItems } = parsedInput
    const { dbCode, userCode } = ctx
    const actionTag = 'SAVE_INBOUND_DRAFT'

    if (!ctx.ability?.can(PERMISSIONS_ALLOWED_ACTIONS.EDIT, PERMISSIONS_CODES.INBOUNDS)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      const { inbound, error } = await findEditableInbound(dbCode, code, ctx)

      if (error) return { ...error, error: true, action: actionTag }

      const [location, project] = await Promise.all([
        locationCode
          ? db.location.findFirst({ where: { dbCode, code: locationCode, deletedAt: null }, select: { siteCode: true, isActive: true } })
          : null,
        customerProjectCode
          ? db.customerProject.findFirst({ where: { dbCode, code: customerProjectCode, deletedAt: null }, include: { category: true } })
          : null
      ])

      //* only a newly picked one must be active, so an old draft still saves its other fields, submit checks again
      const isLocationChanged = (locationCode ?? null) !== inbound.locationCode
      const isProjectChanged = (customerProjectCode ?? null) !== inbound.customerProjectCode

      if (locationCode && (location?.siteCode !== inbound.session.siteCode || (isLocationChanged && !location?.isActive))) {
        const paths = [{ field: 'locationCode', message: 'Pick an active location at this site' }]
        return { status: 400, error: true, message: 'Pick an active location at this site!', action: actionTag, paths }
      }

      if (customerProjectCode && (!project || (isProjectChanged && !project.isActive))) {
        const paths = [{ field: 'customerProjectCode', message: 'Pick an active customer project' }]
        return { status: 400, error: true, message: 'Pick an active customer project!', action: actionTag, paths }
      }

      //* a project with no po drops the po
      const nextPoNum = project?.category.isPoRequired ? (poNum ?? null) : null
      const isPoChanged = nextPoNum !== inbound.poNum

      //* packages were matched on the old po, so a new po needs them gone first
      if (isPoChanged && inbound.items.length > 0 && !isClearItems) {
        return {
          status: 409,
          error: true,
          message: `Changing the PO removes ${inbound.items.length} package(s)!`,
          action: actionTag,
          data: { isClearNeeded: true, itemCount: inbound.items.length }
        }
      }

      await db.$transaction(async (tx) => {
        const before = await lockEditableInbound(tx, inbound)

        if (isPoChanged && isClearItems) await tx.inboundItem.deleteMany({ where: { dbCode, inboundCode: inbound.code } })

        //* a new project resets every package's mandatory qc to its category
        if (isProjectChanged && project) {
          await tx.inboundItem.updateMany({
            where: { dbCode, inboundCode: inbound.code, isMandatoryQc: { not: project.category.isMandatoryQc } },
            data: { isMandatoryQc: project.category.isMandatoryQc, updatedBy: userCode }
          })
        }

        const result = await tx.inbound.update({
          where: { id: inbound.id },
          data: {
            locationCode: locationCode ?? null,
            customerProjectCode: customerProjectCode ?? null,
            projectCategoryCode: project?.categoryCode ?? null,
            poNum: nextPoNum,
            isPartialReceived,
            notes: notes ?? null,
            updatedBy: userCode
          },
          include: INBOUND_ACTIVITY_INCLUDE
        })

        await logActivity(tx, {
          actor: ctx.actor,
          module: 'INBOUNDS',
          action: 'UPDATE',
          dbCode,
          entity: { id: result.id, code: result.code },
          changes: diffActivity(INBOUND_ACTIVITY_CONFIG, before, result)
        })
      })

      return { status: 200, error: false, message: 'Draft saved!', action: actionTag }
    } catch (err) {
      if (err instanceof SessionConflictError) return { status: err.status, error: true, message: err.message, action: actionTag }
      logger.error(err, '[SAVE_INBOUND_DRAFT_ERROR]:')
      return { status: 500, error: true, message: 'Something went wrong! Please try again later.', action: actionTag }
    }
  })

//* item master and po checks shared by save and import, a blank cost takes the po line price
function checkInboundItem(
  values: Pick<InboundItemForm, 'mpn' | 'commodityCode' | 'packagingTypeCode' | 'cost'>,
  context: {
    itemCodes: Map<string, string>
    commodityCodes: Map<string, string>
    packagingTypeCodes: Map<string, string>
    isPoRequired: boolean
    poNum: string | null
    poLines: InboundPurchaseOrderLine[]
  }
) {
  const paths: FieldError[] = []
  const itemCode = context.itemCodes.get(values.mpn.trim().toUpperCase())
  const poLine = context.poLines.find((line) => line.ItemCode.toUpperCase() === itemCode?.toUpperCase())
  const commodityCode = values.commodityCode ? context.commodityCodes.get(values.commodityCode.trim().toUpperCase()) : null
  const packagingTypeCode = values.packagingTypeCode ? context.packagingTypeCodes.get(values.packagingTypeCode.trim().toUpperCase()) : null

  if (!itemCode) paths.push({ field: 'mpn', message: 'MFG P/N not found in item master' })
  else if (context.isPoRequired && !poLine) paths.push({ field: 'mpn', message: `MFG P/N is not on PO ${context.poNum ?? ''}`.trim() })

  if (values.commodityCode && !commodityCode) paths.push({ field: 'commodityCode', message: 'Commodity not found' })
  if (values.packagingTypeCode && !packagingTypeCode) paths.push({ field: 'packagingTypeCode', message: 'Packaging type not found' })

  return {
    paths,
    mpn: itemCode ?? values.mpn,
    commodityCode: commodityCode ?? null,
    packagingTypeCode: packagingTypeCode ?? null,
    cost: values.cost ?? poLine?.Price ?? null
  }
}

//* a package that takes its part past the po's open qty
function checkOpenQty(
  mpn: string,
  totalStock: number,
  otherItems: { mpn: string; totalStock: number }[],
  poLines: InboundPurchaseOrderLine[]
): FieldError | null {
  if (getOverReceivedParts([...otherItems, { mpn, totalStock }], poLines).length === 0) return null

  const left = getSuggestedTotalStock(mpn, otherItems, poLines) ?? 0

  return { field: 'totalStock', message: `Only ${left} of ${mpn} left open on the PO` }
}

//* the item master, reference codes and po lines the checks above need, read once per request
async function getItemCheckContext(
  dbCode: string,
  inbound: { poNum: string | null; projectCategory: { isPoRequired: boolean } | null },
  mpns: string[]
) {
  const referenceWhere = { dbCode, isActive: true, deletedAt: null }

  const [itemMasters, commodities, packagingTypes, purchaseOrder] = await Promise.all([
    db.itemMaster.findMany({
      where: { dbCode, isActive: true, deletedAt: null, ItemCode: { in: mpns.map((mpn) => mpn.trim()), mode: 'insensitive' } },
      select: { ItemCode: true }
    }),
    db.commodity.findMany({ where: referenceWhere, select: { code: true } }),
    db.packagingType.findMany({ where: referenceWhere, select: { code: true } }),
    inbound.poNum ? getPurchaseOrderByNum(dbCode, inbound.poNum) : null
  ])

  return {
    itemCodes: new Map(itemMasters.map((row) => [row.ItemCode.toUpperCase(), row.ItemCode])),
    commodityCodes: new Map(commodities.map((row) => [row.code.toUpperCase(), row.code])),
    packagingTypeCodes: new Map(packagingTypes.map((row) => [row.code.toUpperCase(), row.code])),
    isPoRequired: !!inbound.projectCategory?.isPoRequired,
    poNum: inbound.poNum,
    poLines: purchaseOrder?.DocumentLines ?? []
  }
}

export const upsertInboundItem = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(inboundItemFormSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { inboundCode, lineNum, ...values } = parsedInput
    const { dbCode, userCode } = ctx
    const actionTag = 'UPSERT_INBOUND_ITEM'
    const isCreate = lineNum === null || lineNum === undefined

    if (!ctx.ability?.can(PERMISSIONS_ALLOWED_ACTIONS.EDIT, PERMISSIONS_CODES.INBOUNDS)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      const { inbound, error } = await findEditableInbound(dbCode, inboundCode, ctx)

      if (error) return { ...error, error: true, action: actionTag }

      const context = await getItemCheckContext(dbCode, inbound, [values.mpn])
      const { paths, mpn, commodityCode, packagingTypeCode, cost } = checkInboundItem(values, context)

      if (paths.length > 0) return { status: 400, error: true, message: `${paths[0].message}!`, action: actionTag, paths }

      //* the package being edited doesn't count against its own part
      if (context.isPoRequired) {
        const otherItems = inbound.items
          .filter((row) => row.lineNum !== lineNum)
          .map((row) => ({ mpn: row.mpn, totalStock: row.totalStock.toNumber() }))
        const qtyPath = checkOpenQty(mpn, values.totalStock, otherItems, context.poLines)

        if (qtyPath) return { status: 422, error: true, message: `${qtyPath.message}!`, action: actionTag, paths: [qtyPath] }
      }

      const data = { ...values, mpn, commodityCode, packagingTypeCode, cost, updatedBy: userCode }

      const nextLineNum = await db.$transaction(async (tx) => {
        const before = await lockEditableInbound(tx, inbound)

        if (!isCreate && !before.items.some((row) => row.lineNum === lineNum)) throw new SessionConflictError('Package not found!', 404)

        //* gaps stay after a delete, the line number is a label, read under the lock so two adds can't share one
        const nextLineNum = isCreate ? Math.max(0, ...before.items.map((row) => row.lineNum)) + 1 : lineNum

        if (isCreate) await tx.inboundItem.create({ data: { ...data, dbCode, inboundCode, lineNum: nextLineNum, createdBy: userCode } })
        else await tx.inboundItem.update({ where: { dbCode_inboundCode_lineNum: { dbCode, inboundCode, lineNum } }, data })

        const result = await tx.inbound.findUniqueOrThrow({ where: { id: inbound.id }, include: INBOUND_ACTIVITY_INCLUDE })

        await logActivity(tx, {
          actor: ctx.actor,
          module: 'INBOUNDS',
          action: 'UPDATE',
          dbCode,
          entity: { id: result.id, code: result.code },
          changes: diffActivity(INBOUND_ACTIVITY_CONFIG, before, result)
        })

        return nextLineNum
      })

      const message = isCreate ? `Line ${nextLineNum} added!` : `Line ${lineNum} updated!`

      return { status: 200, error: false, message, action: actionTag, data: { lineNum: nextLineNum } }
    } catch (err) {
      if (err instanceof SessionConflictError) return { status: err.status, error: true, message: err.message, action: actionTag }
      logger.error(err, '[UPSERT_INBOUND_ITEM_ERROR]:')
      return { status: 500, error: true, message: 'Something went wrong! Please try again later.', action: actionTag }
    }
  })

export const deleteInboundItem = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(inboundItemKeySchema)
  .action(async ({ ctx, parsedInput }) => {
    const { inboundCode, lineNum } = parsedInput
    const { dbCode } = ctx
    const actionTag = 'DELETE_INBOUND_ITEM'

    if (!ctx.ability?.can(PERMISSIONS_ALLOWED_ACTIONS.EDIT, PERMISSIONS_CODES.INBOUNDS)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      const { inbound, error } = await findEditableInbound(dbCode, inboundCode, ctx)

      if (error) return { ...error, error: true, action: actionTag }

      //* a draft line goes for good
      await db.$transaction(async (tx) => {
        const before = await lockEditableInbound(tx, inbound)

        if (!before.items.some((row) => row.lineNum === lineNum)) throw new SessionConflictError('Package not found!', 404)

        await tx.inboundItem.delete({ where: { dbCode_inboundCode_lineNum: { dbCode, inboundCode, lineNum } } })

        const result = await tx.inbound.findUniqueOrThrow({ where: { id: inbound.id }, include: INBOUND_ACTIVITY_INCLUDE })

        await logActivity(tx, {
          actor: ctx.actor,
          module: 'INBOUNDS',
          action: 'UPDATE',
          dbCode,
          entity: { id: result.id, code: result.code },
          changes: diffActivity(INBOUND_ACTIVITY_CONFIG, before, result)
        })
      })

      return { status: 200, error: false, message: `Line ${lineNum} removed!`, action: actionTag }
    } catch (err) {
      if (err instanceof SessionConflictError) return { status: err.status, error: true, message: err.message, action: actionTag }
      logger.error(err, '[DELETE_INBOUND_ITEM_ERROR]:')
      return { status: 500, error: true, message: 'Something went wrong! Please try again later.', action: actionTag }
    }
  })

type ImportColumn = keyof typeof INBOUND_ITEM_IMPORT_COLUMNS

//* the sheet header for a form field, for error entries
const toImportHeader = (field: string) => INBOUND_ITEM_IMPORT_COLUMNS[field as ImportColumn] ?? IMPORT_GENERIC_ERROR_ENTRY.field

export const importInboundItems = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(inboundItemImportSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { inboundCode, rows } = parsedInput
    const { dbCode, userCode } = ctx
    const actionTag = 'IMPORT_INBOUND_ITEMS'

    if (!ctx.ability?.can(PERMISSIONS_ALLOWED_ACTIONS.IMPORT, PERMISSIONS_CODES.INBOUNDS)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      const { inbound, error } = await findEditableInbound(dbCode, inboundCode, ctx)

      if (error) return { ...error, error: true, action: actionTag }

      //* sheet headers back to form fields, mandatory qc comes from the category
      const sheetRows = rows.map((row) => ({
        row,
        values: Object.fromEntries(Object.entries(INBOUND_ITEM_IMPORT_COLUMNS).map(([field, header]) => [field, row.values[header] ?? '']))
      }))

      const context = await getItemCheckContext(
        dbCode,
        inbound,
        sheetRows.map(({ values }) => values.mpn)
      )

      const errors: BatchError[] = []
      const validRows: (Omit<InboundItemForm, 'inboundCode' | 'lineNum'> & { cost: number | null })[] = []

      //* rows add up with each other and the saved packages
      const takenItems = inbound.items.map((row) => ({ mpn: row.mpn, totalStock: row.totalStock.toNumber() }))

      for (const { row, values } of sheetRows) {
        const key = String(row.rowNumber)
        const label = `Row ${row.rowNumber}`

        const result = inboundItemFormSchema.safeParse({
          ...values,
          inboundCode,
          lineNum: null,
          isMandatoryQc: !!inbound.projectCategory?.isMandatoryQc
        })

        //* check required fields and formats
        if (!result.success) {
          const entries = result.error.issues.map((issue) => ({
            field: toImportHeader(String(issue.path[0] ?? '')),
            message: issue.message
          }))
          errors.push({ key, label, entries })
          continue
        }

        //* check item master and po
        const { paths, mpn, commodityCode, packagingTypeCode, cost } = checkInboundItem(result.data, context)

        if (paths.length > 0) {
          errors.push({ key, label, entries: paths.map((path) => ({ field: toImportHeader(path.field), message: path.message })) })
          continue
        }

        const qtyPath = context.isPoRequired ? checkOpenQty(mpn, result.data.totalStock, takenItems, context.poLines) : null

        if (qtyPath) {
          errors.push({ key, label, entries: [{ field: toImportHeader(qtyPath.field), message: qtyPath.message }] })
          continue
        }

        const { inboundCode: _, lineNum: __, ...fields } = result.data

        takenItems.push({ mpn, totalStock: fields.totalStock })
        validRows.push({ ...fields, mpn, commodityCode, packagingTypeCode, cost })
      }

      //* all rows or none
      if (errors.length > 0) {
        const data: BatchStepResult = { succeeded: 0, errors }
        return { status: 422, error: true, message: `${errors.length} row(s) with errors, nothing was imported!`, action: actionTag, data }
      }

      await db.$transaction(async (tx) => {
        const before = await lockEditableInbound(tx, inbound)
        const firstLineNum = Math.max(0, ...before.items.map((row) => row.lineNum)) + 1

        await tx.inboundItem.createMany({
          data: validRows.map((fields, index) => ({
            ...fields,
            dbCode,
            inboundCode,
            lineNum: firstLineNum + index,
            createdBy: userCode,
            updatedBy: userCode
          }))
        })

        const result = await tx.inbound.findUniqueOrThrow({ where: { id: inbound.id }, include: INBOUND_ACTIVITY_INCLUDE })

        await logActivity(tx, {
          actor: ctx.actor,
          module: 'INBOUNDS',
          action: 'IMPORT',
          dbCode,
          entity: { id: result.id, code: result.code },
          changes: diffActivity(INBOUND_ACTIVITY_CONFIG, before, result)
        })
      })

      const data: BatchStepResult = { succeeded: validRows.length, errors: [] }

      return { status: 200, error: false, message: `${validRows.length} package(s) imported!`, action: actionTag, data }
    } catch (err) {
      if (err instanceof SessionConflictError) return { status: err.status, error: true, message: err.message, action: actionTag }
      logger.error(err, '[IMPORT_INBOUND_ITEMS_ERROR]:')
      return { status: 500, error: true, message: 'Something went wrong! Please try again later.', action: actionTag }
    }
  })

//* one unit per package in line order, the code date is the submit day
async function createInboundUnits(
  tx: Prisma.TransactionClient,
  ctx: { dbCode: string; userCode: number; actor: ActivityActor },
  inbound: Prisma.InboundGetPayload<{ include: typeof INBOUND_ACTIVITY_INCLUDE }> & { submittedAt: Date; receivedBy: number }
) {
  const { dbCode, userCode, actor } = ctx
  const { locationCode, projectCategoryCode, customerProjectCode, submittedAt: receivedAt, receivedBy } = inbound

  if (inbound.items.length === 0) return 0

  if (!locationCode || !projectCategoryCode || !customerProjectCode) {
    throw new SessionConflictError(`${inbound.code} is missing its location or project!`)
  }

  const items = [...inbound.items].sort((a, b) => a.lineNum - b.lineNum)
  const prefixParts = [projectCategoryCode, customerProjectCode]
  const { scope, first } = await reserveSequence(tx, PACKAGING_UNIT_SEQUENCE, { prefixParts }, items.length, receivedAt)

  const units: Prisma.PackagingUnitCreateManyInput[] = items.map((item, index) => ({
    dbCode,
    code: formatPackagingUnitCode(scope, first + index),
    inboundItemId: item.id,
    projectCategoryCode,
    customerProjectCode,
    locationCode,
    quantity: item.totalStock,
    receivedAt,
    receivedBy,
    createdBy: userCode,
    updatedBy: userCode
  }))

  await tx.packagingUnit.createMany({ data: units })

  const created = await tx.packagingUnit.findMany({ where: { dbCode, code: { in: units.map((unit) => unit.code) } } })
  const batchId = createId()
  const summary = `Created from inbound ${inbound.code}`

  //* one row per unit, then one summary for the inbound
  await logActivities(tx, [
    ...created.map((unit) => ({
      actor,
      module: 'PACKAGING_UNITS' as const,
      action: 'CREATE' as const,
      dbCode,
      batchId,
      summary,
      entity: { id: unit.id, code: unit.code },
      changes: diffActivity(PACKAGING_UNIT_ACTIVITY_CONFIG, null, unit)
    })),
    {
      actor,
      module: 'PACKAGING_UNITS' as const,
      action: 'BULK_CREATE' as const,
      dbCode,
      batchId,
      summary,
      changes: { fields: [], meta: { created: created.length } }
    }
  ])

  return created.length
}

export const submitInbound = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(inboundCodeSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { dbCode, userCode } = ctx
    const actionTag = 'SUBMIT_INBOUND'

    if (!ctx.ability?.can(PERMISSIONS_ALLOWED_ACTIONS.EDIT, PERMISSIONS_CODES.INBOUNDS)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      const { inbound, error } = await findEditableInbound(dbCode, parsedInput.inboundCode, ctx)

      if (error) return { ...error, error: true, action: actionTag }

      const isPoRequired = !!inbound.projectCategory?.isPoRequired

      //* the same per step rules the form checks, all at once
      const checked = inboundSubmitSchema(isPoRequired).safeParse({
        locationCode: inbound.locationCode ?? '',
        customerProjectCode: inbound.customerProjectCode ?? '',
        poNum: inbound.poNum ?? '',
        isPartialReceived: inbound.isPartialReceived,
        itemCount: inbound.items.length,
        notes: inbound.notes
      })

      if (!checked.success) {
        const paths: FieldError[] = checked.error.issues.map((issue) => ({ field: String(issue.path[0]), message: issue.message }))
        return { status: 422, error: true, message: `${paths[0].message}!`, action: actionTag, paths }
      }

      //* either may have turned inactive since it was picked
      const [location, project] = await Promise.all([
        db.location.findFirst({
          where: { dbCode, code: inbound.locationCode ?? '', isActive: true, deletedAt: null },
          select: { code: true }
        }),
        db.customerProject.findFirst({
          where: { dbCode, code: inbound.customerProjectCode ?? '', isActive: true, deletedAt: null },
          select: { code: true }
        })
      ])

      if (!location) {
        const paths = [{ field: 'locationCode', message: 'Pick an active location at this site' }]
        return { status: 422, error: true, message: `Location ${inbound.locationCode} is no longer active!`, action: actionTag, paths }
      }

      if (!project) {
        const paths = [{ field: 'customerProjectCode', message: 'Pick an active customer project' }]
        return { status: 422, error: true, message: `Customer project ${inbound.customerProjectCode} is no longer active!`, action: actionTag, paths } // prettier-ignore
      }

      //* each part totals at most its open qty, partial off needs every part on the po filled exactly
      if (isPoRequired && inbound.poNum) {
        const purchaseOrder = await getPurchaseOrderByNum(dbCode, inbound.poNum)

        if (!purchaseOrder) return { status: 409, error: true, message: `PO ${inbound.poNum} is no longer open in SAP!`, action: actionTag }

        const poLines = purchaseOrder.DocumentLines
        const items = inbound.items.map((row) => ({ lineNum: row.lineNum, mpn: row.mpn, totalStock: row.totalStock.toNumber() }))
        const offPo = items.filter((row) => !isPartOnPo(row.mpn, poLines))
        const toPartList = (parts: { mpn: string; receivedQty: number; openQty: number }[]) =>
          parts.map((row) => `${row.mpn} (${row.receivedQty} of ${row.openQty} open)`).join(', ')

        if (offPo.length > 0) {
          return {
            status: 422,
            error: true,
            message: `Line ${offPo.map((row) => row.lineNum).join(', ')} is not on the PO!`,
            action: actionTag
          }
        }

        const overParts = getOverReceivedParts(items, poLines)

        if (overParts.length > 0) {
          return { status: 422, error: true, message: `More than the PO has open for ${toPartList(overParts)}!`, action: actionTag }
        }

        const shortParts = inbound.isPartialReceived ? [] : getShortParts(items, poLines)

        if (shortParts.length > 0) {
          return { status: 422, error: true, message: `Less than the PO has open for ${toPartList(shortParts)}!`, action: actionTag }
        }
      }

      const unitCount = await db.$transaction(
        async (tx) => {
          const before = await lockEditableInbound(tx, inbound)

          //* the checks above ran on these packages, a change from another tab means check again
          //* sorted, the two reads may return rows in any order
          const toItemsKey = (items: { id: string; updatedAt: Date }[]) =>
            items
              .map((row) => `${row.id}:${+row.updatedAt}`)
              .sort()
              .join()

          if (toItemsKey(before.items) !== toItemsKey(inbound.items) || before.poNum !== inbound.poNum) {
            throw new SessionConflictError('The packages changed while submitting, check them and submit again!')
          }

          const submittedAt = new Date()

          const result = await tx.inbound.update({
            where: { id: inbound.id },
            data: { status: 'SUBMITTED', submittedAt, updatedBy: userCode },
            include: INBOUND_ACTIVITY_INCLUDE
          })

          await logActivity(tx, {
            actor: ctx.actor,
            module: 'INBOUNDS',
            action: 'UPDATE',
            dbCode,
            entity: { id: result.id, code: result.code },
            changes: diffActivity(INBOUND_ACTIVITY_CONFIG, before, result)
          })

          return createInboundUnits(tx, ctx, { ...result, submittedAt, receivedBy: inbound.session.userCode })
        },
        { timeout: 30000 }
      )

      return {
        status: 200,
        error: false,
        message: `Inbound ${inbound.code} submitted!`,
        action: actionTag,
        data: { inboundCode: inbound.code, packageCount: inbound.items.length, unitCount }
      }
    } catch (err) {
      if (err instanceof SessionConflictError) return { status: err.status, error: true, message: err.message, action: actionTag }
      logger.error(err, '[SUBMIT_INBOUND_ERROR]:')
      return { status: 500, error: true, message: 'Something went wrong! Please try again later.', action: actionTag }
    }
  })

//* a draft started by mistake goes for good with its packages, a submitted one never does
export const deleteInbound = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(inboundCodeSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { dbCode } = ctx
    const actionTag = 'DELETE_INBOUND'

    if (!ctx.ability?.can(PERMISSIONS_ALLOWED_ACTIONS.EDIT, PERMISSIONS_CODES.INBOUNDS)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      const { inbound, error } = await findEditableInbound(dbCode, parsedInput.inboundCode, ctx)

      if (error) return { ...error, error: true, action: actionTag }

      await db.$transaction(async (tx) => {
        const before = await lockEditableInbound(tx, inbound)

        //* the items go with it, the relation cascades
        await tx.inbound.delete({ where: { id: inbound.id } })

        await logActivity(tx, {
          actor: ctx.actor,
          module: 'INBOUNDS',
          action: 'DELETE',
          dbCode,
          entity: { id: inbound.id, code: inbound.code },
          changes: diffActivity(INBOUND_ACTIVITY_CONFIG, before, null)
        })
      })

      return {
        status: 200,
        error: false,
        message: `Inbound ${inbound.code} deleted!`,
        action: actionTag,
        data: { sessionCode: inbound.sessionCode }
      }
    } catch (err) {
      if (err instanceof SessionConflictError) return { status: err.status, error: true, message: err.message, action: actionTag }
      logger.error(err, '[DELETE_INBOUND_ERROR]:')
      return { status: 500, error: true, message: 'Something went wrong! Please try again later.', action: actionTag }
    }
  })
