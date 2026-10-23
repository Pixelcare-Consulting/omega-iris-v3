'use client'

import { flexRender, Row, type Table as TanstackTable } from '@tanstack/react-table'
import { useEffect, useRef, useState } from 'react'

import { DataTablePagination } from './data-table-pagination'
import { getCommonPinningStyles } from '@/lib/data-table'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Icons } from '../icons'
import EmptyState from '../empty-state'
import { useIsClient } from 'usehooks-ts'
import { ScrollArea } from '../ui/scroll-area'
import { cn } from '@/lib/utils'

//* the loading and empty placeholders never grow past this, however tall the page lets the table be
const MAX_PLACEHOLDER_HEIGHT = 480

type DataTableProps<TData> = {
  table: TanstackTable<TData>
  isLoading?: boolean
  isServerSide?: boolean
  getRowClassName?: (row: Row<TData>) => string | undefined
  paginationClassName?: string
}

export function DataTable<TData>({ table, isLoading, isServerSide, getRowClassName, paginationClassName }: DataTableProps<TData>) {
  const isMounted = useIsClient()

  const wrapperRef = useRef<HTMLDivElement>(null)
  const theadRef = useRef<HTMLTableSectionElement>(null)
  const paginationRef = useRef<HTMLDivElement>(null)

  const [bodyHeight, setBodyHeight] = useState(0)

  //* work out the height of the table body
  useEffect(() => {
    const wrapper = wrapperRef.current

    if (!wrapper) return

    const calc = () => {
      const theadH = theadRef.current?.clientHeight ?? 0
      const paginationH = paginationRef.current?.clientHeight ?? 0

      const next = wrapper.clientHeight - theadH - paginationH - 18 //* 2px borders plus 16px top and bottom padding

      setBodyHeight((prev) => {
        const clamped = Math.min(Math.max(next, 0), MAX_PLACEHOLDER_HEIGHT)
        return Math.abs(clamped - prev) <= 1 ? prev : clamped
      })
    }

    calc()

    let lastWidth = wrapper.clientWidth

    //! a height change never recomputes, on an auto-height page it would grow the wrapper and climb on every frame
    const observer = new ResizeObserver(() => {
      if (wrapper.clientWidth === lastWidth) return

      lastWidth = wrapper.clientWidth
      calc()
    })

    observer.observe(wrapper)
    window.addEventListener('resize', calc)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', calc)
    }
  }, [isMounted])

  if (!isMounted) return null

  //! hide the columns with no rows, their min widths scroll the table and push the placeholder off center
  const hasRows = !isLoading && table.getRowModel().rows.length > 0

  //* this div must fill whatever height the parent gives it
  //* px-2.5 keeps the scrollbar from being hidden
  return (
    <div ref={wrapperRef} className='flex min-h-0 flex-1 flex-col gap-2.5 rounded-md border'>
      <ScrollArea className='min-h-0 flex-1 px-2' type='auto'>
        <Table className='text-sm'>
          {hasRows && (
            <TableHeader ref={theadRef} className='bg-background sticky top-0 z-10'>
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
            {isLoading ? (
              <TableRow>
                <TableCell>
                  {/*  Use the calculated height so the spinner is vertically centred */}
                  <div style={{ height: bodyHeight || 320 }} className='flex w-full items-center justify-center gap-2'>
                    <Icons.spinner className='animate-spin' />
                    <h3 className='text-base font-semibold'>Loading...</h3>
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
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
              ))
            ) : (
              <TableRow>
                <TableCell className='h-80 text-center'>
                  {/*  Use the calculated height so the placeholder is vertically centred */}
                  <EmptyState
                    title='No results found'
                    description='Try adjusting your search or filters.'
                    style={{ height: bodyHeight || 320 }}
                    className='min-h-0'
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ScrollArea>

      {!isLoading && (
        <div ref={paginationRef} className={cn('bg-background sticky bottom-0 flex flex-col gap-2.5 px-2', paginationClassName)}>
          <DataTablePagination table={table} isServerSide={isServerSide} />
        </div>
      )}
    </div>
  )
}
