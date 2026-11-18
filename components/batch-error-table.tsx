'use client'

import { useMemo } from 'react'
import { ColumnDef } from '@tanstack/react-table'

import { DataTable } from '@/components/data-table/data-table'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import DataTableGlobalSearch from '@/components/data-table/data-table-global-search'
import DataTableContainer from '@/components/data-table/data-table-container'
import { DataTableTextCell } from '@/components/data-table/data-table-column-cell'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { useDataTableClient } from '@/hooks/use-data-table-client'
import { BatchError } from '@/types/batch'

type BatchErrorTableRow = {
  id: string
  label: string
  field: string
  message: string
  count: number
  subRows?: BatchErrorTableRow[]
}

type BatchErrorTableProps = { errors: BatchError[]; labelTitle: string }

export default function BatchErrorTable({ errors, labelTitle }: BatchErrorTableProps) {
  const columns = useMemo<ColumnDef<BatchErrorTableRow>[]>(
    () => [
      {
        accessorKey: 'label',
        header: ({ column }) => <DataTableColumnHeader column={column} title={labelTitle} />,
        cell: ({ row }) => {
          //* sub-rows only fill field and message
          if (row.depth > 0) return null

          const { label, count } = row.original
          const isExpanded = row.getIsExpanded()

          return (
            <Button type='button' variant='ghost' size='sm' onClick={row.getToggleExpandedHandler()}>
              {isExpanded ? <Icons.down className='size-4' /> : <Icons.right className='size-4' />}
              <span className='font-medium'>{label}</span>
              <span className='text-muted-foreground text-xs'>
                {count} {count === 1 ? 'error' : 'errors'}
              </span>
            </Button>
          )
        },
        enableSorting: false
      },
      {
        accessorKey: 'field',
        header: ({ column }) => <DataTableColumnHeader column={column} title='Field' />,
        cell: ({ row }) => (row.depth > 0 ? <DataTableTextCell value={row.original.field} isWrap /> : null),
        maxSize: 200,
        enableSorting: false
      },
      {
        accessorKey: 'message',
        header: ({ column }) => <DataTableColumnHeader column={column} title='Message' />,
        cell: ({ row }) => (row.depth > 0 ? <DataTableTextCell value={row.original.message} isWrap /> : null),
        minSize: 200,
        maxSize: 400,
        enableSorting: false
      }
    ],
    [labelTitle]
  )

  //* each entry becomes a sub-row under its record
  const data = useMemo<BatchErrorTableRow[]>(
    () =>
      errors.map(({ key, label, entries }) => ({
        id: key,
        label,
        field: '',
        message: '',
        count: entries.length,
        subRows: entries.map((entry, i) => ({ id: `${key}-${i}`, label, ...entry, count: 0 }))
      })),
    [errors]
  )

  const { table } = useDataTableClient({
    data,
    columns,
    getRowId: (row) => row.id,
    getSubRows: (row) => row.subRows,
    filterFromLeafRows: true,
    //* page by record, so an expanded one keeps all its errors on the same page
    paginateExpandedRows: false
  })

  return (
    <DataTableContainer className='h-105 flex-none'>
      <DataTableGlobalSearch table={table} />
      <DataTable table={table} />
    </DataTableContainer>
  )
}
