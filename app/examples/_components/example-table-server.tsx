'use client'

import { useEffect } from 'react'

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
import { ColumnDef } from '@tanstack/react-table'
import DataTableColumnFilter from '@/components/data-table/data-table-faceted-filter'
import { dateFilterFn, multiSelectFilterFn, numericFilterFn } from '@/lib/data-table'
import { DataTableActionsOptions } from '@/components/data-table/data-table-options'
import DataTableColumnNumericFilter from '@/components/data-table/data-table-column-numeric-filter'
import DataTableColumnDateFilter from '@/components/data-table/data-table-column-date-filter'
import { useAction } from 'next-safe-action/hooks'
import { getDataTableTestDataServerSideClient, seedDataTableTestDataClient } from '@/actions/example'
import { useDataTableTestDataServerSide } from '@/hooks/safe-actions/example'
import { DataTableTestData } from '@/prisma/generated/client'
import LoadingButton from '@/components/forms/button-field'
import { useDataTableServer } from '@/hooks/use-data-table-server'
import { DEFAULT_DATA_TABLE_PARAMS } from '@/constants/data-table'
import { formatDate, titleCase } from '@/lib/utils'
import { toast } from 'sonner'
import { exportToExcel } from '@/lib/xlsx'

export default function ExampleTableServer() {
  const seedDataTableTestData = useAction(seedDataTableTestDataClient)

  const DATA_TABLE_UNIQUE_KEY = 'test-data'

  const columns: ColumnDef<DataTableTestData>[] = [
    {
      accessorKey: 'createdAt',
      filterFn: dateFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Date' />,
      cell: ({ row: { original: data } }) => <DataTableDateCell value={data.createdAt} />,
      meta: { title: 'Date', exportValue: (row) => formatDate(new Date(row.createdAt), 'yyyy-MM-dd HH:mm:ss') }
    },
    {
      accessorKey: 'customer',
      filterFn: multiSelectFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Customer' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.customer} highlight={table.getState().globalFilter} />,
      meta: { title: 'Customer', exportValue: (row) => row.customer }
    },
    {
      accessorKey: 'email',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Email' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.email} highlight={table.getState().globalFilter} />,
      meta: { title: 'Email', exportValue: (row) => row.email }
    },
    {
      accessorKey: 'status',
      filterFn: multiSelectFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Status' />,
      cell: ({ row: { original: data } }) => (
        <DataTableBadgeCell
          value={data.status}
          variantMap={{ pending: 'soft-slate', processing: 'soft-blue', success: 'soft-green', failed: 'soft-red' }}
          highlight={table.getState().globalFilter}
        />
      ),
      meta: {
        title: 'Status',
        options: [
          { label: 'Pending', value: 'pending' },
          { label: 'Processing', value: 'processing' },
          { label: 'Success', value: 'success' },
          { label: 'Failed', value: 'failed' }
        ],
        exportValue: (row) => titleCase(row.status)
      }
    },
    {
      accessorFn: (row) => (row?.isValid ? 'Yes' : 'No'),
      accessorKey: 'isValid',
      filterFn: multiSelectFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Valid' />,
      cell: ({ row: { original: data } }) => (
        <DataTableBooleanCell
          value={data.isValid}
          display={{ type: 'text', true: 'Yes', false: 'No' }}
          highlight={table.getState().globalFilter}
        />
      ),
      meta: {
        title: 'Valid',
        options: [
          { label: 'Yes', value: 'Yes' },
          { label: 'No', value: 'No' }
        ],
        exportValue: (row) => (row.isValid ? 'Yes' : 'No')
      }
    },
    {
      accessorKey: 'link',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Link' />,
      cell: ({ row: { original: data } }) => <DataTableLinkCell href={data.link} external highlight={table.getState().globalFilter} />,
      meta: { title: 'Link', exportValue: (row) => row.link }
    },
    {
      accessorKey: 'amount',
      filterFn: numericFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Amount' />,
      cell: ({ row: { original: data } }) => (
        <DataTableNumberCell value={data.amount} prefix='PHP' highlight={table.getState().globalFilter} />
      ),
      meta: { title: 'Amount', exportValue: (row) => row.amount }
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

  const { table, params, setData, setRowCount } = useDataTableServer({
    columns,
    initialState: { columnPinning: { right: ['actions'] } },
    getRowId: (row) => row.id
  })

  const dataTableTestDataSvr = useDataTableTestDataServerSide(params, { setData, setRowCount })
  const dataTableTestDataSvrExport = useAction(getDataTableTestDataServerSideClient)

  const handleSeedData = async () => {
    await seedDataTableTestData.executeAsync()
    dataTableTestDataSvr.execute(DEFAULT_DATA_TABLE_PARAMS)
  }

  const handleRefreshData = () => {
    dataTableTestDataSvr.execute(DEFAULT_DATA_TABLE_PARAMS)
  }

  const handleExport = async () => {
    const visibleColumns = table.getVisibleLeafColumns().filter((column) => column.id !== 'actions' && column.columnDef.meta?.exportValue)

    if (visibleColumns.length === 0) {
      toast.error('No columns available to export!')
      return
    }

    const headers = visibleColumns.map((column) => column.columnDef.meta?.title ?? column.id)

    toast.promise(dataTableTestDataSvrExport.executeAsync({ ...params, isExport: true }), {
      loading: 'Preparing export...',
      success: (response) => {
        const result = response?.data

        if (!response || !result) throw { message: 'Failed to export test data!', unExpectedError: true }

        const rows = result.data.map((row) => visibleColumns.map((column) => column.columnDef.meta!.exportValue!(row)))

        exportToExcel({
          fileName: `${DATA_TABLE_UNIQUE_KEY.toUpperCase()}-${formatDate(new Date(), 'yyyy-MM-dd-HHmmss')}.xlsx`,
          sheetName: 'EXPORTED_DATA',
          headers,
          rows
        })

        return 'Users exported successfully!'
      },
      error: (err: Error & { expectedError: boolean }) => {
        return err?.expectedError ? err.message : 'Something went wrong! Please try again later.'
      }
    })
  }

  //* Note: when setting height just set height of DataTableContainer e.g. h-125
  //? Idea: you can also pass or add props data to DataTableColumnFilter, DataTableColumnNumericFilter, DataTableColumnDateFilter - data from database
  return (
    <DataTableContainer className='h-full'>
      <div className='flex w-full items-center gap-2'>
        <LoadingButton variant='outline' onClick={handleSeedData} isLoading={seedDataTableTestData.isExecuting} loadingText='Seeding'>
          <Icons.database /> Seed
        </LoadingButton>

        <LoadingButton variant='outline' onClick={handleRefreshData} isLoading={dataTableTestDataSvr.isLoading} loadingText='Refreshing'>
          <Icons.database /> Refresh
        </LoadingButton>

        <LoadingButton variant='outline' onClick={handleExport} isLoading={dataTableTestDataSvrExport.isExecuting} loadingText='Exporting'>
          <Icons.download /> Export
        </LoadingButton>
      </div>

      <DataTableToolbar>
        <div className='flex flex-col justify-center gap-1.5 *:w-full md:justify-start lg:flex-row lg:flex-wrap lg:items-center lg:*:w-auto'>
          <DataTableGlobalSearch table={table} isLoading={dataTableTestDataSvr.isLoading} />
          <DataTableColumnFilter
            column={table.getColumn('customer')}
            title='Customer'
            isLoading={dataTableTestDataSvr.isLoading}
            isFaceted
          />
          <DataTableColumnFilter column={table.getColumn('status')} title='Status' isLoading={dataTableTestDataSvr.isLoading} />
          <DataTableColumnFilter column={table.getColumn('isValid')} title='Valid' isLoading={dataTableTestDataSvr.isLoading} />
          <DataTableColumnNumericFilter column={table.getColumn('amount')} title='Amount' isLoading={dataTableTestDataSvr.isLoading} />
          <DataTableColumnDateFilter column={table.getColumn('createdAt')} title='Date' isLoading={dataTableTestDataSvr.isLoading} />
        </div>

        <div className='flex flex-col justify-center gap-1.5 *:w-full md:justify-start lg:flex-row lg:flex-wrap lg:items-center lg:*:w-auto'>
          <DataTableViewOptions table={table} />
          <DataTableActionsOptions table={table} />
        </div>
      </DataTableToolbar>

      <DataTable table={table} isLoading={dataTableTestDataSvr.isLoading} isServerSide />
    </DataTableContainer>
  )
}
