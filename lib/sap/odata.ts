import { DataTableParams } from '@/schema/data-table'
import { SapQuery } from '@/types/sap'
import { sapString } from './endpoints'
import { DEFAULT_PAGINATION_PAGE_SIZE } from '@/constants/data-table'

//* turns data table params into service layer query options

type SapEnumOption = { value: string | number; label: string }

//* text runs contains(), enum matches the typed text against labels and filters on their values
export type SapColumnConfig = { field: string; type: 'text' } | { field: string; type: 'enum'; options: SapEnumOption[] }

//! matchNothing must use a real field, sap rejects a bare '1 eq 0'
export type SapTableConfig = {
  globalColumns: string[] //* column ids the global search covers, enum columns match by label
  columns: Record<string, SapColumnConfig>
  sortFields: Record<string, string>
  matchNothing: string //* e.g. "CardCode eq ''", used when a typed filter matches no option
}

function toLiteral(value: string | number) {
  return typeof value === 'number' ? String(value) : sapString(value)
}

function joinOr(clauses: string[]) {
  return clauses.length === 1 ? clauses[0] : `(${clauses.join(' or ')})`
}

//* labels containing the text, an array is taken as exact values from a picker
function buildEnumClause(field: string, options: SapEnumOption[], value: unknown, matchNothing: string) {
  const matches = Array.isArray(value)
    ? options.filter((option) => value.map(String).includes(String(option.value)))
    : options.filter((option) => option.label.toLowerCase().includes(String(value).trim().toLowerCase()))

  //! a filter that matches nothing must return no rows, not every row
  if (matches.length === 0) return matchNothing

  return joinOr(matches.map((option) => `${field} eq ${toLiteral(option.value)}`))
}

function buildColumnClause(config: SapColumnConfig, value: unknown, matchNothing: string) {
  if (config.type === 'enum') return buildEnumClause(config.field, config.options, value, matchNothing)

  return `contains(${config.field}, ${sapString(String(value).trim())})`
}

//* one or-group across the global columns, an enum with no matching label just drops out
function buildGlobalClause(term: string, config: SapTableConfig) {
  const clauses = config.globalColumns.flatMap((columnId) => {
    const column = config.columns[columnId]
    if (!column) return []

    if (column.type === 'text') return [`contains(${column.field}, ${sapString(term)})`]

    const clause = buildEnumClause(column.field, column.options, term, '')
    return clause ? [clause] : []
  })

  return clauses.length > 0 ? joinOr(clauses) : config.matchNothing
}

function isEmptyFilterValue(value: unknown) {
  if (value === null || value === undefined) return true
  if (Array.isArray(value)) return value.length === 0
  return String(value).trim() === ''
}

export function buildSapFilter(params: Pick<DataTableParams, 'globalFilter' | 'columnFilters'>, config: SapTableConfig) {
  const clauses: string[] = []
  const term = params.globalFilter?.trim()

  //* global search
  if (term && config.globalColumns.length > 0) clauses.push(buildGlobalClause(term, config))

  //* column filters, unknown columns are skipped
  for (const filter of params.columnFilters ?? []) {
    const column = config.columns[filter.id]
    if (!column || isEmptyFilterValue(filter.value)) continue

    clauses.push(buildColumnClause(column, filter.value, config.matchNothing))
  }

  return clauses.length > 0 ? clauses.join(' and ') : undefined
}

export function buildSapOrderBy(sorting: DataTableParams['sorting'], sortFields: Record<string, string>) {
  const parts = (sorting ?? []).filter((sort) => sortFields[sort.id]).map((sort) => `${sortFields[sort.id]} ${sort.desc ? 'desc' : 'asc'}`)

  return parts.length > 0 ? parts.join(', ') : undefined
}

//* paging is left off for an export, the caller walks the pages
export function buildSapTableQuery(params: DataTableParams, config: SapTableConfig): SapQuery {
  const perPage = params.perPage ?? DEFAULT_PAGINATION_PAGE_SIZE
  const page = Math.max(params.page ?? 1, 1)

  return {
    $filter: buildSapFilter(params, config),
    $orderby: buildSapOrderBy(params.sorting, config.sortFields),
    ...(!params.isExport && { $top: perPage, $skip: (page - 1) * perPage })
  }
}
