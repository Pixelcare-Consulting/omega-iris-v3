'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'

import { getDataTableActivityLogsSvrClient } from '@/actions/activity-log'
import { useDataTableActivityLogsSvr } from '@/hooks/safe-actions/activity-log'
import { DataTable } from '@/components/data-table/data-table'
import { DataTableActionsCellWrapper, DataTableDateCell, DataTableTextCell } from '@/components/data-table/data-table-column-cell'
import { TooltipWrapper } from '@/components/tooltip-wrapper'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import DataTableContainer from '@/components/data-table/data-table-container'
import DataTableGlobalSearch from '@/components/data-table/data-table-global-search'
import DataTableToolbar from '@/components/data-table/data-table-toolbar'
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options'
import DataTableColumnFilter from '@/components/data-table/data-table-faceted-filter'
import DataTableColumnDateFilter from '@/components/data-table/data-table-column-date-filter'
import DataTableColumnFilterWrapper from '@/components/data-table/data-table-column-filter-wrapper'
import DataTableRefreshButton from '@/components/data-table/data-table-refresh-button'
import DataTableExportButton from '@/components/data-table/data-table-export-button'
import { DataTablePagination } from '@/components/data-table/data-table-pagination'
import ActivityChanges from '@/components/activity-log/activity-changes'
import ActivityLegend from '@/components/activity-log/activity-legend'
import { ACTIVITY_TONE_STYLES, getActionLabel, getActionTone } from '@/components/activity-log/activity-tone'
import ContentWrapper from '@/components/content-wrapper'
import Header from '@/components/header'
import CanView from '@/components/rbac/can-view'
import { Icons } from '@/components/icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { dateFilterFn, multiSelectFilterFn } from '@/lib/data-table'
import { formatDate } from '@/lib/utils'
import { exportToExcel } from '@/lib/xlsx'
import { useDataTableServer } from '@/hooks/use-data-table-server'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_MODULES,
  ACTIVITY_SOURCE_LABELS,
  AUDIT_LOG_DEFAULT_DAYS,
  ActivityModule
} from '@/constants/activity-log'
import type { ActivityLog } from '@/prisma/generated/client'
import type { ActivityChanges as ActivityChangesData } from '@/types/activity-log'
import type { DateFilterValue } from '@/types/data-table'

const MODULE_OPTIONS = Object.entries(ACTIVITY_MODULES).map(([value, { label }]) => ({ label, value }))
const ACTION_OPTIONS = Object.entries(ACTIVITY_ACTIONS).map(([value, { label }]) => ({ label, value }))
const SOURCE_OPTIONS = Object.entries(ACTIVITY_SOURCE_LABELS).map(([value, label]) => ({ label, value }))

const DEFAULT_DATE_FILTER: DateFilterValue = {
  operator: 'isRelativeToToday',
  value: null,
  valueTo: null,
  relative: { amount: AUDIT_LOG_DEFAULT_DAYS, unit: 'days', direction: 'past' }
}

const toModuleLabel = (module: string) => ACTIVITY_MODULES[module as ActivityModule]?.label ?? module

const hasChanges = (row: ActivityLog) => {
  const changes = row.changes as ActivityChangesData | null
  return !!changes && (changes.fields.length > 0 || (changes.children ?? []).length > 0)
}

//* the summary rows of a pull, import or generate run
const RUN_SUMMARY_ACTIONS: string[] = ['SYNC_FROM_SAP', 'IMPORT', 'BULK_CREATE', 'BULK_DELETE']

