'use server'

import { z } from 'zod'

import { action, authenticationMiddleware, tenantMiddleware } from '@/lib/safe-action'

import db from '@/lib/db'
import { Prisma } from '@/prisma/generated/client'
import { logger } from '@/lib/logger'
import { DataTableParams, dataTableParamsSchema } from '@/schema/data-table'
import { buildColumnFiltersWhere, buildGlobalFilterWhere, buildOrderBy, getDataTableParams } from '@/lib/data-table'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { PModels } from '@/types/prisma'
import { LABEL_MAX_COUNT } from '@/constants/label'
import { packagingUnitFormSchema } from '@/schema/packaging-unit'
import { diffActivity, logActivity } from '@/lib/activity-log'
import { PACKAGING_UNIT_DETAIL_ACTIVITY_CONFIG } from '@/lib/activity-configs/packaging-unit'

const COMMON_PACKAGING_UNIT_INCLUDE = {
  projectCategory: { select: { code: true, name: true } },
  customerProject: { select: { code: true, name: true } },
  location: { select: { code: true, name: true, site: { select: { code: true, name: true } } } },
  receivedByUser: { select: { code: true, name: true } },
  inboundItem: {
    include: {
      itemMaster: { select: { ItemCode: true, ItemName: true, FirmName: true, ItmsGrpNam: true, thumbnail: true } },
      commodity: { select: { code: true, name: true, isActive: true, deletedAt: true } },
      packagingType: { select: { code: true, name: true, isActive: true, deletedAt: true } },
      inbound: { select: { code: true, poNum: true, sessionCode: true } }
    }
  }
} satisfies Prisma.PackagingUnitInclude

type PackagingUnitPayload = Prisma.PackagingUnitGetPayload<{ include: typeof COMMON_PACKAGING_UNIT_INCLUDE }>

//* decimals become numbers, a client component can't take a Decimal
export type PackagingUnitWithRelations = Omit<PackagingUnitPayload, 'quantity' | 'inboundItem'> & {
  quantity: number
  inboundItem: Omit<PackagingUnitPayload['inboundItem'], 'cost' | 'totalStock'> & {
    cost: number | null
    totalStock: number
  }
}

//* line columns sort through the inbound item
const INBOUND_ITEM_SORT_FIELDS = ['owner', 'mpn', 'partNumber', 'dateCode', 'countryOfOrigin', 'lotCode', 'spq', 'cost'] as const

function toPackagingUnitView(unit: PackagingUnitPayload): PackagingUnitWithRelations {
  return {
    ...unit,
    quantity: unit.quantity.toNumber(),
    inboundItem: {
      ...unit.inboundItem,
      cost: unit.inboundItem.cost?.toNumber() ?? null,
      totalStock: unit.inboundItem.totalStock.toNumber()
    }
  }
}

export async function getPackagingUnitByCode(dbCode: string | null, code?: string | null): Promise<PackagingUnitWithRelations | null> {
  if (!dbCode || !code) return null

  try {
    const unit = await db.packagingUnit.findFirst({ where: { dbCode, code, deletedAt: null }, include: COMMON_PACKAGING_UNIT_INCLUDE })
    return unit ? toPackagingUnitView(unit) : null
  } catch (err: any) {
    logger.error(err, '[GET_PACKAGING_UNIT_BY_CODE_ERROR]:')
    return null
  }
}

//* ordered by code, missing ids drop out
export async function getPackagingUnitsByIds(dbCode: string, ids: string[]) {
  try {
    return await db.packagingUnit.findMany({
      where: { dbCode, id: { in: ids }, deletedAt: null },
      select: { id: true, code: true },
      orderBy: { code: 'asc' }
    })
  } catch (err: any) {
    logger.error(err, '[GET_PACKAGING_UNITS_BY_IDS_ERROR]:')
    return []
  }
}

