'use client'

import { useRouter } from 'next/navigation'
import { ColumnDef } from '@tanstack/react-table'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'

import { getDataTableInboundsSvrClient, InboundListRow } from '@/actions/inbound'
import { useDataTableInboundsSvr } from '@/hooks/safe-actions/inbound'
import { useDataTableServer } from '@/hooks/use-data-table-server'
import Header from '@/components/header'
import ContentWrapper from '@/components/content-wrapper'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { TooltipWrapper } from '@/components/tooltip-wrapper'
import CanView from '@/components/rbac/can-view'
import RelationLink from '@/components/relation-link'
import { DataTable } from '@/components/data-table/data-table'
import {
  DataTableActionsCellWrapper,
  DataTableBadgeCell,
  DataTableBooleanCell,
  DataTableDateCell,
  DataTableNumberCell,
  DataTableTextCell
} from '@/components/data-table/data-table-column-cell'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import DataTableContainer from '@/components/data-table/data-table-container'
import DataTableToolbar from '@/components/data-table/data-table-toolbar'
import DataTableColumnFilterWrapper from '@/components/data-table/data-table-column-filter-wrapper'
import DataTableGlobalSearch from '@/components/data-table/data-table-global-search'
import DataTableColumnFilter from '@/components/data-table/data-table-faceted-filter'
import DataTableColumnDateFilter from '@/components/data-table/data-table-column-date-filter'
import DataTableRefreshButton from '@/components/data-table/data-table-refresh-button'
import DataTableExportButton from '@/components/data-table/data-table-export-button'
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options'
import { DataTableActionsOptions } from '@/components/data-table/data-table-options'
import { DataTablePagination } from '@/components/data-table/data-table-pagination'
import { DEFAULT_TABLE_INITIAL_STATE } from '@/constants/data-table'
import { INBOUND_STATUS_CONFIG, INBOUND_STATUS_OPTIONS } from '@/constants/inbound'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { dateFilterFn, multiSelectFilterFn } from '@/lib/data-table'
import { formatDate } from '@/lib/utils'
import { exportToExcel } from '@/lib/xlsx'
import { FilterOption } from '@/types/data-table'

type InboundContentProps = { siteOptions: FilterOption[]; userOptions: FilterOption[]; projectOptions: FilterOption[] }

const toDateText = (date: Date | null) => (date ? formatDate(new Date(date), 'yyyy-MM-dd HH:mm:ss') : '')

