import { Icon } from '@/components/icons'

export type FilterOption = { label: string; value: string; icon?: Icon }

export type DataTableViewMode = 'table' | 'card'

export type NumericOperator = 'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte' | 'isBetween' | 'isEmpty' | 'isNotEmpty'
export type NumericFilterValue = { operator: NumericOperator; value: number | null; valueTo: number | null }

export type DateOperator = 'eq' | 'ne' | 'lt' | 'gt' | 'lte' | 'gte' | 'isBetween' | 'isRelativeToToday' | 'isEmpty' | 'isNotEmpty'
export type RelativeUnit = 'days' | 'weeks' | 'months' | 'years'
export type RelativeDirection = 'past' | 'future'
export type DateFilterValue =
  | { operator: 'isEmpty' | 'isNotEmpty'; value: null; valueTo: null; relative: null }
  | { operator: 'isBetween'; value: string | null; valueTo: string | null; relative: null }
  | {
      operator: 'isRelativeToToday'
      value: null
      valueTo: null
      relative: { amount: number; unit: RelativeUnit; direction: RelativeDirection }
    }
  | {
      operator: Exclude<DateOperator, 'isEmpty' | 'isNotEmpty' | 'isBetween' | 'isRelativeToToday'>
      value: string | null
      valueTo: null
      relative: null
    }
