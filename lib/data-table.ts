import {
  addDays,
  addWeeks,
  addMonths,
  addYears,
  subDays,
  subWeeks,
  subMonths,
  subYears,
  startOfDay,
  endOfDay,
  isSameDay,
  parseISO,
  isAfter,
  isBefore,
  isValid,
  sub,
  add
} from 'date-fns'
import { FilterFn, sortingFns, SortingFn, Column, Row } from '@tanstack/react-table'
import { compareItems, RankingInfo, rankItem } from '@tanstack/match-sorter-utils'

import { DateFilterValue, RelativeUnit, RelativeDirection, NumericFilterValue } from '@/types/data-table'
import { PModels } from '@/types/prisma'
import { DataTableParams } from '@/schema/data-table'
import { DEFAULT_PAGINATION_PAGE_INDEX, DEFAULT_PAGINATION_PAGE_SIZE, EMPTY_FILTER_VALUE } from '@/constants/data-table'

//* withBorder draws a shadow between the pinned columns and the rest of the table

export function getCommonPinningStyles<TData>({
  column,
  withBorder = false
}: {
  column: Column<TData>
  withBorder?: boolean
}): React.CSSProperties {
  const isPinned = column.getIsPinned()
  const isLastLeftPinnedColumn = isPinned === 'left' && column.getIsLastColumn('left')
  const isFirstRightPinnedColumn = isPinned === 'right' && column.getIsFirstColumn('right')

  return {
    boxShadow: withBorder
      ? isLastLeftPinnedColumn
        ? '-4px 0 4px -4px var(--border) inset'
        : isFirstRightPinnedColumn
          ? '4px 0 4px -4px var(--border) inset'
          : undefined
      : undefined,
    left: isPinned === 'left' ? `${column.getStart('left')}px` : undefined,
    right: isPinned === 'right' ? `${column.getAfter('right')}px` : undefined,
    opacity: isPinned ? 0.97 : 1,
    position: isPinned ? 'sticky' : 'relative',
    background: isPinned ? 'var(--background)' : 'var(--background)',
    width: column.getSize(),
    zIndex: isPinned ? 1 : undefined
  }
}

export const fuzzyFilter: FilterFn<any> = (row, columnId, filterValue, addMeta) => {
  //* rank the item
  const itemRank = rankItem(row.getValue(columnId), filterValue)

  //* store the rank info
  addMeta({ itemRank })

  //* whether the row is filtered in or out
  return itemRank.passed
}

export const fuzzySort: SortingFn<any> = (rowA, rowB, columnId) => {
  let dir = 0

  //* only sort by rank when the column carries ranking info
  if (
    rowA.columnFiltersMeta[columnId] &&
    'itemRank' in rowA.columnFiltersMeta[columnId] &&
    'itemRank' in rowB.columnFiltersMeta[columnId]
  ) {
    dir = compareItems(rowA.columnFiltersMeta[columnId]?.itemRank as RankingInfo, rowB.columnFiltersMeta[columnId]?.itemRank as RankingInfo)
  }

  //* alphanumeric fallback when the ranks tie
  return dir === 0 ? sortingFns.alphanumeric(rowA, rowB, columnId) : dir
}

//* global search filter
export const globalSearchFilterFn: FilterFn<any> = (row, columnId, filterValue) => {
  const searchTerm = String(filterValue).toLowerCase()
  const cellValue = row.getValue(columnId)
  return cellValue !== undefined ? String(cellValue).toLowerCase().includes(searchTerm) : false
}

//* null, undefined and blank all collapse to one sentinel, so they get a single labelled option
export function normalizeFilterValue(value: unknown): string {
  if (value === null || value === undefined) return EMPTY_FILTER_VALUE
  const stringValue = String(value)
  return stringValue.trim() === '' ? EMPTY_FILTER_VALUE : stringValue
}

//* split a multi-select filter array into the empty sentinel and the real values
export function splitEmptyFilterValues(values: string[]) {
  return {
    hasEmpty: values.includes(EMPTY_FILTER_VALUE),
    values: values.filter((v) => v !== EMPTY_FILTER_VALUE)
  }
}

//* multi select filter, case insensitive
export const multiSelectFilterFn: FilterFn<any> = (row, columnId, filterValues: string[]) => {
  if (!filterValues?.length) return true

  const cellValue = normalizeFilterValue(row.getValue(columnId))

  //* empty cells only match when the (Empty) option is selected
  if (cellValue === EMPTY_FILTER_VALUE) return filterValues.includes(EMPTY_FILTER_VALUE)

  return filterValues.map((v) => v.toLowerCase()).includes(cellValue.toLowerCase())
}

