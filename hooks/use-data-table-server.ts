import { DEFAULT_PAGINATION_PAGE_INDEX, DEFAULT_PAGINATION_PAGE_SIZE } from '@/constants/data-table'
import {
  ColumnFiltersState,
  ColumnPinningState,
  getCoreRowModel,
  getExpandedRowModel,
  getFacetedMinMaxValues,
  getFacetedRowModel,
  getFacetedUniqueValues,
  PaginationState,
  RowSelectionState,
  SortingState,
  TableOptions,
  TableState,
  useReactTable,
  VisibilityState
} from '@tanstack/react-table'
import { useState } from 'react'

type UseDataTableProps<TData> = Omit<TableOptions<TData>, 'getCoreRowModel' | 'data' | 'rowCount'> & {
  initialState?: Partial<TableState>
  initialIsShowDeleted?: boolean
}

export function useDataTableServer<TData>(props: UseDataTableProps<TData>) {
  const { initialState = {}, initialIsShowDeleted = false, ...rest } = props

  const [data, setData] = useState<TData[]>([])
  const [rowCount, setRowCount] = useState(0)
  const [isShowDeleted, setIsShowDeleted] = useState<boolean>(initialIsShowDeleted)
  const [refreshKey, setRefreshKey] = useState(0)

  const [rowSelection, setRowSelection] = useState<RowSelectionState>(initialState.rowSelection ?? {})
  const [sorting, setSorting] = useState<SortingState>(initialState.sorting ?? [])
  const [pagination, setPagination] = useState<PaginationState>(initialState.pagination ?? { pageIndex: DEFAULT_PAGINATION_PAGE_INDEX, pageSize: DEFAULT_PAGINATION_PAGE_SIZE }) // prettier-ignore

  const [globalFilter, setGlobalFilter] = useState<string>(initialState.globalFilter ?? '')
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(initialState.columnFilters ?? [])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(initialState.columnVisibility ?? {})
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>(initialState.columnPinning ?? {})

  const table = useReactTable({
    ...rest,
    data,
    rowCount,
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
    getExpandedRowModel: getExpandedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    enableMultiSort: true,
    isMultiSortEvent: () => true, //* always multi-sort on click, no Shift needed
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true
  })

  const params = {
    page: pagination.pageIndex + 1,
    perPage: pagination.pageSize,
    globalFilter,
    sorting,
    columnFilters,
    isShowDeleted
  }

  //! every slice of table state is controlled here, so TanStack's `table.reset()` is a no-op
  const resetTable = () => {
    setRowSelection(initialState.rowSelection ?? {})
    setSorting(initialState.sorting ?? [])
    setPagination(initialState.pagination ?? { pageIndex: DEFAULT_PAGINATION_PAGE_INDEX, pageSize: DEFAULT_PAGINATION_PAGE_SIZE }) // prettier-ignore
    setGlobalFilter(initialState.globalFilter ?? '')
    setColumnFilters(initialState.columnFilters ?? [])
    setColumnVisibility(initialState.columnVisibility ?? {})
    setColumnPinning(initialState.columnPinning ?? {})
  }

  //* `refreshKey` is fed to the fetch hook's `dependencies` so a refetch still fires when the reset leaves `params` untouched
  const refetch = () => setRefreshKey((key) => key + 1)

  //* the Refresh button, clear the table back to its initial state, then refetch in the same batched render
  const refreshTable = () => {
    resetTable()
    refetch()
  }

  return { table, params, setData, setRowCount, isShowDeleted, setIsShowDeleted, refreshKey, refetch, resetTable, refreshTable }
}