//* same where and order for the table, the export and select all
function buildPackagingUnitQuery(dbCode: string, params: DataTableParams) {
  const { globalFilter, sorting, columnFilters, isShowDeleted } = getDataTableParams(params)

  const modelName: keyof PModels = 'PackagingUnit'

  //* initialize where input
  const where: Prisma.PackagingUnitWhereInput = { dbCode, ...(isShowDeleted ? {} : { deletedAt: null }) }

  //* global filter
  if (globalFilter) {
    const filter = buildGlobalFilterWhere<typeof modelName>(globalFilter, {
      stringFields: ['code', 'customerProjectCode', 'locationCode', 'palletCode', 'containerCode'],
      relationFields: [
        { relation: 'inboundItem', fields: ['mpn', 'partNumber', 'lotCode', 'inbound.poNum', 'inbound.code', 'inbound.sessionCode'] }
      ]
    })

    Object.assign(where, filter)
  }

  //* column filters
  if (columnFilters.length > 0) {
    const currentFilters = where.AND as Prisma.PackagingUnitWhereInput[]

    const filters = buildColumnFiltersWhere<typeof modelName>(columnFilters, {
      stringFields: ['customerProjectCode', 'locationCode', { field: 'containerCode', nullable: true }],
      dateFields: [{ field: 'receivedAt' }, { field: 'createdAt' }, { field: 'updatedAt' }]
    })

    where.AND = [...(currentFilters ?? []), ...filters]
  }

  //* newest received first unless the table sorts
  const orderBy: Prisma.PackagingUnitOrderByWithRelationInput[] =
    sorting.length > 0
      ? buildOrderBy<typeof modelName>(sorting, {
          relationFields: INBOUND_ITEM_SORT_FIELDS.map((field) => ({ id: field, relation: 'inboundItem', field }))
        })
      : [{ receivedAt: 'desc' }, { code: 'asc' }]

  return { where, orderBy }
}

export async function getDataTablePackagingUnitsSvr(dbCode: string, params: DataTableParams) {
  const { perPage, offset, isExport } = getDataTableParams(params)
  const { where, orderBy } = buildPackagingUnitQuery(dbCode, params)

  try {
    const [units, rowCount] = await db.$transaction([
      db.packagingUnit.findMany({
        where,
        include: COMMON_PACKAGING_UNIT_INCLUDE,
        ...(isExport ? {} : { skip: offset, take: perPage }),
        orderBy
      }),
      db.packagingUnit.count({ where })
    ])

    return { data: units.map(toPackagingUnitView), rowCount }
  } catch (err: any) {
    logger.error(err, '[GET_DATA_TABLE_PACKAGING_UNITS_ERROR]:')
    return { data: [] as PackagingUnitWithRelations[], rowCount: 0 }
  }
}

export const getDataTablePackagingUnitsSvrClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(dataTableParamsSchema)
  .action(async ({ ctx, parsedInput }) => {
    if (!ctx.ability?.can(PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.PACKAGING_UNITS)) return { data: [], rowCount: 0 }
    return getDataTablePackagingUnitsSvr(ctx.dbCode, parsedInput)
  })

//* ids only, units pile up fast and select all needs no rows
export const getPackagingUnitSelectIdsClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(dataTableParamsSchema)
  .action(async ({ ctx, parsedInput }) => {
    if (!ctx.ability?.can(PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.PACKAGING_UNITS)) return { ids: [], rowCount: 0 }

    //* a deleted unit can't print, so select all skips them
    const { where, orderBy } = buildPackagingUnitQuery(ctx.dbCode, { ...parsedInput, isShowDeleted: false })

    try {
      const [units, rowCount] = await db.$transaction([
        db.packagingUnit.findMany({ where, select: { id: true }, take: LABEL_MAX_COUNT, orderBy }),
        db.packagingUnit.count({ where })
      ])

      return { ids: units.map((unit) => unit.id), rowCount }
    } catch (err: any) {
      logger.error(err, '[GET_PACKAGING_UNIT_SELECT_IDS_ERROR]:')
      return { ids: [], rowCount: 0 }
    }
  })

export type InboundUnitRow = { id: string; code: string; mpn: string; quantity: number; locationCode: string; receivedAt: Date }