export const numericFilterFn: FilterFn<any> = (row, columnId, filterValue: NumericFilterValue) => {
  const cellValue = row.getValue<number>(columnId)
  const { operator, value, valueTo } = filterValue

  switch (operator) {
    case 'eq':
      return cellValue === value
    case 'ne':
      return cellValue !== value
    case 'lt':
      return cellValue < value!
    case 'lte':
      return cellValue <= value!
    case 'gt':
      return cellValue > value!
    case 'gte':
      return cellValue >= value!
    case 'isBetween':
      return cellValue >= value! && cellValue <= valueTo!
    case 'isEmpty':
      return cellValue === null || cellValue === undefined
    case 'isNotEmpty':
      return cellValue !== null && cellValue !== undefined
    default:
      return true
  }
}

//* tell tanstack which operators auto-remove the filter, if the filter is empty
numericFilterFn.autoRemove = (val: NumericFilterValue) => !val

function resolveRelativeRange(amount: number, unit: RelativeUnit, direction: RelativeDirection): { from: Date; to: Date } {
  const today = startOfDay(new Date())
  const adders: Record<RelativeUnit, (d: Date, n: number) => Date> = { days: addDays, weeks: addWeeks, months: addMonths, years: addYears }
  const subbers: Record<RelativeUnit, (d: Date, n: number) => Date> = { days: subDays, weeks: subWeeks, months: subMonths, years: subYears }

  if (direction === 'past') return { from: subbers[unit](today, amount), to: endOfDay(today) }
  return { from: today, to: endOfDay(adders[unit](today, amount)) }
}

export const dateFilterFn: FilterFn<any> = (row, columnId, filterValue: DateFilterValue) => {
  const cellValue = row.getValue<string | Date | null | undefined>(columnId)
  const { operator } = filterValue

  if (operator === 'isEmpty') return cellValue === null || cellValue === undefined || cellValue === ''
  if (operator === 'isNotEmpty') return cellValue !== null && cellValue !== undefined && cellValue !== ''

  const cell = cellValue instanceof Date ? cellValue : cellValue ? parseISO(cellValue as string) : null

  if (!cell || !isValid(cell)) return false

  const cellDay = startOfDay(cell)

  if (operator === 'isRelativeToToday') {
    if (!filterValue.relative) return false
    const { from, to } = resolveRelativeRange(filterValue.relative.amount, filterValue.relative.unit, filterValue.relative.direction)
    return !isBefore(cellDay, from) && !isAfter(cellDay, to)
  }

  if (operator === 'isBetween') {
    const from = filterValue.value ? startOfDay(parseISO(filterValue.value)) : null
    const to = filterValue.valueTo ? endOfDay(parseISO(filterValue.valueTo)) : null
    if (!from && !to) return true
    if (from && isBefore(cellDay, from)) return false
    if (to && isAfter(cellDay, to)) return false
    return true
  }

  if (!filterValue.value) return false
  const target = startOfDay(parseISO(filterValue.value))

  switch (operator) {
    case 'eq':
      return isSameDay(cellDay, target)
    case 'ne':
      return !isSameDay(cellDay, target)
    case 'lt':
      return isBefore(cellDay, target)
    case 'gt':
      return isAfter(cellDay, target)
    case 'lte':
      return isBefore(cellDay, target) || isSameDay(cellDay, target)
    case 'gte':
      return isAfter(cellDay, target) || isSameDay(cellDay, target)
    default:
      return true
  }
}

//* tell tanstack which operators auto-remove the filter, if the filter is empty
dateFilterFn.autoRemove = (val: DateFilterValue) => !val

type RelationFieldConfig<T extends keyof PModels> = {
  relation: keyof PModels[T]
  fields: string[] //* fields inside the relation, a dot path goes deeper (e.g. 'position.name')
  isArray?: boolean //* true if it's a one-to-many (e.g. orders, items)
  relationNullable?: boolean //* true when the relation itself is optional, filters through `is`
  where?: Record<string, any> //* extra conditions on the related row (e.g. { userCode })
}

//* 'position.name' becomes { position: { name: value } }
//! nested steps are plain objects, so a dot path only works through required relations
function toNestedFilter(path: string, value: Record<string, any>): Record<string, any> {
  return path.split('.').reduceRight<Record<string, any>>((filter, key) => ({ [key]: filter }), value)
}

