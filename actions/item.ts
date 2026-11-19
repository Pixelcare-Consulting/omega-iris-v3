'use server'

import { z } from 'zod'

import { action, authenticationMiddleware, tenantMiddleware } from '@/lib/safe-action'
import { logger } from '@/lib/logger'
import { sapFetch, sapFetchAll, sapFetchLookup } from '@/lib/sap/service-layer'
import { sapString } from '@/lib/sap/endpoints'
import { buildSapTableQuery, SapTableConfig } from '@/lib/sap/odata'
import { toSapFailure, withoutNulls } from '@/lib/sap/utils'
import { toItemBody } from '@/lib/item'
import { ItemTableParams, itemCodeSchema, itemFormSchema, itemTableParamsSchema } from '@/schema/item'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { ACTIVE_OPTIONS } from '@/constants/business-partner'
import { ITEM_OBJECT_CODE, ITEM_TYPE_OPTIONS, TAX_GROUP_CATEGORY, YES_NO_OPTIONS } from '@/constants/item'
import { SapItem, SapItemGroup, SapManufacturer, SapSeries, SapVatGroup } from '@/types/sap'

const ITEM_FIELDS = [
  'ItemCode,ItemName,ItemType,ItemsGroupCode,InventoryItem,SalesItem,PurchaseItem,WTLiable,Manufacturer,SalesVATGroup,Valid,Frozen',
  'CreateDate,CreateTime,UpdateDate,UpdateTime'
].join(',')

export type ItemRow = SapItem & { ItemGroupName: string | null; ManufacturerName: string | null; TaxGroupName: string | null }

export type ItemLookups = {
  itemGroups: SapItemGroup[]
  manufacturers: SapManufacturer[]
  vatGroups: SapVatGroup[]
}

//* inactive tax groups stay in the list so old items still show a name, the form hides them
export async function getItemLookups(dbCode: string): Promise<ItemLookups> {
  const [itemGroups, manufacturers, vatGroups] = await Promise.all([
    sapFetchLookup(dbCode, 'itemGroups.list', { query: { $select: 'Number,GroupName', $orderby: 'GroupName' } }),
    sapFetchLookup(dbCode, 'manufacturers.list', { query: { $select: 'Code,ManufacturerName', $orderby: 'ManufacturerName' } }),
    sapFetchLookup(dbCode, 'vatGroups.list', {
      query: { $select: 'Code,Name,Category,Inactive', $filter: `Category eq ${sapString(TAX_GROUP_CATEGORY)}`, $orderby: 'Code' }
    })
  ])

  return { itemGroups, manufacturers, vatGroups }
}

export const getItemLookupsClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .action(async ({ ctx }) => getItemLookups(ctx.dbCode))

//* only series that number items themselves, the form has no field for a typed item no.
export async function getItemSeries(dbCode: string) {
  const params = { DocumentTypeParams: { Document: ITEM_OBJECT_CODE } }

  const [list, defaultSeries] = await Promise.all([
    sapFetch(dbCode, 'series.list', { body: params }),
    sapFetch(dbCode, 'series.default', { body: params })
  ])

  if (!list.ok) {
    logger.error({ code: list.code, status: list.status }, `[GET_ITEM_SERIES_ERROR]: ${list.message}`)
    return { series: [] as SapSeries[], defaultSeries: null }
  }

  const series = list.data.value
    .filter((s) => s.IsManual !== 'tYES' && s.Locked !== 'tYES')
    .sort((a, b) => a.Name.localeCompare(b.Name))
  const defaultCode = defaultSeries.ok ? defaultSeries.data.Series : null

  return { series, defaultSeries: series.some((s) => s.Series === defaultCode) ? defaultCode : (series[0]?.Series ?? null) }
}

export const getItemSeriesClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .action(async ({ ctx }) => getItemSeries(ctx.dbCode))

