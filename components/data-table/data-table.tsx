'use client'

import { flexRender, Row, type Table as TanstackTable } from '@tanstack/react-table'

import { DataTablePagination } from './data-table-pagination'
import { getCommonPinningStyles } from '@/lib/data-table'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Icons } from '../icons'
import EmptyState from '../empty-state'
import { useIsClient } from 'usehooks-ts'
import { ScrollArea } from '../ui/scroll-area'
import { cn } from '@/lib/utils'

type DataTableProps<TData> = {
  table: TanstackTable<TData>
  isLoading?: boolean
  isServerSide?: boolean
  getRowClassName?: (row: Row<TData>) => string | undefined
  paginationClassName?: string
}

export function DataTable<TData>({ table, isLoading, isServerSide, getRowClassName, paginationClassName }: DataTableProps<TData>) {
  const isMounted = useIsClient()

  if (!isMounted) return null

  //! hide the columns with no rows, their min widths scroll the table and push the placeholder off center
  const hasRows = !isLoading && table.getRowModel().rows.length > 0

  //* this div must fill whatever height the parent gives it
  //* px-2.5 keeps the scrollbar from being hidden
  //* with no rows the scroll area only holds the header, the placeholder below takes the rest and centers in it
  return (
    <div className='flex min-h-0 flex-1 flex-col gap-2.5 rounded-md border'>
      <ScrollArea className={cn('min-h-0 px-2', hasRows ? 'flex-1' : 'shrink-0')} type='auto'>
        <Table className='text-sm'>
          {hasRows && (
            <TableHeader className='bg-background sticky top-0 z-10'>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      style={{
                        ...getCommonPinningStyles({ column: header.column, withBorder: true }),
                        minWidth: header.column.columnDef.minSize,
                        maxWidth: header.column.columnDef.maxSize
                      }}
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
          )}

          <TableBody>
            {hasRows &&
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'} className={getRowClassName?.(row)}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      style={{
                        ...getCommonPinningStyles({ column: cell.column, withBorder: true }),
                        minWidth: cell.column.columnDef.minSize,
                        maxWidth: cell.column.columnDef.maxSize
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </ScrollArea>

      {!hasRows && (
        <div className='flex min-h-80 flex-1 items-center justify-center'>
          {isLoading ? (
            <div className='flex items-center justify-center gap-2'>
              <Icons.spinner className='animate-spin' />
              <h3 className='text-base font-semibold'>Loading...</h3>
            </div>
          ) : (
            <EmptyState title='No results found' description='Try adjusting your search or filters.' className='min-h-0' />
          )}
        </div>
      )}

      {!isLoading && (
        <div className={cn('bg-background sticky bottom-0 flex flex-col gap-2.5 px-2', paginationClassName)}>
          <DataTablePagination table={table} isServerSide={isServerSide} />
        </div>
      )}
    </div>
  )
}
