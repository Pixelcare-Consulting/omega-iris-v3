'use client'

import { type Table } from '@tanstack/react-table'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Icons } from '../icons'
import { TooltipWrapper } from '../tooltip-wrapper'
import { cn } from '@/lib/utils'

type DataTablePaginationProps<TData> = {
  table: Table<TData>
  pageSizeOptions?: number[]
  isServerSide?: boolean
  isCompact?: boolean
  className?: string
}

export function DataTablePagination<TData>({
  table,
  pageSizeOptions = [5, 10, 20, 30, 40, 50],
  isServerSide,
  isCompact,
  className
}: DataTablePaginationProps<TData>) {
  const rowCount = isServerSide ? table.getRowCount() : table.getFilteredRowModel().rows.length

  return (
    <div
      className={cn(
        'flex w-full flex-col-reverse items-center justify-between gap-4 overflow-auto p-1 sm:flex-row sm:gap-8',
        isCompact && 'w-auto shrink-0 flex-row gap-2 overflow-visible p-0 sm:gap-2',
        className
      )}
    >
      <div className='flex items-center space-x-2'>
        {!isCompact && <p className='text-sm font-medium whitespace-nowrap'>Rows per page</p>}
        <Select
          value={`${table.getState().pagination.pageSize}`}
          onValueChange={(value) => {
            table.setPageSize(Number(value))
          }}
        >
          {isCompact ? (
            <TooltipWrapper label='Rows per page'>
              <SelectTrigger className='h-8 w-18'>
                <SelectValue placeholder={table.getState().pagination.pageSize} />
              </SelectTrigger>
            </TooltipWrapper>
          ) : (
            <SelectTrigger className='h-8 w-18'>
              <SelectValue placeholder={table.getState().pagination.pageSize} />
            </SelectTrigger>
          )}
          <SelectContent className='min-w-20' side={isCompact ? 'bottom' : 'top'}>
            {pageSizeOptions.map((pageSize) => (
              <SelectItem key={pageSize} value={`${pageSize}`}>
                {pageSize}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div
        className={cn(
          'flex flex-col-reverse items-center gap-4 sm:flex-row sm:gap-6 lg:gap-8',
          isCompact && 'flex-row gap-2 sm:gap-2 lg:gap-2'
        )}
      >
        <div className={cn('flex items-center justify-center text-sm font-medium whitespace-nowrap', isCompact && 'hidden sm:flex')}>
          {isCompact ? (
            <>
              {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
              <span className='text-muted-foreground ml-1 font-normal'>({rowCount})</span>
            </>
          ) : (
            <>
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()} ({rowCount} items)
            </>
          )}
        </div>
        <div className='flex items-center space-x-2'>
          <Button
            aria-label='Go to first page'
            variant='outline'
            className='hidden size-8 p-0 lg:flex'
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <Icons.doubleLeft className='size-4' aria-hidden='true' />
          </Button>
          <Button
            aria-label='Go to previous page'
            variant='outline'
            size='icon'
            className='size-8'
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <Icons.left className='size-4' aria-hidden='true' />
          </Button>
          <Button
            aria-label='Go to next page'
            variant='outline'
            size='icon'
            className='size-8'
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <Icons.right className='size-4' aria-hidden='true' />
          </Button>
          <Button
            aria-label='Go to last page'
            variant='outline'
            size='icon'
            className='hidden size-8 lg:flex'
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <Icons.doubleRight className='size-4' aria-hidden='true' />
          </Button>
        </div>
      </div>
    </div>
  )
}
