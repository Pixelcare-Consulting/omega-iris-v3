'use server'

import { z } from 'zod'

import { action, authenticationMiddleware, tenantMiddleware } from '@/lib/safe-action'
import { logger } from '@/lib/logger'
import { sapFetch, sapFetchAll, sapFetchLookup } from '@/lib/sap/service-layer'
import { sapString } from '@/lib/sap/endpoints'
import { buildSapTableQuery, SapTableConfig } from '@/lib/sap/odata'
import { toSapFailure, withoutNulls } from '@/lib/sap/utils'
import { toBusinessPartnerBody } from '@/lib/business-partner'
import {
  BusinessPartnerTableParams,
  businessPartnerCodeSchema,
  businessPartnerFormSchema,
  businessPartnerTableParamsSchema
} from '@/schema/business-partner'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { ACTIVE_OPTIONS, ALL_CURRENCIES, BP_OBJECT_CODE, BP_SUB_TYPES, CARD_TYPE_OPTIONS } from '@/constants/business-partner'
import {
  SapBPAddress,
  SapBusinessPartner,
  SapBusinessPartnerGroup,
  SapContactEmployee,
  SapCountry,
  SapCurrency,
  SapSalesPerson
} from '@/types/sap'

//* only the columns the list shows
const BP_LIST_SELECT = [
  'CardCode,CardName,CardType,GroupCode,Currency,FederalTaxID,SalesPersonCode,Phone1,EmailAddress,Valid,Frozen',
  'CreateDate,CreateTime,UpdateDate,UpdateTime'
].join(',')

//* the fields the form and view use, the full entity is about three times bigger
const BP_DETAIL_SELECT = [
  'CardCode,CardName,CardType,GroupCode,Currency,FederalTaxID,CompanyPrivate,SalesPersonCode',
  'Phone1,Phone2,Cellular,EmailAddress,BilltoDefault,ShipToDefault,ContactPerson,Valid,Frozen',
  'CreateDate,CreateTime,UpdateDate,UpdateTime,BPAddresses,ContactEmployees'
].join(',')

export type BusinessPartnerRow = SapBusinessPartner & { GroupName: string | null; SalesEmployeeName: string | null }

export type BusinessPartnerLookups = {
  groups: SapBusinessPartnerGroup[]
  currencies: SapCurrency[]
  salesPersons: SapSalesPerson[]
  countries: SapCountry[]
}

export async function getBusinessPartnerLookups(dbCode: string): Promise<BusinessPartnerLookups> {
  const [groups, currencies, salesPersons, countries] = await Promise.all([
    sapFetchLookup(dbCode, 'bpGroups.list', { query: { $select: 'Code,Name,Type', $orderby: 'Name' } }),
    sapFetchLookup(dbCode, 'currencies.list', { query: { $select: 'Code,Name', $orderby: 'Code' } }),
    sapFetchLookup(dbCode, 'salesPersons.list', { query: { $select: 'SalesEmployeeCode,SalesEmployeeName,Active', $orderby: 'SalesEmployeeName' } }), // prettier-ignore
    sapFetchLookup(dbCode, 'countries.list', { query: { $select: 'Code,Name', $orderby: 'Name' } })
  ])

  return { groups, currencies, salesPersons, countries }
}

export const getBusinessPartnerLookupsClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .action(async ({ ctx }) => getBusinessPartnerLookups(ctx.dbCode))

export async function getStatesByCountry(dbCode: string, country?: string | null) {
  if (!country) return []

  return sapFetchLookup(dbCode, 'states.list', {
    query: { $select: 'Code,Name,Country', $filter: `Country eq ${sapString(country)}`, $orderby: 'Name' }
  })
}

export const getStatesByCountryClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(z.object({ country: z.string().nullish() }))
  .action(async ({ ctx, parsedInput }) => getStatesByCountry(ctx.dbCode, parsedInput.country))

//* the page decides what a failure means, a 404 is a missing record
export async function getBusinessPartnerByCode(dbCode: string | null, cardCode?: string | null) {
  if (!dbCode || !cardCode) return null

  const result = await sapFetch(dbCode, 'bp.get', { params: { cardCode }, query: { $select: BP_DETAIL_SELECT } })

  if (!result.ok) {
    logger.error({ cardCode, code: result.code, status: result.status }, `[GET_BUSINESS_PARTNER_BY_CODE_ERROR]: ${result.message}`)
  }

  return result
}

export const getBusinessPartnerByCodeClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(z.object({ code: z.string().nullish() }))
  .action(async ({ ctx, parsedInput }) => getBusinessPartnerByCode(ctx.dbCode, parsedInput.code))

//* only the rows of one collection, for the view page tabs
async function getBusinessPartnerRelatedCollection(
  dbCode: string,
  cardCode: string,
  field: 'BPAddresses' | 'ContactEmployees',
  tag: string
) {
  if (!cardCode) return { rows: [], error: null }

  const result = await sapFetch(dbCode, 'bp.get', { params: { cardCode }, query: { $select: field } })

  if (!result.ok) {
    logger.error({ cardCode, code: result.code, status: result.status }, `[${tag}_ERROR]: ${result.message}`)
    return { rows: [], error: result.message }
  }

  return { rows: result.data[field] ?? [], error: null as string | null }
}

export async function getBusinessPartnerAddresses(dbCode: string, cardCode: string) {
  const { rows, error } = await getBusinessPartnerRelatedCollection(dbCode, cardCode, 'BPAddresses', 'GET_BUSINESS_PARTNER_ADDRESSES')
  return { addresses: rows as SapBPAddress[], error }
}

export const getBusinessPartnerAddressesClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(businessPartnerCodeSchema)
  .action(async ({ ctx, parsedInput }) => getBusinessPartnerAddresses(ctx.dbCode, parsedInput.code))

export async function getBusinessPartnerContacts(dbCode: string, cardCode: string) {
  const { rows, error } = await getBusinessPartnerRelatedCollection(dbCode, cardCode, 'ContactEmployees', 'GET_BUSINESS_PARTNER_CONTACTS')
  return { contacts: rows as SapContactEmployee[], error }
}

export const getBusinessPartnerContactsClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(businessPartnerCodeSchema)
  .action(async ({ ctx, parsedInput }) => getBusinessPartnerContacts(ctx.dbCode, parsedInput.code))

export async function getDataTableBusinessPartnersSvr(dbCode: string, params: BusinessPartnerTableParams) {
  try {
    //* the page sends the lookups it fetched once, they name the codes on each row and turn typed names into codes
    const { groups, salesPersons, currencies } = params.lookups

    const config: SapTableConfig = {
      //* every column the list shows, the label ones turn the typed text into sap codes
      globalColumns: ['CardCode', 'CardName', 'CardType', 'GroupName', 'Currency', 'FederalTaxID', 'SalesEmployeeName', 'Phone1', 'EmailAddress', 'Valid'], // prettier-ignore
      matchNothing: "CardCode eq ''", //* a card code is never empty
      columns: {
        CardCode: { field: 'CardCode', type: 'text' },
        CardName: { field: 'CardName', type: 'text' },
        CardType: { field: 'CardType', type: 'enum', options: CARD_TYPE_OPTIONS },
        GroupName: { field: 'GroupCode', type: 'enum', options: groups.map((g) => ({ value: g.Code, label: g.Name })) },
        //* code and name both match, '##' also matches All Currencies
        Currency: {
          field: 'Currency',
          type: 'enum',
          options: [ALL_CURRENCIES, ...currencies].map((c) => ({ value: c.Code, label: `${c.Code} ${c.Name}` }))
        },
        FederalTaxID: { field: 'FederalTaxID', type: 'text' },
        SalesEmployeeName: {
          field: 'SalesPersonCode',
          type: 'enum',
          options: salesPersons.map((s) => ({ value: s.SalesEmployeeCode, label: s.SalesEmployeeName }))
        },
        Phone1: { field: 'Phone1', type: 'text' },
        EmailAddress: { field: 'EmailAddress', type: 'text' },
        Valid: { field: 'Valid', type: 'enum', options: ACTIVE_OPTIONS }
      },
      //* group and sales employee would sort by code, so they are left out
      sortFields: {
        CardCode: 'CardCode',
        CardName: 'CardName',
        CardType: 'CardType',
        Currency: 'Currency',
        FederalTaxID: 'FederalTaxID',
        Phone1: 'Phone1',
        EmailAddress: 'EmailAddress',
        Valid: 'Valid'
      }
    }

    const { $top, $skip, ...query } = buildSapTableQuery(params, config)
    const listQuery = { ...query, $select: BP_LIST_SELECT, $orderby: query.$orderby ?? 'CardCode' }

    //* a page comes back as { value }, unwrapped so both branches give a plain row array
    const listRequest = params.isExport
      ? sapFetchAll(dbCode, 'bp.list', { query: listQuery }) //* every matching row, page by page
      : sapFetch(dbCode, 'bp.list', { query: { ...listQuery, $top, $skip } }).then((r) => (r.ok ? { ...r, data: r.data.value } : r))

    const [list, count] = await Promise.all([listRequest, sapFetch(dbCode, 'bp.count', { query: { $filter: query.$filter } })])

    if (!list.ok) throw new Error(list.message)

    const groupNames = new Map(groups.map((g) => [g.Code, g.Name]))
    const salesNames = new Map(salesPersons.map((s) => [s.SalesEmployeeCode, s.SalesEmployeeName]))

    const data: BusinessPartnerRow[] = list.data.map((row) => ({
      ...row,
      GroupName: groupNames.get(row.GroupCode) ?? null,
      SalesEmployeeName:
        row.SalesPersonCode !== null && row.SalesPersonCode !== undefined ? (salesNames.get(row.SalesPersonCode) ?? null) : null
    }))

    return { data, rowCount: count.ok ? Number(count.data) : data.length, error: null as string | null }
  } catch (err: any) {
    logger.error(err, '[GET_DATA_TABLE_BUSINESS_PARTNERS_ERROR]:')
    //* the table shows this instead of a silent empty list
    return {
      data: [] as BusinessPartnerRow[],
      rowCount: 0,
      error: err instanceof Error ? err.message : 'Could not load business partners from SAP.'
    }
  }
}

export const getDataTableBusinessPartnersSvrClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(businessPartnerTableParamsSchema)
  .action(async ({ ctx, parsedInput }) => {
    if (!ctx.ability?.can(PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.BUSINESS_PARTNERS)) {
      return { data: [] as BusinessPartnerRow[], rowCount: 0, error: 'You are not allowed to view this!' as string | null }
    }

    return getDataTableBusinessPartnersSvr(ctx.dbCode, parsedInput)
  })

export const upsertBusinessPartner = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(businessPartnerFormSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { dbCode, ability } = ctx
    const actionTag = 'UPSERT_BUSINESS_PARTNER'
    const isCreate = !parsedInput.CardCode

    const requiredAction = isCreate ? PERMISSIONS_ALLOWED_ACTIONS.CREATE : PERMISSIONS_ALLOWED_ACTIONS.EDIT

    if (!ability?.can(requiredAction, PERMISSIONS_CODES.BUSINESS_PARTNERS)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      const body = toBusinessPartnerBody(parsedInput)

      //* update business partner
      if (!isCreate) {
        const cardCode = parsedInput.CardCode
        const result = await sapFetch(dbCode, 'bp.update', { params: { cardCode }, body })

        if (!result.ok) return toSapFailure(result, actionTag)

        return { status: 200, error: false, message: 'Business partner updated successfully!', data: { businessPartner: { CardCode: cardCode } }, action: actionTag } // prettier-ignore
      }

      //* sap numbers it from the default series of the bp type
      const series = await sapFetch(dbCode, 'series.default', {
        body: { DocumentTypeParams: { Document: BP_OBJECT_CODE, DocumentSubType: BP_SUB_TYPES[parsedInput.CardType] } }
      })

      if (!series.ok) return toSapFailure(series, actionTag)

      //! a manual series needs a typed code, which this form never sends
      if (series.data.IsManual === 'tYES') {
        return { status: 400, error: true, message: 'The default SAP numbering series for this BP Type is manual. Set an automatic default series in SAP.', action: actionTag } // prettier-ignore
      }

      const result = await sapFetch(dbCode, 'bp.create', {
        body: { ...withoutNulls(body), Series: series.data.Series }
      })

      if (!result.ok) return toSapFailure(result, actionTag)

      return { status: 200, error: false, message: 'Business partner created successfully!', data: { businessPartner: { CardCode: result.data.CardCode } }, action: actionTag } // prettier-ignore
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })

export const deleteBusinessPartner = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(businessPartnerCodeSchema)
  .action(async ({ ctx, parsedInput }) => {
    const actionTag = 'DELETE_BUSINESS_PARTNER'

    if (!ctx.ability?.can(PERMISSIONS_ALLOWED_ACTIONS.DELETE, PERMISSIONS_CODES.BUSINESS_PARTNERS)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      //* sap refuses when the bp has documents, its message goes back as is
      const result = await sapFetch(ctx.dbCode, 'bp.delete', { params: { cardCode: parsedInput.code } })

      if (!result.ok) return toSapFailure(result, actionTag)

      return { status: 200, error: false, message: 'Business partner deleted successfully!', action: actionTag }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })
