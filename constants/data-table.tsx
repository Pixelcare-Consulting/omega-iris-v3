import { DataTableParams } from '@/schema/data-table'
import { DateOperator, NumericOperator, RelativeDirection, RelativeUnit } from '@/types/data-table'
import { TableState } from '@tanstack/react-table'

export const NUMERIC_OPERATORS: { label: string; value: NumericOperator }[] = [
  { label: 'Is', value: 'eq' },
  { label: 'Is not', value: 'ne' },
  { label: 'Is less than', value: 'lt' },
  { label: 'Is less than or equal to', value: 'lte' },
  { label: 'Is greater than', value: 'gt' },
  { label: 'Is greater than or equal to', value: 'gte' },
  { label: 'Is between', value: 'isBetween' },
  { label: 'Is empty', value: 'isEmpty' },
  { label: 'Is not empty', value: 'isNotEmpty' }
]

export const DATE_OPERATORS: { label: string; value: DateOperator }[] = [
  { label: 'Is', value: 'eq' },
  { label: 'Is not', value: 'ne' },
  { label: 'Is before', value: 'lt' },
  { label: 'Is after', value: 'gt' },
  { label: 'Is on or before', value: 'lte' },
  { label: 'Is on or after', value: 'gte' },
  { label: 'Is between', value: 'isBetween' },
  { label: 'Is relative to today', value: 'isRelativeToToday' },
  { label: 'Is empty', value: 'isEmpty' },
  { label: 'Is not empty', value: 'isNotEmpty' }
]

export const RELATIVE_UNITS: { label: string; value: RelativeUnit }[] = [
  { label: 'Days', value: 'days' },
  { label: 'Weeks', value: 'weeks' },
  { label: 'Months', value: 'months' },
  { label: 'Years', value: 'years' }
]

export const RELATIVE_DIRECTIONS: { label: string; value: RelativeDirection }[] = [
  { label: 'Past', value: 'past' },
  { label: 'Future', value: 'future' }
]

//* Sentinel used by faceted/multi-select filters to represent null / undefined / '' cell values.
//* The UI shows EMPTY_FILTER_LABEL, the wire carries EMPTY_FILTER_VALUE, and buildColumnFiltersWhere
//* translates it back into a `null OR ''` Prisma condition.
export const EMPTY_FILTER_VALUE = '__EMPTY__'
export const EMPTY_FILTER_LABEL = '(Empty)'

export const DEFAULT_PAGINATION_PAGE_INDEX = 0
export const DEFAULT_PAGINATION_PAGE_SIZE = 10

export const DEFAULT_DATA_TABLE_PARAMS: DataTableParams = {
  page: DEFAULT_PAGINATION_PAGE_INDEX + 1,
  perPage: DEFAULT_PAGINATION_PAGE_SIZE,
  globalFilter: '',
  sorting: [{ id: 'createdAt', desc: true }],
  columnFilters: []
}

export const DEFAULT_TABLE_INITIAL_STATE: Partial<TableState> = {
  columnPinning: { right: ['actions'] },
  sorting: [{ id: 'createdAt', desc: true }]
}