type GlobalFilterConfig<T extends keyof PModels> = {
  stringFields: (keyof PModels[T])[]
  booleanFields?: { field: keyof PModels[T]; trueValues?: string[]; falseValues?: string[] }[]
  numericFields?: (keyof PModels[T])[]
  arrayFields?: (keyof PModels[T])[]
  relationFields?: RelationFieldConfig<T>[]
}

//* `the*of` is two keywords, the global search splits on `*` and ANDs them
export function splitGlobalFilterKeywords(globalFilter: string) {
  return globalFilter
    .split('*')
    .map((keyword) => keyword.trim())
    .filter(Boolean)
}

//! contains runs as ILIKE, where % and _ are wildcards, so they get escaped to match as typed
export function escapeLikeKeyword(keyword: string) {
  return keyword.replace(/[\\%_]/g, (char) => `\\${char}`)
}

export function buildGlobalFilterWhere<T extends keyof PModels>(globalFilter: string, config: GlobalFilterConfig<T>) {
  const { stringFields, booleanFields = [], numericFields = [], arrayFields = [], relationFields = [] } = config

  const keywords = splitGlobalFilterKeywords(globalFilter).map((keyword) => keyword.toLowerCase())

  if (keywords.length === 0) return {}

  return {
    AND: keywords.map((keyword) => {
      const DEFAULT_TRUE_VALUES = ['yes', 'true', '1']
      const DEFAULT_FALSE_VALUES = ['no', 'false', '0']

      const numericValue = Number(keyword)
      const isNumeric = !isNaN(numericValue) && keyword !== ''

      const likeKeyword = escapeLikeKeyword(keyword)

      const OR: Record<string, any>[] = [
        //* string fields
        ...stringFields.map((field) => ({ [field]: { contains: likeKeyword, mode: 'insensitive' } })),

        //* numeric fields
        ...(isNumeric ? numericFields.map((field) => ({ [field]: { equals: numericValue } })) : []),

        //* scalar list fields, matches a whole entry, so `heal` won't find the tag `health`
        ...arrayFields.map((field) => ({ [field]: { has: keyword } })),

        //* boolean fields with custom true/false values
        ...booleanFields
          .map(({ field, trueValues = DEFAULT_TRUE_VALUES, falseValues = DEFAULT_FALSE_VALUES }) => {
            if (trueValues.includes(keyword)) return { [field]: { equals: true } }
            if (falseValues.includes(keyword)) return { [field]: { equals: false } }
            return null
          })
          .filter((f): f is Record<string, any> => f !== null),

        //* relation fields
        ...relationFields.flatMap(({ relation, fields, isArray = false, relationNullable = false, where = {} }) =>
          fields.map((field) => {
            const fieldFilter = { ...where, ...toNestedFilter(field, { contains: likeKeyword, mode: 'insensitive' }) }

            return {
              [relation]: isArray
                ? { some: fieldFilter } //* one-to-many
                : relationNullable
                  ? { is: fieldFilter } //* optional one-to-one/many-to-one
                  : fieldFilter //* one-to-one/many-to-one
            }
          })
        )
      ]
      return { OR }
    })
  }
}

type RelationColumnFieldConfig<T extends keyof PModels> = {
  id: string //* the columnFilter id this config applies to (e.g. 'customerName')
  relation: keyof PModels[T]
  field: string //* field inside the relation, a dot path goes deeper (e.g. 'position.name')
  isArray?: boolean //* true for one-to-many (e.g. orders, items)
  fieldNullable?: boolean //* true when the nested field is nullable, lets (Empty) match NULL values
  relationNullable?: boolean //* true when the relation itself is optional, lets (Empty) match rows with no related row
  where?: Record<string, any> //* extra conditions on the related row (e.g. { userCode })
}

//* a nullable column takes an object so (Empty) also matches NULL, prisma rejects a bare `null` on a required column
type StringColumnFieldConfig<T extends keyof PModels> = keyof PModels[T] | { field: keyof PModels[T]; nullable?: boolean }

type ColumnFilterConfig<T extends keyof PModels> = {
  stringFields?: StringColumnFieldConfig<T>[]
  booleanFields?: { field: keyof PModels[T]; trueValues?: string[]; falseValues?: string[] }[]
  numericFields?: { field: keyof PModels[T]; nullable?: boolean }[]
  dateFields?: { field: keyof PModels[T]; nullable?: boolean }[]
  relationFields?: RelationColumnFieldConfig<T>[]
}

function resolveRelativeDate(amount: number, unit: RelativeUnit, direction: RelativeDirection) {
  const now = new Date()
  const duration = { [unit]: amount }

  const target = direction === 'past' ? sub(now, duration) : add(now, duration)

  return direction === 'past' ? { from: target, to: now } : { from: now, to: target }
}

