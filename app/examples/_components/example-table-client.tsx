'use client'

import { DataTable } from '@/components/data-table/data-table'
import {
  DataTableActionsCellWrapper,
  DataTableBadgeCell,
  DataTableBooleanCell,
  DataTableDateCell,
  DataTableLinkCell,
  DataTableNumberCell,
  DataTableTextCell
} from '@/components/data-table/data-table-column-cell'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import DataTableContainer from '@/components/data-table/data-table-container'
import DataTableGlobalSearch from '@/components/data-table/data-table-global-search'
import DataTableToolbar from '@/components/data-table/data-table-toolbar'
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { useDataTableClient } from '@/hooks/use-data-table-client'
import { ColumnDef } from '@tanstack/react-table'
import DataTableColumnFilter from '@/components/data-table/data-table-faceted-filter'
import { dateFilterFn, multiSelectFilterFn, numericFilterFn } from '@/lib/data-table'
import { DataTableActionsOptions } from '@/components/data-table/data-table-options'
import DataTableColumnNumericFilter from '@/components/data-table/data-table-column-numeric-filter'
import DataTableColumnDateFilter from '@/components/data-table/data-table-column-date-filter'
import { useAction } from 'next-safe-action/hooks'
import { seedDataTableTestDataClient } from '@/actions/example'
import { useDataTableTestDataClientSide } from '@/hooks/safe-actions/example'
import { DataTableTestData } from '@/prisma/generated/client'
import LoadingButton from '@/components/forms/button-field'

export default function ExampleTableClient() {
  const { data, isLoading, execute } = useDataTableTestDataClientSide()

  const seedDataTableTestData = useAction(seedDataTableTestDataClient)

  const columns: ColumnDef<DataTableTestData>[] = [
    {
      accessorKey: 'createdAt',
      filterFn: dateFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Date' />,
      cell: ({ row: { original: data } }) => <DataTableDateCell value={data.createdAt} />,
      meta: { title: 'Date' }
    },
    {
      accessorKey: 'customer',
      filterFn: multiSelectFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Customer' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.customer} />,
      meta: { title: 'Customer' }
    },
    {
      accessorKey: 'email',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Email' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.email} />,
      meta: { title: 'Email' }
    },
    {
      accessorKey: 'status',
      filterFn: multiSelectFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Status' />,
      cell: ({ row: { original: data } }) => (
        <DataTableBadgeCell
          value={data.status}
          variantMap={{ pending: 'soft-slate', processing: 'soft-blue', success: 'soft-green', failed: 'soft-red' }}
        />
      ),
      meta: { title: 'Status' }
    },
    {
      accessorFn: (row) => (row?.isValid ? 'Yes' : 'No'),
      accessorKey: 'isValid',
      filterFn: multiSelectFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Valid' />,
      cell: ({ row: { original: data } }) => (
        <DataTableBooleanCell value={data.isValid} display={{ type: 'text', true: 'Yes', false: 'No' }} />
      ),
      meta: {
        title: 'Valid',
        options: [
          { label: 'Yes', value: 'Yes' },
          { label: 'No', value: 'No' }
        ]
      }
    },
    {
      accessorKey: 'link',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Link' />,
      cell: ({ row: { original: data } }) => <DataTableLinkCell href={data.link} external />,
      meta: { title: 'Link' }
    },
    {
      accessorKey: 'amount',
      filterFn: numericFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Amount' />,
      cell: ({ row: { original: data } }) => <DataTableNumberCell value={data.amount} prefix='PHP' />,
      meta: { title: 'Amount' }
    },
    {
      accessorKey: 'actions',
      enableSorting: false,
      enableHiding: false,
      minSize: 140,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Actions' className='text-center' />,
      cell: () => (
        <DataTableActionsCellWrapper>
          <Button variant='ghost' size='icon-sm'>
            <Icons.eye className='text-muted-foreground' />
          </Button>
          <Button variant='ghost' size='icon-sm'>
            <Icons.pencil className='text-muted-foreground' />
          </Button>
          <Button variant='ghost' size='icon-sm'>
            <Icons.trash className='text-destructive' />
          </Button>
        </DataTableActionsCellWrapper>
      )
    }
  ]

  const { table } = useDataTableClient({
    data,
    columns,
    initialState: { columnPinning: { right: ['actions'] } },
    getRowId: (row) => row.id
  })

  const handleSeedData = async () => {
    await seedDataTableTestData.executeAsync()
    execute()
  }

  const handleRefreshData = () => {
    execute()
  }

  //* Note: when setting height just set height of DataTableContainer e.g. h-125
  return (
    <DataTableContainer>
      <DataTableToolbar>
        <div className='flex flex-col justify-center gap-1.5 *:w-full md:justify-start lg:flex-row lg:flex-wrap lg:items-center lg:*:w-auto'>
          <DataTableGlobalSearch table={table} />
          <DataTableColumnFilter column={table.getColumn('customer')} title='Customer' isFaceted />
          <DataTableColumnFilter column={table.getColumn('status')} title='Status' isFaceted />
          <DataTableColumnFilter column={table.getColumn('isValid')} title='Valid' />
          <DataTableColumnNumericFilter column={table.getColumn('amount')} title='Amount' />
          <DataTableColumnDateFilter column={table.getColumn('createdAt')} title='Date' />

          <LoadingButton variant='outline' onClick={handleSeedData} isLoading={seedDataTableTestData.isExecuting} loadingText='Seeding'>
            <Icons.database /> Seed
          </LoadingButton>

          <LoadingButton variant='outline' onClick={handleRefreshData} isLoading={isLoading} loadingText='Refreshing'>
            <Icons.database /> Refresh
          </LoadingButton>
        </div>

        <div className='flex flex-col justify-center gap-1.5 *:w-full md:justify-start lg:flex-row lg:flex-wrap lg:items-center lg:*:w-auto'>
          <DataTableViewOptions table={table} />
          <DataTableActionsOptions table={table} />
        </div>
      </DataTableToolbar>

      <DataTable table={table} isLoading={isLoading} />
    </DataTableContainer>
  )
}