export default function AuditLogContent() {
  const DATA_TABLE_UNIQUE_KEY = 'audit-logs'

  //* the summary of the run being shown, for the chip
  const [runSummary, setRunSummary] = useState<string | null>(null)

  const columns: ColumnDef<ActivityLog>[] = [
    {
      id: 'expand',
      enableSorting: false,
      enableHiding: false,
      size: 44,
      header: () => null,
      cell: ({ row }) =>
        row.getCanExpand() ? (
          <Button type='button' variant='ghost' size='icon-sm' aria-label='Show details' onClick={row.getToggleExpandedHandler()}>
            {row.getIsExpanded() ? <Icons.down className='size-4' /> : <Icons.right className='size-4' />}
          </Button>
        ) : null
    },
    {
      accessorKey: 'createdAt',
      filterFn: dateFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Date' />,
      cell: ({ row: { original: data } }) => <DataTableDateCell value={data.createdAt} />,
      meta: { title: 'Date', exportValue: (row) => formatDate(new Date(row.createdAt), 'yyyy-MM-dd HH:mm:ss') }
    },
    {
      accessorKey: 'userName',
      header: ({ column }) => <DataTableColumnHeader column={column} title='User' />,
      cell: ({ row: { original: data } }) => (
        <DataTableTextCell
          value={data.source === 'SYSTEM' ? ACTIVITY_SOURCE_LABELS.SYSTEM : data.userName}
          highlight={table.getState().globalFilter}
        />
      ),
      meta: { title: 'User', exportValue: (row) => row.userName }
    },
    {
      accessorKey: 'source',
      filterFn: multiSelectFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Source' />,
      cell: ({ row: { original: data } }) => <span className='text-muted-foreground'>{ACTIVITY_SOURCE_LABELS[data.source]}</span>,
      meta: { title: 'Source', options: SOURCE_OPTIONS, exportValue: (row) => ACTIVITY_SOURCE_LABELS[row.source] }
    },
    {
      accessorKey: 'module',
      filterFn: multiSelectFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Module' />,
      cell: ({ row: { original: data } }) => <span>{toModuleLabel(data.module)}</span>,
      meta: { title: 'Module', options: MODULE_OPTIONS, exportValue: (row) => toModuleLabel(row.module) }
    },
    {
      accessorKey: 'action',
      filterFn: multiSelectFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Action' />,
      cell: ({ row: { original: data } }) => (
        <Badge variant={ACTIVITY_TONE_STYLES[getActionTone(data.action)].badge}>{getActionLabel(data.action)}</Badge>
      ),
      meta: { title: 'Action', options: ACTION_OPTIONS, exportValue: (row) => getActionLabel(row.action) }
    },
    {
      accessorKey: 'entityCode',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Record' />,
      cell: ({ row: { original: data } }) => (
        <div className='flex flex-col gap-0.5'>
          {data.entityCode && (
            <span className='font-medium'>
              <DataTableTextCell value={data.entityCode} highlight={table.getState().globalFilter} />
            </span>
          )}
          {data.entityLabel && (
            <span className='text-muted-foreground'>
              <DataTableTextCell value={data.entityLabel} highlight={table.getState().globalFilter} />
            </span>
          )}
        </div>
      ),
      meta: { title: 'Record', exportValue: (row) => [row.entityCode, row.entityLabel].filter(Boolean).join(' - ') }
    },
    {
      accessorKey: 'summary',
      enableSorting: false,
      minSize: 260,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Summary' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.summary} highlight={table.getState().globalFilter} isWrap />,
      meta: { title: 'Summary', exportValue: (row) => row.summary }
    },
    {
      accessorKey: 'actions',
      enableSorting: false,
      enableHiding: false,
      minSize: 90,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Actions' className='text-center' />,
      cell: ({ row: { original: data } }) => {
        //* only a run summary (pull, import, generate) has records to show
        const isRunSummary = !!data.batchId && RUN_SUMMARY_ACTIONS.includes(data.action)

        if (!isRunSummary) return null

        return (
          <DataTableActionsCellWrapper>
            <TooltipWrapper label='View affected records'>
              <Button
                type='button'
                variant='ghost'
                size='icon-sm'
                aria-label='Show affected records'
                onClick={() => handleShowAffected(data.batchId!, data.summary)}
              >
                <Icons.listFilter className='text-muted-foreground size-4' />
              </Button>
            </TooltipWrapper>
          </DataTableActionsCellWrapper>
        )
      }
    },
    {
      accessorKey: 'batchId',
      enableHiding: false,
      enableSorting: false,
      header: () => null,
      cell: () => null
    }
  ]

  const { table, params, setData, setRowCount, refreshKey, refreshTable } = useDataTableServer({
    columns,
    initialState: {
      sorting: [{ id: 'createdAt', desc: true }],
      columnFilters: [{ id: 'createdAt', value: DEFAULT_DATE_FILTER }],
      columnVisibility: { batchId: false },
      columnPinning: { right: ['actions'] }
    },
    getRowId: (row) => row.id,
    getRowCanExpand: (row) => hasChanges(row.original)
  })

  const dataTableActivityLogsSvr = useDataTableActivityLogsSvr(params, { setData, setRowCount }, [refreshKey])
  const dataTableActivityLogsSvrExport = useAction(getDataTableActivityLogsSvrClient)

  const batchFilter = table.getColumn('batchId')?.getFilterValue() as string[] | undefined

  //* a run older than the date filter must still show, so the date filter clears
  function handleShowAffected(batchId: string, summary: string) {
    setRunSummary(summary)
    table.getColumn('createdAt')?.setFilterValue(undefined)
    table.getColumn('batchId')?.setFilterValue([batchId])
  }

  function handleClearAffected() {
    setRunSummary(null)
    table.getColumn('batchId')?.setFilterValue(undefined)
  }

  const handleExport = async () => {
    const visibleColumns = table.getVisibleLeafColumns().filter((column) => column.columnDef.meta?.exportValue)

    if (visibleColumns.length === 0) {
      toast.error('No columns available to export!')
      return
    }

    const headers = visibleColumns.map((column) => column.columnDef.meta?.title ?? column.id)

    toast.promise(dataTableActivityLogsSvrExport.executeAsync({ ...params, isExport: true }), {
      loading: 'Preparing export...',
      success: (response) => {
        const result = response?.data

        if (!response || !result) throw { message: 'Failed to export audit logs!', unExpectedError: true }

        const rows = result.data.map((row) => visibleColumns.map((column) => column.columnDef.meta!.exportValue!(row)))

        exportToExcel({
          fileName: `${DATA_TABLE_UNIQUE_KEY.toUpperCase()}-${formatDate(new Date(), 'yyyy-MM-dd-HHmmss')}.xlsx`,
          sheetName: 'EXPORTED_DATA',
          headers,
          rows
        })

        return 'Audit logs exported successfully!'
      },
      error: (err: Error & { expectedError: boolean }) => {
        return err?.expectedError ? err.message : 'Something went wrong! Please try again later.'
      }
    })
  }

  return (
    <div className='flex h-full w-full flex-1 flex-col gap-5'>
      <Header title='Audit Logs' description='Every change made in the portal, the mobile app and scheduled jobs'>
        <div className='flex w-full flex-wrap items-center justify-center gap-2 lg:ml-auto lg:w-auto lg:justify-end'>
          {/* //* the paging rides in the header on a phone, its own row once space runs out */}
          <div className='order-last flex w-full justify-center lg:hidden'>
            <DataTablePagination table={table} isServerSide isCompact />
          </div>

          <div className='flex shrink-0 items-center gap-2'>
            <DataTableRefreshButton onRefresh={refreshTable} isLoading={dataTableActivityLogsSvr.isLoading} />

            <CanView subject={PERMISSIONS_CODES.AUDIT_LOGS} action={PERMISSIONS_ALLOWED_ACTIONS.EXPORT}>
              <DataTableExportButton onExport={handleExport} isLoading={dataTableActivityLogsSvrExport.isExecuting} />
            </CanView>

            <DataTableViewOptions table={table} isHideLabel align='end' />
          </div>
        </div>
      </Header>

      <ContentWrapper>
        <DataTableContainer>
          <DataTableToolbar>
            <DataTableColumnFilterWrapper>
              <DataTableGlobalSearch table={table} isLoading={dataTableActivityLogsSvr.isLoading} />
              <DataTableColumnFilter column={table.getColumn('module')} title='Module' isLoading={dataTableActivityLogsSvr.isLoading} />
              <DataTableColumnFilter column={table.getColumn('action')} title='Action' isLoading={dataTableActivityLogsSvr.isLoading} />
              <DataTableColumnFilter column={table.getColumn('source')} title='Source' isLoading={dataTableActivityLogsSvr.isLoading} />
              <DataTableColumnDateFilter
                column={table.getColumn('createdAt')}
                title='Date'
                isLoading={dataTableActivityLogsSvr.isLoading}
              />

              {batchFilter && batchFilter.length > 0 && (
                <Button type='button' variant='outline' size='sm' className='max-w-80' title='Show all rows' onClick={handleClearAffected}>
                  <span className='truncate'>Showing: {runSummary ?? 'affected records'}</span>
                  <Icons.x className='size-3.5' />
                </Button>
              )}
            </DataTableColumnFilterWrapper>

            <ActivityLegend />
          </DataTableToolbar>

          <DataTable
            table={table}
            isLoading={dataTableActivityLogsSvr.isLoading}
            isServerSide
            paginationClassName='max-lg:hidden'
            renderSubComponent={(row) => (
              <div className='px-4 py-3 pl-14'>
                <ActivityChanges changes={row.original.changes as ActivityChangesData | null} />
              </div>
            )}
          />
        </DataTableContainer>
      </ContentWrapper>
    </div>
  )
}
