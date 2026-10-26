import {
  SapBusinessPartner,
  SapBusinessPartnerBody,
  SapBusinessPartnerGroup,
  SapCollection,
  SapCountry,
  SapCurrency,
  SapDocumentTypeParams,
  SapSalesPerson,
  SapSeries,
  SapState
} from '@/types/sap'
import { SAP_NO_PAGINATION } from '@/constants/sap'

//* the one list of service layer endpoints, sapFetch reads its types from here

export type SapMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

//* params, body and response only live in the type, __types is never set
export type SapEndpoint<P, B, R> = {
  method: SapMethod
  path: string | ((params: P) => string)
  headers?: Record<string, string>
  readonly __types?: { params: P; body: B; response: R }
}

//* R response, B body, P path params, undefined means the call takes none
function endpoint<R, B = undefined, P = undefined>(def: {
  method: SapMethod
  path: [P] extends [undefined] ? string : (params: P) => string
  headers?: Record<string, string>
}) {
  return def as SapEndpoint<P, B, R>
}

//* a string literal for $filter, single quotes doubled
export function sapString(value: string) {
  return `'${value.replace(/'/g, "''")}'`
}

//* a string key for a path, e.g. BusinessPartners('C001')
export function sapKey(value: string) {
  return `'${encodeURIComponent(value.replace(/'/g, "''"))}'`
}

type CardCodeParams = { cardCode: string }

const NO_PAGING = { Prefer: SAP_NO_PAGINATION }

//* B1S-ReplaceCollectionsOnPatch - a PATCH replaces child rows with the ones sent, so rows left out get removed

export const SAP_ENDPOINTS = {
  'company.info': endpoint<unknown>({ method: 'POST', path: 'CompanyService_GetCompanyInfo' }),

  //* business partners
  'bp.list': endpoint<SapCollection<SapBusinessPartner>>({ method: 'GET', path: 'BusinessPartners' }),
  'bp.count': endpoint<number>({ method: 'GET', path: 'BusinessPartners/$count' }),
  'bp.get': endpoint<SapBusinessPartner, undefined, CardCodeParams>({
    method: 'GET',
    path: (p) => `BusinessPartners(${sapKey(p.cardCode)})`
  }),
  'bp.create': endpoint<SapBusinessPartner, SapBusinessPartnerBody>({ method: 'POST', path: 'BusinessPartners' }),
  'bp.update': endpoint<undefined, SapBusinessPartnerBody, CardCodeParams>({
    method: 'PATCH',
    path: (p) => `BusinessPartners(${sapKey(p.cardCode)})`,
    headers: { 'B1S-ReplaceCollectionsOnPatch': 'true' }
  }),
  'bp.delete': endpoint<undefined, undefined, CardCodeParams>({
    method: 'DELETE',
    path: (p) => `BusinessPartners(${sapKey(p.cardCode)})`
  }),

  //* numbering series
  'series.default': endpoint<SapSeries, SapDocumentTypeParams>({ method: 'POST', path: 'SeriesService_GetDefaultSeries' }),

  //* lookups, small lists so they come back whole
  'bpGroups.list': endpoint<SapCollection<SapBusinessPartnerGroup>>({ method: 'GET', path: 'BusinessPartnerGroups', headers: NO_PAGING }), // prettier-ignore
  'currencies.list': endpoint<SapCollection<SapCurrency>>({ method: 'GET', path: 'Currencies', headers: NO_PAGING }),
  'salesPersons.list': endpoint<SapCollection<SapSalesPerson>>({ method: 'GET', path: 'SalesPersons', headers: NO_PAGING }),
  'countries.list': endpoint<SapCollection<SapCountry>>({ method: 'GET', path: 'Countries', headers: NO_PAGING }),
  'states.list': endpoint<SapCollection<SapState>>({ method: 'GET', path: 'States', headers: NO_PAGING })
}

export type SapEndpoints = typeof SAP_ENDPOINTS
export type SapEndpointKey = keyof SapEndpoints

type TypesOf<K extends SapEndpointKey> = NonNullable<SapEndpoints[K]['__types']>

export type SapParamsOf<K extends SapEndpointKey> = TypesOf<K>['params']
export type SapBodyOf<K extends SapEndpointKey> = TypesOf<K>['body']
export type SapResponseOf<K extends SapEndpointKey> = TypesOf<K>['response']

//* bodyless endpoints that return a { value: [] } collection, the only ones sapFetchAll can walk
export type SapCollectionKey = {
  [K in SapEndpointKey]: SapResponseOf<K> extends SapCollection<any> ? (SapBodyOf<K> extends undefined ? K : never) : never
}[SapEndpointKey]
export type SapItemOf<K extends SapCollectionKey> = SapResponseOf<K> extends SapCollection<infer T> ? T : never