export default function InboundContent({ siteOptions, userOptions, projectOptions }: InboundContentProps) {
  const router = useRouter()

  const DATA_TABLE_UNIQUE_KEY = 'inbounds'

  const dataTableInboundsSvrExport = useAction(getDataTableInboundsSvrClient)

  const columns: ColumnDef<InboundListRow>[] = [
    {
      accessorKey: 'code',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Code' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.code} highlight={table.getState().globalFilter} />,
      meta: { title: 'Code', exportValue: (row) => row.code }
    },
    {
      accessorKey: 'status',
      filterFn: multiSelectFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Status' />,
      cell: ({ row: { original: data } }) => {
        const status = INBOUND_STATUS_CONFIG[data.status]
        return <DataTableBadgeCell value={status.label} variant={status.variant} />
      },
      meta: { title: 'Status', options: INBOUND_STATUS_OPTIONS, exportValue: (row) => INBOUND_STATUS_CONFIG[row.status].label }
    },
    {
      accessorKey: 'sessionCode',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Session' />,
      cell: ({ row: { original: data } }) => (
        <RelationLink href={`/sessions/${encodeURIComponent(data.sessionCode)}/view`}>
          <DataTableTextCell value={data.sessionCode} highlight={table.getState().globalFilter} />
        </RelationLink>
      ),
      meta: { title: 'Session', exportValue: (row) => row.sessionCode }
    },
    {
      //* a relation column, the server can't sort it by this id
      id: 'userName',
      accessorFn: (row) => row.session.user.name,
      enableSorting: false,
      filterFn: multiSelectFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='User' />,
      cell: ({ row: { original: data } }) => (
        <RelationLink href={`/users/${data.session.user.code}/view`}>
          <DataTableTextCell value={data.session.user.name} highlight={table.getState().globalFilter} />
        </RelationLink>
      ),
      meta: { title: 'User', options: userOptions, exportValue: (row) => row.session.user.name }
    },
    {
      id: 'siteCode',
      accessorFn: (row) => `${row.session.site.code} (${row.session.site.name})`,
      enableSorting: false,
      filterFn: multiSelectFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Site' />,
      cell: ({ row: { original: data } }) => (
        <RelationLink href={`/sites/${encodeURIComponent(data.session.site.code)}/view`}>
          <DataTableTextCell value={data.session.site.code} />
        </RelationLink>
      ),
      meta: { title: 'Site', options: siteOptions, exportValue: (row) => `${row.session.site.code} (${row.session.site.name})` }
    },
    {
      accessorKey: 'locationCode',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Location' />,
      cell: ({ row: { original: data } }) => {
        if (!data.location) return '—'

        return (
          <RelationLink href={`/locations/${encodeURIComponent(data.location.code)}/view`}>
            <DataTableTextCell value={data.location.code} highlight={table.getState().globalFilter} />
          </RelationLink>
        )
      },
      meta: { title: 'Location', exportValue: (row) => (row.location ? `${row.location.code} (${row.location.name})` : '') }
    },
    {
      accessorKey: 'customerProjectCode',
      filterFn: multiSelectFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Customer Project' />,
      cell: ({ row: { original: data } }) => {
        if (!data.customerProject) return '—'

        return (
          <RelationLink href={`/customer-projects/${encodeURIComponent(data.customerProject.code)}/view`}>
            <DataTableTextCell value={data.customerProject.code} highlight={table.getState().globalFilter} />
          </RelationLink>
        )
      },
      meta: {
        title: 'Customer Project',
        options: projectOptions,
        exportValue: (row) => (row.customerProject ? `${row.customerProject.code} (${row.customerProject.name})` : '')
      }
    },
    {
      accessorKey: 'poNum',
      header: ({ column }) => <DataTableColumnHeader column={column} title='PO' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.poNum} highlight={table.getState().globalFilter} />,
      meta: { title: 'PO', exportValue: (row) => row.poNum ?? '' }
    },
    {
      accessorKey: 'isPartialReceived',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Partial' />,
      cell: ({ row: { original: data } }) => (
        <DataTableBooleanCell value={data.isPartialReceived} display={{ type: 'text', true: 'Yes', false: 'No' }} />
      ),
      meta: { title: 'Partial', exportValue: (row) => (row.isPartialReceived ? 'Yes' : 'No') }
    },
    {
      accessorKey: 'packageCount',
      enableSorting: false,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Packages' />,
      cell: ({ row: { original: data } }) => <DataTableNumberCell value={data.packageCount} />,
      meta: { title: 'Packages', exportValue: (row) => row.packageCount }
    },
    {
      accessorKey: 'totalStock',
      enableSorting: false,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Total Pcs' />,
      cell: ({ row: { original: data } }) => <DataTableNumberCell value={data.totalStock} maximumFractionDigits={6} />,
      meta: { title: 'Total Pcs', exportValue: (row) => row.totalStock }
    },
    {
      accessorKey: 'submittedAt',
      filterFn: dateFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Submitted At' />,
      cell: ({ row: { original: data } }) =>
        data.submittedAt ? <DataTableDateCell value={data.submittedAt} /> : <DataTableTextCell value={null} />,
      meta: { title: 'Submitted At', exportValue: (row) => toDateText(row.submittedAt) }
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Created At' />,
      cell: ({ row: { original: data } }) => <DataTableDateCell value={data.createdAt} />,
      meta: { title: 'Created At', exportValue: (row) => toDateText(row.createdAt) }
    },
    {
      accessorKey: 'actions',
      enableSorting: false,
      enableHiding: false,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Actions' className='text-center' />,
      cell: ({ row: { original } }) => (
        <DataTableActionsCellWrapper>
          <TooltipWrapper label='View'>
            <Button variant='ghost' size='icon-sm' onClick={() => router.push(`/inbound/${encodeURIComponent(original.code)}/view`)}>
              <Icons.eye className='text-muted-foreground size-4' />
            </Button>
          </TooltipWrapper>
        </DataTableActionsCellWrapper>
      )
    }
  ]

  const { table, params, setData, setRowCount, refreshKey, refreshTable } = useDataTableServer({
    columns,
    initialState: DEFAULT_TABLE_INITIAL_STATE,
    getRowId: (row) => row.id
  })

  const dataTableInboundsSvr = useDataTableInboundsSvr(params, { setData, setRowCount }, [refreshKey])

  const isLoading = dataTableInboundsSvr.isLoading

  const handleExport = async () => {
    const visibleColumns = table.getVisibleLeafColumns().filter((column) => column.id !== 'actions' && column.columnDef.meta?.exportValue)

    if (visibleColumns.length === 0) {
      toast.error('No columns available to export!')
      return
    }

    const headers = visibleColumns.map((column) => column.columnDef.meta?.title ?? column.id)

    toast.promise(dataTableInboundsSvrExport.executeAsync({ ...params, isExport: true }), {
      loading: 'Preparing export...',
      success: (response) => {
        const result = response?.data

        if (!response || !result) throw { message: 'Failed to export inbounds!', unExpectedError: true }

        const rows = result.data.map((row) => visibleColumns.map((column) => column.columnDef.meta!.exportValue!(row)))

        exportToExcel({
          fileName: `${DATA_TABLE_UNIQUE_KEY.toUpperCase()}-${formatDate(new Date(), 'yyyy-MM-dd-HHmmss')}.xlsx`,
          sheetName: 'EXPORTED_DATA',
          headers,
          rows
        })

        return 'Inbounds exported successfully!'
      },
      error: (err: Error & { expectedError: boolean }) => {
        return err?.expectedError ? err.message : 'Something went wrong! Please try again later.'
      }
    })
  }

  return (
    <div className='flex h-full w-full flex-1 flex-col gap-5'>
      <Header title='Inbounds' description='Inbound transactions received across sessions'>
        <div className='flex w-full flex-wrap items-center justify-center gap-2 lg:ml-auto lg:w-auto lg:justify-end'>
          {/* //* the paging rides in the header on a phone, its own row once space runs out */}
          <div className='order-last flex w-full justify-center lg:hidden'>
            <DataTablePagination table={table} isServerSide isCompact />
          </div>

          <div className='flex shrink-0 items-center gap-2'>
            <DataTableRefreshButton onRefresh={refreshTable} isLoading={isLoading} />

            <CanView subject={PERMISSIONS_CODES.INBOUNDS} action={PERMISSIONS_ALLOWED_ACTIONS.EXPORT}>
              <DataTableExportButton onExport={handleExport} isLoading={dataTableInboundsSvrExport.isExecuting} />
            </CanView>

            <DataTableViewOptions table={table} isHideLabel align='end' />

            <DataTableActionsOptions table={table} isHideLabel />
          </div>
        </div>
      </Header>

      <ContentWrapper>
        <DataTableContainer>
          <DataTableToolbar>
            <DataTableColumnFilterWrapper>
              <DataTableGlobalSearch table={table} isLoading={isLoading} />
              <DataTableColumnFilter column={table.getColumn('status')} title='Status' isLoading={isLoading} />
              <DataTableColumnFilter column={table.getColumn('siteCode')} title='Site' isLoading={isLoading} />
              <DataTableColumnFilter column={table.getColumn('userName')} title='User' isLoading={isLoading} />
              <DataTableColumnFilter column={table.getColumn('customerProjectCode')} title='Customer Project' isLoading={isLoading} />
              <DataTableColumnDateFilter column={table.getColumn('submittedAt')} title='Submitted At' isLoading={isLoading} />
            </DataTableColumnFilterWrapper>
          </DataTableToolbar>

          <DataTable table={table} isLoading={isLoading} isServerSide paginationClassName='max-lg:hidden' />
        </DataTableContainer>
      </ContentWrapper>
    </div>
  )
}