//* the page decides what a failure means, a 404 is a missing record
export async function getItemByCode(dbCode: string | null, itemCode?: string | null) {
  if (!dbCode || !itemCode) return null

  const result = await sapFetch(dbCode, 'items.get', { params: { itemCode }, query: { $select: ITEM_FIELDS } })

  if (!result.ok) {
    logger.error({ itemCode, code: result.code, status: result.status }, `[GET_ITEM_BY_CODE_ERROR]: ${result.message}`)
  }

  return result
}

export const getItemByCodeClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(z.object({ code: z.string().nullish() }))
  .action(async ({ ctx, parsedInput }) => getItemByCode(ctx.dbCode, parsedInput.code))

export async function getDataTableItemsSvr(dbCode: string, params: ItemTableParams) {
  try {
    //* the page sends the lookups it fetched once, they name the codes on each row and turn typed names into codes
    const { itemGroups, manufacturers, vatGroups } = params.lookups

    const config: SapTableConfig = {
      //* every column the list shows, the label ones turn the typed text into sap codes
      globalColumns: ['ItemCode', 'ItemName', 'ItemType', 'ItemGroupName', 'InventoryItem', 'SalesItem', 'PurchaseItem', 'WTLiable', 'ManufacturerName', 'TaxGroupName', 'Valid'], // prettier-ignore
      matchNothing: "ItemCode eq ''", //* an item code is never empty
      columns: {
        ItemCode: { field: 'ItemCode', type: 'text' },
        ItemName: { field: 'ItemName', type: 'text' },
        ItemType: { field: 'ItemType', type: 'enum', options: ITEM_TYPE_OPTIONS },
        ItemGroupName: { field: 'ItemsGroupCode', type: 'enum', options: itemGroups.map((g) => ({ value: g.Number, label: g.GroupName })) },
        InventoryItem: { field: 'InventoryItem', type: 'enum', options: YES_NO_OPTIONS },
        SalesItem: { field: 'SalesItem', type: 'enum', options: YES_NO_OPTIONS },
        PurchaseItem: { field: 'PurchaseItem', type: 'enum', options: YES_NO_OPTIONS },
        WTLiable: { field: 'WTLiable', type: 'enum', options: YES_NO_OPTIONS },
        ManufacturerName: {
          field: 'Manufacturer',
          type: 'enum',
          options: manufacturers.map((m) => ({ value: m.Code, label: m.ManufacturerName }))
        },
        TaxGroupName: { field: 'SalesVATGroup', type: 'enum', options: vatGroups.map((v) => ({ value: v.Code, label: v.Name })) },
        Valid: { field: 'Valid', type: 'enum', options: ACTIVE_OPTIONS }
      },
      //* item group, manufacturer and tax group would sort by code, so they are left out
      sortFields: {
        ItemCode: 'ItemCode',
        ItemName: 'ItemName',
        ItemType: 'ItemType',
        InventoryItem: 'InventoryItem',
        SalesItem: 'SalesItem',
        PurchaseItem: 'PurchaseItem',
        WTLiable: 'WTLiable',
        Valid: 'Valid'
      }
    }

    const { $top, $skip, ...query } = buildSapTableQuery(params, config)
    const listQuery = { ...query, $select: ITEM_FIELDS, $orderby: query.$orderby ?? 'ItemCode' }

    //* a page comes back as { value }, unwrapped so both branches give a plain row array
    const listRequest = params.isExport
      ? sapFetchAll(dbCode, 'items.list', { query: listQuery }) //* every matching row, page by page
      : sapFetch(dbCode, 'items.list', { query: { ...listQuery, $top, $skip } }).then((r) => (r.ok ? { ...r, data: r.data.value } : r))

    const [list, count] = await Promise.all([listRequest, sapFetch(dbCode, 'items.count', { query: { $filter: query.$filter } })])

    if (!list.ok) throw new Error(list.message)

    const groupNames = new Map(itemGroups.map((g) => [g.Number, g.GroupName]))
    const manufacturerNames = new Map(manufacturers.map((m) => [m.Code, m.ManufacturerName]))
    const taxGroupNames = new Map(vatGroups.map((v) => [v.Code, v.Name]))

    const data: ItemRow[] = list.data.map((row) => ({
      ...row,
      ItemGroupName: groupNames.get(row.ItemsGroupCode) ?? null,
      ManufacturerName:
        row.Manufacturer !== null && row.Manufacturer !== undefined ? (manufacturerNames.get(row.Manufacturer) ?? null) : null,
      TaxGroupName: row.SalesVATGroup ? (taxGroupNames.get(row.SalesVATGroup) ?? null) : null
    }))

    return { data, rowCount: count.ok ? Number(count.data) : data.length, error: null as string | null }
  } catch (err: any) {
    logger.error(err, '[GET_DATA_TABLE_ITEMS_ERROR]:')
    //* the table shows this instead of a silent empty list
    return {
      data: [] as ItemRow[],
      rowCount: 0,
      error: err instanceof Error ? err.message : 'Could not load items from SAP.'
    }
  }
}