//* the units one inbound made, for the popup after submit
export const getPackagingUnitsByInboundClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(z.object({ inboundCode: z.string().min(1) }))
  .action(async ({ ctx, parsedInput }) => {
    const actionTag = 'GET_PACKAGING_UNITS_BY_INBOUND'

    if (!ctx.ability?.can(PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.PACKAGING_UNITS)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag, data: [] as InboundUnitRow[] }
    }

    try {
      const units = await db.packagingUnit.findMany({
        where: { dbCode: ctx.dbCode, deletedAt: null, inboundItem: { inboundCode: parsedInput.inboundCode } },
        select: { id: true, code: true, quantity: true, locationCode: true, receivedAt: true, inboundItem: { select: { mpn: true } } },
        orderBy: { code: 'asc' }
      })

      const data: InboundUnitRow[] = units.map(({ inboundItem, quantity, ...unit }) => ({
        ...unit,
        mpn: inboundItem.mpn,
        quantity: quantity.toNumber()
      }))

      return { status: 200, error: false, message: 'Unique IDs loaded!', action: actionTag, data }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)
      return {
        status: 500,
        error: true,
        message: 'Something went wrong! Please try again later.',
        action: actionTag,
        data: [] as InboundUnitRow[]
      }
    }
  })

//* live codes by uppercase, plus the item's own code even if it went inactive
function resolveRefCode(value: string | null, current: string | null, liveCodes: Map<string, string>) {
  if (!value) return { code: null, isFound: true }

  const key = value.toUpperCase()
  if (current && current.toUpperCase() === key) return { code: current, isFound: true }

  const code = liveCodes.get(key)
  return { code: code ?? null, isFound: !!code }
}

//* the details save to the unit's inbound item, so split units from the same line share them
export const updatePackagingUnit = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(packagingUnitFormSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { code, commodityCode, packagingTypeCode, ...details } = parsedInput
    const { dbCode, userCode, ability } = ctx
    const actionTag = 'UPDATE_PACKAGING_UNIT'

    if (!ability?.can(PERMISSIONS_ALLOWED_ACTIONS.EDIT, PERMISSIONS_CODES.PACKAGING_UNITS)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      const existing = await db.packagingUnit.findFirst({ where: { dbCode, code, deletedAt: null }, include: { inboundItem: true } })

      if (!existing) return { status: 404, error: true, message: 'Unique ID not found!', action: actionTag }

      const refWhere = { dbCode, isActive: true, deletedAt: null }
      const refSelect = { code: true }

      const [commodities, packagingTypes] = await Promise.all([
        db.commodity.findMany({ where: refWhere, select: refSelect }),
        db.packagingType.findMany({ where: refWhere, select: refSelect })
      ])

      const toCodeMap = (rows: { code: string }[]) => new Map(rows.map((row) => [row.code.toUpperCase(), row.code]))

      const commodity = resolveRefCode(commodityCode, existing.inboundItem.commodityCode, toCodeMap(commodities))
      const packagingType = resolveRefCode(packagingTypeCode, existing.inboundItem.packagingTypeCode, toCodeMap(packagingTypes))

      const paths: { field: string; message: string }[] = []
      if (!commodity.isFound) paths.push({ field: 'commodityCode', message: 'Commodity not found' })
      if (!packagingType.isFound) paths.push({ field: 'packagingTypeCode', message: 'Packaging type not found' })

      if (paths.length > 0) return { status: 400, error: true, message: `${paths[0].message}!`, action: actionTag, paths }

      await db.$transaction(async (tx) => {
        //* a blank cost stays blank, no po price fallback here
        const item = await tx.inboundItem.update({
          where: { id: existing.inboundItemId },
          data: { ...details, commodityCode: commodity.code, packagingTypeCode: packagingType.code, updatedBy: userCode }
        })

        await tx.packagingUnit.update({ where: { id: existing.id }, data: { updatedBy: userCode } })

        await logActivity(tx, {
          actor: ctx.actor,
          module: 'PACKAGING_UNITS',
          action: 'UPDATE',
          dbCode,
          entity: { id: existing.id, code: existing.code },
          changes: diffActivity(PACKAGING_UNIT_DETAIL_ACTIVITY_CONFIG, existing.inboundItem, item)
        })
      })

      return {
        status: 200,
        error: false,
        message: 'Unique ID updated successfully!',
        action: actionTag,
        data: { unit: { code: existing.code } }
      }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)
      return { status: 500, error: true, message: 'Something went wrong! Please try again later.', action: actionTag }
    }
  })