export const buildColumnFiltersWhere = <T extends keyof PModels>(columnFilters: any[], config: ColumnFilterConfig<T>) => {
  const { stringFields = [], booleanFields = [], numericFields = [], dateFields = [], relationFields = [] } = config

  const stringConfigs = stringFields.map((f) => (typeof f === 'object' ? f : { field: f, nullable: false }))

  //* collapse a list of OR branches into a single prisma filter
  const toFilter = (branches: Record<string, any>[]) =>
    branches.length === 0 ? null : branches.length === 1 ? branches[0] : { OR: branches }

  return columnFilters
    .map(({ id, value }) => {
      //* string fields
      const stringConfig = stringConfigs.find((f) => f.field === id)

      if (stringConfig) {
        if (!Array.isArray(value) || value.length === 0) return null

        const { hasEmpty, values } = splitEmptyFilterValues(value)
        const branches: Record<string, any>[] = []

        if (values.length > 0) branches.push({ [id]: { in: values } })

        //* (Empty) matches blank strings always, NULLs only when the column is nullable
        if (hasEmpty) {
          branches.push({ [id]: { equals: '' } })
          if (stringConfig.nullable) branches.push({ [id]: { equals: null } })
        }

        return toFilter(branches)
      }

      //* relation fields (multi-select against a nested relation's field)
      const relationConfig = relationFields.find((r) => r.id === id)

      if (relationConfig) {
        if (!Array.isArray(value) || value.length === 0) return null

        const { relation, field, isArray = false, fieldNullable = false, relationNullable = false, where = {} } = relationConfig
        const { hasEmpty, values } = splitEmptyFilterValues(value)
        const branches: Record<string, any>[] = []

        const wrap = (valueFilter: Record<string, any>) => {
          const fieldFilter = { ...where, ...toNestedFilter(field, valueFilter) }

          return {
            [relation]: isArray
              ? { some: fieldFilter } //* one-to-many
              : fieldFilter //* one-to-one/many-to-one
          }
        }

        if (values.length > 0) branches.push(wrap({ in: values }))

        if (hasEmpty) {
          branches.push(wrap({ equals: '' }))
          if (fieldNullable) branches.push(wrap({ equals: null }))

          //* no related row at all also reads as empty
          if (relationNullable) branches.push({ [relation]: isArray ? { none: where } : { is: null } })
        }

        return toFilter(branches)
      }

      //* boolean fields with custom true/false values
      const booleanConfig = booleanFields.find((b) => b.field === id)

      if (booleanConfig) {
        if (!Array.isArray(value) || value.length === 0) return null

        const DEFAULT_TRUE_VALUES = ['yes', 'true', '1']
        const DEFAULT_FALSE_VALUES = ['no', 'false', '0']
        const { trueValues = DEFAULT_TRUE_VALUES, falseValues = DEFAULT_FALSE_VALUES } = booleanConfig

        const boolValues = value
          .map((v: string) => {
            const lower = v.toLowerCase()
            if (trueValues.includes(lower)) return true
            if (falseValues.includes(lower)) return false
            return null
          })
          .filter((v): v is boolean => v !== null)

        if (boolValues.length === 0) return null

        //* both true and false selected, so no filter is needed
        if (boolValues.includes(true) && boolValues.includes(false)) return null

        //* only true selected
        if (boolValues.includes(true)) return { [id]: { equals: true } }

        //* only false selected
        if (boolValues.includes(false)) return { [id]: { equals: false } }

        return null
      }

      //* numeric fields (operator based)
      const numericConfig = numericFields.find((f) => f.field === id)

      if (numericConfig) {
        const numericFilter = value as NumericFilterValue

        switch (numericFilter?.operator) {
          case 'eq':
            return numericFilter?.value != null ? { [id]: { equals: numericFilter?.value } } : null

          case 'ne':
            return numericFilter?.value != null ? { [id]: { not: { equals: numericFilter?.value } } } : null

          case 'lt':
            return numericFilter?.value != null ? { [id]: { lt: numericFilter?.value } } : null

          case 'lte':
            return numericFilter?.value != null ? { [id]: { lte: numericFilter?.value } } : null

          case 'gt':
            return numericFilter?.value != null ? { [id]: { gt: numericFilter?.value } } : null

          case 'gte':
            return numericFilter?.value != null ? { [id]: { gte: numericFilter?.value } } : null

          case 'isBetween':
            return numericFilter?.value != null && numericFilter?.valueTo != null
              ? { [id]: { gte: numericFilter?.value, lte: numericFilter?.valueTo } }
              : null

          case 'isEmpty':
            return numericConfig?.nullable ? { [id]: { equals: null } } : null

          case 'isNotEmpty':
            return numericConfig?.nullable ? { [id]: { not: { equals: null } } } : null
          default:
            return null
        }
      }

      //* inside buildColumnFiltersWhere
      const dateConfig = dateFields.find((f) => f.field === id)

      if (dateConfig) {
        const dateFilter = value as DateFilterValue

        switch (dateFilter.operator) {
          case 'eq':
            return dateFilter?.value
              ? { [id]: { gte: startOfDay(new Date(dateFilter?.value)), lte: endOfDay(new Date(dateFilter?.value)) } }
              : null

          case 'ne':
            return dateFilter?.value
              ? { NOT: { [id]: { gte: startOfDay(new Date(dateFilter?.value)), lte: endOfDay(new Date(dateFilter?.value)) } } }
              : null

          case 'lt':
            return dateFilter?.value ? { [id]: { lt: startOfDay(new Date(dateFilter?.value)) } } : null

          case 'lte':
            return dateFilter?.value ? { [id]: { lte: endOfDay(new Date(dateFilter?.value)) } } : null

          case 'gt':
            return dateFilter?.value ? { [id]: { gt: endOfDay(new Date(dateFilter?.value)) } } : null

          case 'gte':
            return dateFilter?.value ? { [id]: { gte: startOfDay(new Date(dateFilter?.value)) } } : null

          case 'isBetween':
            return dateFilter?.value && dateFilter?.valueTo
              ? { [id]: { gte: startOfDay(new Date(dateFilter?.value)), lte: endOfDay(new Date(dateFilter?.valueTo)) } }
              : null

          case 'isRelativeToToday': {
            const { amount, unit, direction } = dateFilter?.relative
            const { from, to } = resolveRelativeDate(amount, unit, direction)
            return { [id]: { gte: from, lte: to } }
          }

          case 'isEmpty':
            return dateConfig?.nullable ? { [id]: { equals: null } } : null

          case 'isNotEmpty':
            return dateConfig?.nullable ? { [id]: { not: { equals: null } } } : null

          default:
            return null
        }
      }

      return null
    })
    .filter((f) => f !== null)
}