export const getDataTableItemsSvrClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(itemTableParamsSchema)
  .action(async ({ ctx, parsedInput }) => {
    if (!ctx.ability?.can(PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.ITEMS)) {
      return { data: [] as ItemRow[], rowCount: 0, error: 'You are not allowed to view this!' as string | null }
    }

    return getDataTableItemsSvr(ctx.dbCode, parsedInput)
  })

export const upsertItem = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(itemFormSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { dbCode, ability } = ctx
    const actionTag = 'UPSERT_ITEM'
    const isCreate = !parsedInput.ItemCode

    const requiredAction = isCreate ? PERMISSIONS_ALLOWED_ACTIONS.CREATE : PERMISSIONS_ALLOWED_ACTIONS.EDIT

    if (!ability?.can(requiredAction, PERMISSIONS_CODES.ITEMS)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      const body = toItemBody(parsedInput)

      //* update item
      if (!isCreate) {
        const itemCode = parsedInput.ItemCode
        const result = await sapFetch(dbCode, 'items.update', { params: { itemCode }, body })

        if (!result.ok) return toSapFailure(result, actionTag)

        return { status: 200, error: false, message: 'Item updated successfully!', data: { item: { ItemCode: itemCode } }, action: actionTag } // prettier-ignore
      }

      //* sap numbers it from the picked series
      //! a manual or locked series needs a typed code, which this form never sends
      const { series } = await getItemSeries(dbCode)
      const seriesCode = parsedInput.Series

      if (!seriesCode || !series.some((s) => s.Series === seriesCode)) {
        return { status: 400, error: true, message: 'The selected Series is not available. Please choose another one.', paths: [{ field: 'Series', message: 'Series is not available' }], action: actionTag } // prettier-ignore
      }

      const result = await sapFetch(dbCode, 'items.create', { body: { ...withoutNulls(body), Series: seriesCode } })

      if (!result.ok) return toSapFailure(result, actionTag)

      return { status: 200, error: false, message: 'Item created successfully!', data: { item: { ItemCode: result.data.ItemCode } }, action: actionTag } // prettier-ignore
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })

export const deleteItem = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(itemCodeSchema)
  .action(async ({ ctx, parsedInput }) => {
    const actionTag = 'DELETE_ITEM'

    if (!ctx.ability?.can(PERMISSIONS_ALLOWED_ACTIONS.DELETE, PERMISSIONS_CODES.ITEMS)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      //* sap refuses when the item is used in documents, its message goes back as is
      const result = await sapFetch(ctx.dbCode, 'items.delete', { params: { itemCode: parsedInput.code } })

      if (!result.ok) return toSapFailure(result, actionTag)

      return { status: 200, error: false, message: 'Item deleted successfully!', action: actionTag }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })
