'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ColumnDef } from '@tanstack/react-table'

import { SessionWithInclude } from '@/actions/session'
import { useDataTableClient } from '@/hooks/use-data-table-client'
import ContentWrapper from '@/components/content-wrapper'
import { DataTable } from '@/components/data-table/data-table'
import { DataTableDateCell, DataTableTextCell } from '@/components/data-table/data-table-column-cell'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import DataTableContainer from '@/components/data-table/data-table-container'
import DataTableToolbar from '@/components/data-table/data-table-toolbar'
import DataTableColumnFilterWrapper from '@/components/data-table/data-table-column-filter-wrapper'
import DataTableGlobalSearch from '@/components/data-table/data-table-global-search'
import DataTableRefreshButton from '@/components/data-table/data-table-refresh-button'
import DataTableExportButton from '@/components/data-table/data-table-export-button'
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options'
import CanView from '@/components/rbac/can-view'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { formatActiveTime } from '@/lib/session'
import { formatDate } from '@/lib/utils'
import { exportToExcel } from '@/lib/xlsx'

type SessionPause = SessionWithInclude['pauses'][number]

type SessionPausesTabProps = { session: SessionWithInclude }

const DATE_FORMAT = 'MMM d, yyyy, h:mm a'

export default function SessionPausesTab({ session }: SessionPausesTabProps) {
  const DATA_TABLE_UNIQUE_KEY = 'session-pauses'

  const router = useRouter()
  const [isRefreshing, startRefresh] = useTransition()

  //* an open pause runs until the session ended, or now
  const toDuration = (row: SessionPause) => {
    const end = row.resumedAt ?? session.endedAt ?? new Date()
    return formatActiveTime(Math.max(0, Math.floor((+new Date(end) - +new Date(row.pausedAt)) / 1000)))
  }

  const columns: ColumnDef<SessionPause>[] = [
    {
      accessorKey: 'pausedAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Paused At' />,
      cell: ({ row: { original: data } }) => <DataTableDateCell value={data.pausedAt} />,
      meta: { title: 'Paused At', exportValue: (row) => formatDate(row.pausedAt, DATE_FORMAT) }
    },
    {
      accessorKey: 'resumedAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Resumed At' />,
      cell: ({ row: { original: data } }) =>
        data.resumedAt ? <DataTableDateCell value={data.resumedAt} /> : <DataTableTextCell value='Still paused' muted />,
      meta: { title: 'Resumed At', exportValue: (row) => (row.resumedAt ? formatDate(row.resumedAt, DATE_FORMAT) : 'Still paused') }
    },
    {
      id: 'duration',
      accessorFn: toDuration,
      enableSorting: false,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Duration' />,
      cell: ({ row: { original: data } }) => <span suppressHydrationWarning>{toDuration(data)}</span>,
      meta: { title: 'Duration', exportValue: toDuration }
    }
  ]

  const { table } = useDataTableClient({ data: session.pauses, columns, getRowId: (row) => row.id })

  const handleExport = () => {
    const visibleColumns = table.getVisibleLeafColumns().filter((column) => column.columnDef.meta?.exportValue)
    const headers = visibleColumns.map((column) => column.columnDef.meta?.title ?? column.id)
    const rows = table
      .getFilteredRowModel()
      .rows.map((row) => visibleColumns.map((column) => column.columnDef.meta!.exportValue!(row.original)))

    exportToExcel({
      fileName: `${DATA_TABLE_UNIQUE_KEY.toUpperCase()}-${session.code}-${formatDate(new Date(), 'yyyy-MM-dd-HHmmss')}.xlsx`,
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
