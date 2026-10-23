import { globalSearchFilterFn } from '@/lib/data-table'
import {
  ColumnFiltersState,
  ColumnPinningState,
  getCoreRowModel,
  getExpandedRowModel,
  getFacetedMinMaxValues,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getGroupedRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  PaginationState,
  RowSelectionState,
  SortingState,
  TableOptions,
  TableState,
  useReactTable,
  VisibilityState
} from '@tanstack/react-table'
import { useState } from 'react'

type UseDataTableProps<TData> = Omit<TableOptions<TData>, 'getCoreRowModel'> & { initialState?: Partial<TableState> }

export function useDataTableClient<TData>(props: UseDataTableProps<TData>) {
  const { initialState = {}, ...rest } = props

  const [rowSelection, setRowSelection] = useState<RowSelectionState>(initialState.rowSelection ?? {})
  const [sorting, setSorting] = useState<SortingState>(initialState.sorting ?? [])
  const [pagination, setPagination] = useState<PaginationState>(initialState.pagination ?? { pageIndex: 0, pageSize: 10 })

  const [globalFilter, setGlobalFilter] = useState<string>(initialState.globalFilter ?? '')
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(initialState.columnFilters ?? [])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(initialState.columnVisibility ?? {})
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>(initialState.columnPinning ?? {})

  const table = useReactTable({
    ...rest,
    state: {
      rowSelection,
      columnFilters,
      columnVisibility,
      sorting,
      pagination,
      columnPinning,
      globalFilter
    },
    onRowSelectionChange: setRowSelection,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnPinningChange: setColumnPinning,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    globalFilterFn: 'includesString',
    enableMultiSort: true,
    isMultiSortEvent: () => true //* always multi-sort on click, without needing to hold Shift,
  })

  return { table, rowSelection, sorting, pagination, globalFilter, columnFilters, columnVisibility, columnPinning }
}
