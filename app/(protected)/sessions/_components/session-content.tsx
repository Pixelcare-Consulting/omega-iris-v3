'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAction } from 'next-safe-action/hooks'
import { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'

import DataTableContainer from '@/components/data-table/data-table-container'
import DataTableGlobalSearch from '@/components/data-table/data-table-global-search'
import DataTableToolbar from '@/components/data-table/data-table-toolbar'
import DataTableColumnFilter from '@/components/data-table/data-table-faceted-filter'
import DataTableColumnFilterWrapper from '@/components/data-table/data-table-column-filter-wrapper'
import DataTableColumnDateFilter from '@/components/data-table/data-table-column-date-filter'
import DataTableRefreshButton from '@/components/data-table/data-table-refresh-button'
import DataTableExportButton from '@/components/data-table/data-table-export-button'
import { DataTableRowAction } from '@/components/data-table/data-table-row-actions'
import { DataTablePagination } from '@/components/data-table/data-table-pagination'
import { useDataTableServer } from '@/hooks/use-data-table-server'
import { useDataTableSessionsSvr } from '@/hooks/safe-actions/session'
import { dateFilterFn, multiSelectFilterFn } from '@/lib/data-table'
import { DEFAULT_PAGINATION_PAGE_INDEX, DEFAULT_TABLE_INITIAL_STATE } from '@/constants/data-table'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import {
  OPEN_SESSION_STATUSES,
  SESSION_STATUS_CONFIG,
  SESSION_STATUS_OPTIONS,
  SESSION_TYPE_CONFIG,
  SESSION_TYPE_OPTIONS
} from '@/constants/session'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import Header from '@/components/header'
import ContentWrapper from '@/components/content-wrapper'
import EmptyState from '@/components/empty-state'
import CanView from '@/components/rbac/can-view'
import { TooltipWrapper } from '@/components/tooltip-wrapper'
import { formatDate } from '@/lib/utils'
import { exportToExcel } from '@/lib/xlsx'
import { formatActiveTime, getActiveSeconds } from '@/lib/session'
import { getDataTableSessionsSvrClient, SessionSiteOption, SessionWithInclude } from '@/actions/session'
import { FilterOption } from '@/types/data-table'
import CancelSessionModal from '../../_components/cancel-session-modal'
import SessionCard from './session-card'
import StartSessionModal from './start-session-modal'

type SessionContentProps = {
  sites: SessionSiteOption[]
  siteOptions: FilterOption[]
  userOptions: FilterOption[]
  renderedAt: number
}

//* two cards a row, so the page sizes stay even
const CARD_PAGE_SIZE_OPTIONS = [8, 16, 24]

const DATA_TABLE_UNIQUE_KEY = 'sessions'

export default function SessionContent({ sites, siteOptions, userOptions, renderedAt }: SessionContentProps) {
  const router = useRouter()

  const [isStartOpen, setIsStartOpen] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<SessionWithInclude | null>(null)

  const isOpenStatus = (status: string) => (OPEN_SESSION_STATUSES as readonly string[]).includes(status)

  //* one list for the card menu
  const getRowActions = (session: SessionWithInclude): DataTableRowAction[] => [
    {
      label: 'View',
      icon: <Icons.eye />,
      subject: PERMISSIONS_CODES.SESSIONS,
      action: PERMISSIONS_ALLOWED_ACTIONS.VIEW,
      onClick: () => router.push(`/sessions/${encodeURIComponent(session.code)}/view`)
    },
    {
      label: 'Cancel Session',
      icon: <Icons.x />,
      isDestructive: true,
      isHidden: !isOpenStatus(session.status),
      onClick: () => setCancelTarget(session)
    }
  ]

  //* the cards render from the rows, columns only feed search, filters and export
  const columns: ColumnDef<SessionWithInclude>[] = [
    { accessorKey: 'code', meta: { title: 'Session #', exportValue: (row) => row.code } },
    {
      accessorKey: 'type',
      filterFn: multiSelectFilterFn,
      meta: { title: 'Type', options: SESSION_TYPE_OPTIONS, exportValue: (row) => SESSION_TYPE_CONFIG[row.type].label }
    },
    {
      accessorKey: 'status',
      filterFn: multiSelectFilterFn,
      meta: { title: 'Status', options: SESSION_STATUS_OPTIONS, exportValue: (row) => SESSION_STATUS_CONFIG[row.status].label }
    },
    {
      accessorKey: 'siteCode',
      filterFn: multiSelectFilterFn,
      meta: { title: 'Site', options: siteOptions, exportValue: (row) => row.site.name }
    },
    {
      id: 'userName',
      accessorFn: (row) => row.user.name,
      filterFn: multiSelectFilterFn,
      meta: { title: 'User', options: userOptions, exportValue: (row) => row.user.name }
    },
    { accessorKey: 'employeeId', meta: { title: 'Employee ID', exportValue: (row) => row.employeeId ?? '' } },
    {
      accessorKey: 'startedAt',
      filterFn: dateFilterFn,
      meta: { title: 'Started At', exportValue: (row) => formatDate(new Date(row.startedAt), 'yyyy-MM-dd HH:mm:ss') }
    },
    {
      accessorKey: 'endedAt',
      meta: { title: 'Ended At', exportValue: (row) => (row.endedAt ? formatDate(new Date(row.endedAt), 'yyyy-MM-dd HH:mm:ss') : '') }
    },
    {
      id: 'activeTime',
      meta: { title: 'Active Time', exportValue: (row) => formatActiveTime(getActiveSeconds(row, new Date())) }
    },
    { id: 'transactions', meta: { title: 'Transactions', exportValue: (row) => String(row._count.inbounds) } },
    { accessorKey: 'cancelReason', meta: { title: 'Cancel Reason', exportValue: (row) => row.cancelReason ?? '' } }
  ]

  const { table, params, setData, setRowCount, refreshKey, refetch, refreshTable } = useDataTableServer({
    columns,
    initialState: {
      ...DEFAULT_TABLE_INITIAL_STATE,
      pagination: { pageIndex: DEFAULT_PAGINATION_PAGE_INDEX, pageSize: CARD_PAGE_SIZE_OPTIONS[0] }
    },
    getRowId: (row) => row.id
  })

  const dataTableSessionsSvr = useDataTableSessionsSvr(params, { setData, setRowCount }, [refreshKey, renderedAt])
  const dataTableSessionsSvrExport = useAction(getDataTableSessionsSvrClient)

  const isLoading = dataTableSessionsSvr.isLoading
  const globalFilter = table.getState().globalFilter
  const rows = table.getRowModel().rows

  const handleExport = async () => {
    const exportColumns = table.getAllLeafColumns().filter((column) => column.columnDef.meta?.exportValue)
    const headers = exportColumns.map((column) => column.columnDef.meta?.title ?? column.id)

    toast.promise(dataTableSessionsSvrExport.executeAsync({ ...params, isExport: true }), {
      loading: 'Preparing export...',
      success: (response) => {
        const result = response?.data

        if (!response || !result) throw { message: 'Failed to export sessions!', unExpectedError: true }

        exportToExcel({
          fileName: `${DATA_TABLE_UNIQUE_KEY.toUpperCase()}-${formatDate(new Date(), 'yyyy-MM-dd-HHmmss')}.xlsx`,
          sheetName: 'EXPORTED_DATA',
          headers,
          rows: result.data.map((row) => exportColumns.map((column) => column.columnDef.meta!.exportValue!(row)))
        })

        return 'Sessions exported successfully!'
      },
      error: (err: Error & { expectedError: boolean }) =>
        err?.expectedError ? err.message : 'Something went wrong! Please try again later.'
    })
  }

  return (
    <div className='flex h-full w-full flex-1 flex-col gap-5'>
      <Header title='Sessions' description='Floor work by user and site'>
        <div className='flex w-full flex-wrap items-center justify-center gap-2 lg:ml-auto lg:w-auto lg:justify-end'>
          {/* //* card view has no footer bar, so its paging rides here */}
          <div className='order-last flex w-full justify-center lg:order-0 lg:w-auto lg:justify-end'>
            <DataTablePagination table={table} isServerSide isCompact pageSizeOptions={CARD_PAGE_SIZE_OPTIONS} />
          </div>

          <CanView subject={PERMISSIONS_CODES.SESSIONS} action={PERMISSIONS_ALLOWED_ACTIONS.CREATE}>
            <TooltipWrapper label='Start Session'>
              <Button type='button' onClick={() => setIsStartOpen(true)}>
                <Icons.play /> Start Session
              </Button>
            </TooltipWrapper>
          </CanView>

          <div className='flex shrink-0 items-center gap-2'>
            <DataTableRefreshButton onRefresh={refreshTable} isLoading={isLoading} />

            <CanView subject={PERMISSIONS_CODES.SESSIONS} action={PERMISSIONS_ALLOWED_ACTIONS.EXPORT}>
              <DataTableExportButton onExport={handleExport} isLoading={dataTableSessionsSvrExport.isExecuting} />
            </CanView>
          </div>
        </div>
      </Header>

      <ContentWrapper>
        <DataTableContainer>
          <DataTableToolbar>
            <DataTableColumnFilterWrapper>
              <DataTableGlobalSearch table={table} isLoading={isLoading} />
              <DataTableColumnFilter column={table.getColumn('type')} title='Type' isLoading={isLoading} />
              <DataTableColumnFilter column={table.getColumn('status')} title='Status' isLoading={isLoading} />
              <DataTableColumnFilter column={table.getColumn('siteCode')} title='Site' isLoading={isLoading} />
              <DataTableColumnFilter column={table.getColumn('userName')} title='User' isLoading={isLoading} />
              <DataTableColumnDateFilter column={table.getColumn('startedAt')} title='Started At' isLoading={isLoading} />
            </DataTableColumnFilterWrapper>
          </DataTableToolbar>

          <div className='flex min-h-0 flex-1 flex-col gap-2.5 p-1'>
            <div className='min-h-0 flex-1 overflow-y-auto'>
              {isLoading ? (
                <div className='text-muted-foreground flex h-full min-h-80 items-center justify-center gap-2 py-10 text-sm'>
                  <Icons.spinner className='size-4 animate-spin' />
                  <h3 className='text-base font-semibold'>Loading...</h3>
                </div>
              ) : rows.length === 0 ? (
                <EmptyState title='No results found' description='Try adjusting your search or filters.' />
              ) : (
                //! padding inside the scroll area, or it clips the hover ring and shadow on the outer cards
                <div className='grid grid-cols-1 gap-3 p-1 lg:grid-cols-2'>
                  {rows.map((row) => (
                    <SessionCard key={row.id} session={row.original} actions={getRowActions(row.original)} highlight={globalFilter} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </DataTableContainer>
      </ContentWrapper>

      <StartSessionModal isOpen={isStartOpen} sites={sites} onClose={() => setIsStartOpen(false)} />

      {cancelTarget && (
        <CancelSessionModal
          isOpen={!!cancelTarget}
          sessionCode={cancelTarget.code}
          draftInboundCodes={[]}
          onClose={() => setCancelTarget(null)}
          onSuccess={refetch}
        />
      )}
    </div>
  )
}