//* the column id a relation is sorted by (e.g. 'roleName') and the nested path it maps to
type RelationSortFieldConfig<T extends keyof PModels> = { id: string; relation: keyof PModels[T]; field: string }

//* a relation column's id is an alias, prisma rejects `{ roleName: 'asc' }` and needs `{ role: { name: 'asc' } }`
export function buildOrderBy<T extends keyof PModels>(
  sorting: { id: string; desc: boolean }[],
  config?: { relationFields?: RelationSortFieldConfig<T>[] }
) {
  const { relationFields = [] } = config ?? {}

  return sorting.map(({ id, desc }) => {
    const direction = desc ? 'desc' : 'asc'
    const relationConfig = relationFields.find((relationField) => relationField.id === id)

    if (relationConfig) return { [relationConfig.relation]: { [relationConfig.field]: direction } }

    return { [id]: direction }
  })
}

//! a badge is inline-flex, so the row's line-through never reaches it, repeat it on the badge itself
export const SOFT_DELETED_ROW_CLASS_NAME =
  'line-through text-muted-foreground/75 decoration-destructive decoration-2 **:data-[slot=badge]:line-through **:data-[slot=badge]:decoration-destructive **:data-[slot=badge]:decoration-2 **:data-[slot=badge]:opacity-75'

export function getSoftDeletedRowClassName<TData extends Record<string, any>>(row: Row<TData>) {
  return row.original?.deletedAt && row.original?.deletedBy ? SOFT_DELETED_ROW_CLASS_NAME : undefined
}

export function getDataTableParams(params: DataTableParams) {
  const page = params?.page ?? DEFAULT_PAGINATION_PAGE_INDEX + 1
  const perPage = params?.perPage ?? DEFAULT_PAGINATION_PAGE_SIZE
  const offset = (page - 1) * perPage
  const globalFilter = params?.globalFilter ?? ''
  const sorting = params?.sorting ?? []
  const columnFilters = params?.columnFilters ?? []
  const isExport = params?.isExport ?? false
  const isShowDeleted = params?.isShowDeleted ?? false

  return { page, perPage, offset, globalFilter, sorting, columnFilters, isExport, isShowDeleted }
}
