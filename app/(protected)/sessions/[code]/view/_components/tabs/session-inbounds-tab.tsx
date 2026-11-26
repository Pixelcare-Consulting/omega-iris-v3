'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ColumnDef } from '@tanstack/react-table'

import { InboundWithInclude } from '@/actions/inbound'
import { useDataTableClient } from '@/hooks/use-data-table-client'
import ContentWrapper from '@/components/content-wrapper'
import { DataTable } from '@/components/data-table/data-table'
import {
  DataTableActionsCellWrapper,
  DataTableBadgeCell,
  DataTableDateCell,
  DataTableNumberCell,
  DataTableTextCell
} from '@/components/data-table/data-table-column-cell'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { TooltipWrapper } from '@/components/tooltip-wrapper'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import DataTableContainer from '@/components/data-table/data-table-container'
import DataTableToolbar from '@/components/data-table/data-table-toolbar'
import DataTableColumnFilterWrapper from '@/components/data-table/data-table-column-filter-wrapper'
import DataTableGlobalSearch from '@/components/data-table/data-table-global-search'
import DataTableColumnFilter from '@/components/data-table/data-table-faceted-filter'
import DataTableRefreshButton from '@/components/data-table/data-table-refresh-button'
import DataTableExportButton from '@/components/data-table/data-table-export-button'
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options'
import CanView from '@/components/rbac/can-view'
import RelationLink from '@/components/relation-link'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { INBOUND_STATUS_CONFIG, INBOUND_STATUS_OPTIONS } from '@/constants/inbound'
import { multiSelectFilterFn } from '@/lib/data-table'
import { formatDate } from '@/lib/utils'
import { exportToExcel } from '@/lib/xlsx'

type SessionInboundsTabProps = { sessionCode: string; inbounds: InboundWithInclude[] }

export default function SessionInboundsTab({ sessionCode, inbounds }: SessionInboundsTabProps) {
  const DATA_TABLE_UNIQUE_KEY = 'session-inbounds'

  const router = useRouter()
  const [isRefreshing, startRefresh] = useTransition()

  const columns: ColumnDef<InboundWithInclude>[] = [
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
      id: 'location',
      accessorFn: (row) => (row.location ? `${row.location.code} (${row.location.name})` : ''),
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
      id: 'customerProject',
      accessorFn: (row) => (row.customerProject ? `${row.customerProject.code} (${row.customerProject.name})` : ''),
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
      id: 'packages',
      accessorFn: (row) => row.items.length,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Packages' />,
      cell: ({ row: { original: data } }) => <DataTableNumberCell value={data.items.length} />,
      meta: { title: 'Packages', exportValue: (row) => row.items.length }
    },
    {
      accessorKey: 'submittedAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Submitted At' />,
      cell: ({ row: { original: data } }) =>
        data.submittedAt ? <DataTableDateCell value={data.submittedAt} /> : <DataTableTextCell value={null} />,
      meta: { title: 'Submitted At', exportValue: (row) => (row.submittedAt ? formatDate(row.submittedAt, 'MMM d, yyyy, h:mm a') : '') }
    },
    {
      accessorKey: 'cancelReason',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Cancel Reason' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.cancelReason} highlight={table.getState().globalFilter} />,
      meta: { title: 'Cancel Reason', exportValue: (row) => row.cancelReason ?? '' }
    },
    {
      id: 'actions',
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

  const { table } = useDataTableClient({
    data: inbounds,
    columns,
    initialState: { columnPinning: { right: ['actions'] } },
    getRowId: (row) => row.id
  })

  const handleExport = () => {
    const visibleColumns = table.getVisibleLeafColumns().filter((column) => column.columnDef.meta?.exportValue)
    const headers = visibleColumns.map((column) => column.columnDef.meta?.title ?? column.id)
    const rows = table
      .getFilteredRowModel()
      .rows.map((row) => visibleColumns.map((column) => column.columnDef.meta!.exportValue!(row.original)))

    exportToExcel({
      fileName: `${DATA_TABLE_UNIQUE_KEY.toUpperCase()}-${sessionCode}-${formatDate(new Date(), 'yyyy-MM-dd-HHmmss')}.xlsx`,
      sheetName: 'EXPORTED_DATA',
      headers,
      rows
    })
  }

  return (
    <ContentWrapper className='h-full'>
      <DataTableContainer>
        <DataTableToolbar>
          <DataTableColumnFilterWrapper>
            <DataTableGlobalSearch table={table} isLoading={isRefreshing} />
            <DataTableColumnFilter column={table.getColumn('status')} title='Status' isLoading={isRefreshing} />
          </DataTableColumnFilterWrapper>

          <div className='ml-auto flex shrink-0 items-center gap-2'>
            <DataTableRefreshButton onRefresh={() => startRefresh(() => router.refresh())} isLoading={isRefreshing} />

            <CanView subject={PERMISSIONS_CODES.SESSIONS} action={PERMISSIONS_ALLOWED_ACTIONS.EXPORT}>
              <DataTableExportButton onExport={handleExport} isLoading={isRefreshing} />
            </CanView>

            <DataTableViewOptions table={table} isHideLabel align='end' />
          </div>
        </DataTableToolbar>

        <DataTable table={table} isLoading={isRefreshing} />
      </DataTableContainer>
    </ContentWrapper>
  )
}
