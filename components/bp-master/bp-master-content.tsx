'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ColumnDef } from '@tanstack/react-table'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'

import { useBpMasterLookups, useDataTableBpMastersSvr } from '@/hooks/safe-actions/bp-master'
import { DataTable } from '@/components/data-table/data-table'
import {
  DataTableActionsCellWrapper,
  DataTableBooleanCell,
  DataTableDateCell,
  DataTableTextCell
} from '@/components/data-table/data-table-column-cell'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import DataTableContainer from '@/components/data-table/data-table-container'
import DataTableGlobalSearch from '@/components/data-table/data-table-global-search'
import DataTableToolbar from '@/components/data-table/data-table-toolbar'
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options'
import DataTableColumnFilter from '@/components/data-table/data-table-faceted-filter'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { dateFilterFn, getSoftDeletedRowClassName, multiSelectFilterFn } from '@/lib/data-table'
import { DataTableActionsOptions } from '@/components/data-table/data-table-options'
import { DataTablePagination } from '@/components/data-table/data-table-pagination'
import DataTableColumnDateFilter from '@/components/data-table/data-table-column-date-filter'
import { useDataTableServer } from '@/hooks/use-data-table-server'
import { DEFAULT_TABLE_INITIAL_STATE } from '@/constants/data-table'
import Header from '@/components/header'
import { TooltipWrapper } from '@/components/tooltip-wrapper'
import ContentWrapper from '@/components/content-wrapper'
import { deleteBpMaster, getDataTableBpMastersSvrClient, restoreBpMaster } from '@/actions/bp-master'
import { BusinessPartner } from '@/prisma/generated/client'
import AlertModal from '@/components/alert-modal'
import { useConfirmAction } from '@/hooks/use-confirm-action'
import { PERMISSIONS_ALLOWED_ACTIONS } from '@/constants/permission'
import { BP_MASTER_CONFIG, BpMasterType } from '@/constants/bp-master'
import { SAP_SYNC_STATUS_OPTIONS } from '@/constants/sap-sync'
import SapSyncStatusBadge from '@/components/sap-sync-status-badge'
import CanView from '@/components/rbac/can-view'
import { formatDate } from '@/lib/utils'
import { exportToExcel } from '@/lib/xlsx'
import DataTableColumnFilterWrapper from '@/components/data-table/data-table-column-filter-wrapper'
import DataTableShowDeletedToggle from '@/components/data-table/data-table-show-deleted-toggle'
import DataTableRefreshButton from '@/components/data-table/data-table-refresh-button'
import DataTableExportButton from '@/components/data-table/data-table-export-button'
import BpMasterSyncFromSap from './bp-master-sync-from-sap'
import BpMasterSyncToSap from './bp-master-sync-to-sap'

type BpMasterContentProps = { type: BpMasterType; userCode: number | null }

const isSyncableRow = (row: BusinessPartner) => !row.deletedAt && row.syncStatus !== 'SYNCED'

const ACTIVE_OPTIONS = [
  { label: 'Yes', value: 'Yes' },
  { label: 'No', value: 'No' }
]

export default function BpMasterContent({ type, userCode }: BpMasterContentProps) {
  const router = useRouter()

  const { label, pluralLabel, route, permission, description, canCreate } = BP_MASTER_CONFIG[type]

  const DATA_TABLE_UNIQUE_KEY = pluralLabel.toLowerCase()

  const deleteConfirm = useConfirmAction<{ code: string; name: string }>()
  const restoreConfirm = useConfirmAction<{ code: string; name: string }>()

  //* loaded once, the sync from sap button sends them with every page
  const lookups = useBpMasterLookups(type)

  //* the table filters on the saved names, so the options carry names
  const groupOptions = useMemo(() => lookups.data.groups.map((g) => ({ value: g.Name, label: g.Name })), [lookups.data.groups])
  const currencyOptions = useMemo(() => lookups.data.currencies.map((c) => ({ value: c.Name, label: c.Name })), [lookups.data.currencies])

  //* the picked rows by id, kept across pages for sync to sap
  const [selectedItems, setSelectedItems] = useState<Record<string, { id: string; CardCode: string }>>({})

  const toUrl = (code: string, suffix = '') => `${route}/${encodeURIComponent(code)}${suffix}`

  const columns: ColumnDef<BusinessPartner>[] = [
    ...(canCreate
      ? [
          {
            id: 'select',
            enableSorting: false,
            enableHiding: false,
            size: 44,
            minSize: 44,
            maxSize: 44,
            header: ({ table }) => (
              <div className='flex justify-center'>
                <Checkbox
                  aria-label='Select all syncable rows on this page'
                  checked={table.getIsSomePageRowsSelected() ? 'indeterminate' : table.getIsAllPageRowsSelected()}
                  onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                />
              </div>
            ),
            cell: ({ row }) =>
              row.getCanSelect() ? (
                <div className='flex justify-center'>
                  <Checkbox
                    aria-label='Select row'
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                  />
                </div>
              ) : null,
            meta: { title: 'Select' }
          } satisfies ColumnDef<BusinessPartner>
        ]
      : []),
    {
      accessorKey: 'CardCode',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Code' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.CardCode} highlight={table.getState().globalFilter} />,
      meta: { title: 'Code', exportValue: (row) => row.CardCode }
    },
    {
      accessorKey: 'CardName',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Name' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.CardName} highlight={table.getState().globalFilter} />,
      meta: { title: 'Name', exportValue: (row) => row.CardName }
    },
    {
      accessorKey: 'GroupName',
      filterFn: multiSelectFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Group' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.GroupName} highlight={table.getState().globalFilter} />,
      meta: { title: 'Group', options: groupOptions, exportValue: (row) => row.GroupName }
    },
    {
      accessorKey: 'CurrName',
      filterFn: multiSelectFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Currency' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.CurrName} highlight={table.getState().globalFilter} />,
      meta: { title: 'Currency', options: currencyOptions, exportValue: (row) => row.CurrName }
    },
    {
      accessorKey: 'PymntGroup',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Payment Terms' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.PymntGroup} highlight={table.getState().globalFilter} />,
      meta: { title: 'Payment Terms', exportValue: (row) => row.PymntGroup }
    },
    {
      accessorKey: 'syncStatus',
      filterFn: multiSelectFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Sync Status' />,
      cell: ({ row: { original: data } }) => <SapSyncStatusBadge status={data.syncStatus} syncError={data.syncError} />,
      meta: {
        title: 'Sync Status',
        options: SAP_SYNC_STATUS_OPTIONS,
        exportValue: (row) => SAP_SYNC_STATUS_OPTIONS.find((o) => o.value === row.syncStatus)?.label ?? row.syncStatus
      }
    },
    {
      accessorKey: 'syncedAt',
      filterFn: dateFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Synced At' />,
      cell: ({ row: { original: data } }) => <DataTableDateCell value={data.syncedAt} />,
      meta: { title: 'Synced At', exportValue: (row) => (row.syncedAt ? formatDate(row.syncedAt) : '') }
    },
    {
      accessorFn: (row) => (row?.isActive ? 'Yes' : 'No'),
      accessorKey: 'isActive',
      filterFn: multiSelectFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Active' />,
      cell: ({ row: { original: data } }) => (
        <DataTableBooleanCell
          value={data.isActive}
          display={{ type: 'text', true: 'Yes', false: 'No' }}
          highlight={table.getState().globalFilter}
        />
      ),
      meta: { title: 'Active', options: ACTIVE_OPTIONS, exportValue: (row) => (row.isActive ? 'Yes' : 'No') }
    },
    {
      accessorKey: 'createdAt',
      filterFn: dateFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Created At' />,
      cell: ({ row: { original: data } }) => <DataTableDateCell value={data.createdAt} />,
      meta: { title: 'Created At', exportValue: (row) => formatDate(row.createdAt) }
    },
    {
      accessorKey: 'updatedAt',
      filterFn: dateFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Updated At' />,
      cell: ({ row: { original: data } }) => <DataTableDateCell value={data.updatedAt} />,
      meta: { title: 'Updated At', exportValue: (row) => formatDate(row.updatedAt) }
    },
    {
      accessorKey: 'actions',
      enableSorting: false,
      enableHiding: false,
      minSize: 140,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Actions' className='text-center' />,
      cell: ({ row: { original } }) => {
        const { CardCode: code, CardName: name, deletedAt, deletedBy, syncStatus } = original

        const isSoftDeleted = deletedAt && deletedBy
        const isSynced = syncStatus === 'SYNCED'

        return (
          <DataTableActionsCellWrapper>
            {!isSoftDeleted ? (
              <>
                <CanView subject={permission} action={PERMISSIONS_ALLOWED_ACTIONS.VIEW}>
                  <TooltipWrapper label='View'>
                    <Button variant='ghost' size='icon-sm' onClick={() => router.push(toUrl(code, '/view'))}>
                      <Icons.eye className='text-muted-foreground size-4' />
                    </Button>
                  </TooltipWrapper>
                </CanView>

                {canCreate && (
                  <CanView subject={permission} action={PERMISSIONS_ALLOWED_ACTIONS.EDIT}>
                    <TooltipWrapper label='Edit'>
                      <Button variant='ghost' size='icon-sm' onClick={() => router.push(toUrl(code))}>
                        <Icons.pencil className='text-muted-foreground size-4' />
                      </Button>
                    </TooltipWrapper>
                  </CanView>
                )}

                {canCreate && !isSynced && (
                  <CanView subject={permission} action={PERMISSIONS_ALLOWED_ACTIONS.DELETE}>
                    <TooltipWrapper label='Delete'>
                      <Button variant='ghost' size='icon-sm' onClick={() => deleteConfirm.open({ code, name })}>
                        <Icons.trash className='text-destructive size-4' />
                      </Button>
                    </TooltipWrapper>
                  </CanView>
                )}
              </>
            ) : (
              <CanView subject={permission} action={PERMISSIONS_ALLOWED_ACTIONS.RESTORE}>
                <TooltipWrapper label='Restore'>
                  <Button variant='ghost' size='icon-sm' onClick={() => restoreConfirm.open({ code, name })}>
                    <Icons.restore className='size-5 text-blue-500' />
                  </Button>
                </TooltipWrapper>
              </CanView>
            )}
          </DataTableActionsCellWrapper>
        )
      }
    }
  ]

  const { table, params, setData, setRowCount, isShowDeleted, setIsShowDeleted, refreshKey, refetch, refreshTable } = useDataTableServer({
    columns,
    initialState: {
      ...DEFAULT_TABLE_INITIAL_STATE,
      ...(canCreate && { columnPinning: { ...DEFAULT_TABLE_INITIAL_STATE.columnPinning, left: ['select'] } })
    },
    getRowId: (row) => row.id,
    enableRowSelection: (row) => canCreate && isSyncableRow(row.original)
  })

  const tableParams = { ...params, type }

  const dataTableBpMastersSvr = useDataTableBpMastersSvr(tableParams, { setData, setRowCount }, [refreshKey])
  const dataTableBpMastersSvrExport = useAction(getDataTableBpMastersSvrClient)
  const deleteBpMasterAction = useAction(deleteBpMaster)
  const restoreBpMasterAction = useAction(restoreBpMaster)

  const isLoading = dataTableBpMastersSvr.isLoading

  //* rows on other pages aren't loaded, so their codes come from the earlier pick
  const rowSelection = table.getState().rowSelection
  const visibleRows = table.getRowModel().rows

  const itemsToSync = Object.keys(rowSelection)
    .filter((id) => rowSelection[id])
    .map((id) => {
      const row = visibleRows.find((r) => r.id === id)?.original
      return row ? { id: row.id, CardCode: row.CardCode } : selectedItems[id]
    })
    .filter(Boolean)

  const itemsToSyncKey = itemsToSync.map((item) => item.id).join(',')

  //* remember the codes of picked rows before the page changes
  useEffect(() => {
    setSelectedItems((prev) => Object.fromEntries(itemsToSync.map((item) => [item.id, prev[item.id] ?? item])))
  }, [itemsToSyncKey])

  const handleSynced = () => {
    table.resetRowSelection()
    setSelectedItems({})
    refetch()
  }

  const handleExport = async () => {
    const visibleColumns = table.getVisibleLeafColumns().filter((column) => column.id !== 'actions' && column.columnDef.meta?.exportValue)

    if (visibleColumns.length === 0) {
      toast.error('No columns available to export!')
      return
    }

    const headers = visibleColumns.map((column) => column.columnDef.meta?.title ?? column.id)

    toast.promise(dataTableBpMastersSvrExport.executeAsync({ ...tableParams, isExport: true }), {
      loading: 'Preparing export...',
      success: (response) => {
        const result = response?.data

        if (!response || !result) throw { message: `Failed to export ${pluralLabel.toLowerCase()}!`, unExpectedError: true }

        const rows = result.data.map((row) => visibleColumns.map((column) => column.columnDef.meta!.exportValue!(row)))

        exportToExcel({
          fileName: `${DATA_TABLE_UNIQUE_KEY.toUpperCase()}-${formatDate(new Date(), 'yyyy-MM-dd-HHmmss')}.xlsx`,
          sheetName: 'EXPORTED_DATA',
          headers,
          rows
        })

        return `${pluralLabel} exported successfully!`
      },
      error: (err: Error & { expectedError: boolean }) => {
        return err?.expectedError ? err.message : 'Something went wrong! Please try again later.'
      }
    })
  }

  const runConfirmed = (execute: () => Promise<any>, loading: string, failed: string) => {
    toast.promise(execute(), {
      loading,
      success: (response) => {
        const result = response?.data

        if (!response || !result) throw { message: failed, unExpectedError: true }

        if (!result.error) {
          refetch()
          return result.message
        }

        throw { message: result.message, expectedError: true }
      },
      error: (err: Error & { expectedError: boolean }) => {
        return err?.expectedError ? err.message : 'Something went wrong! Please try again later.'
      }
    })
  }

  const handleConfirmDelete = () => {
    if (!deleteConfirm.target?.code) return

    const { code } = deleteConfirm.target

    deleteConfirm.close()

    runConfirmed(() => deleteBpMasterAction.executeAsync({ code, type }), `Deleting ${label.toLowerCase()}...`, `Failed to delete ${label.toLowerCase()}!`) // prettier-ignore
  }

  const handleConfirmRestore = () => {
    if (!restoreConfirm.target?.code) return

    const { code } = restoreConfirm.target

    restoreConfirm.close()

    runConfirmed(() => restoreBpMasterAction.executeAsync({ code, type }), `Restoring ${label.toLowerCase()}...`, `Failed to restore ${label.toLowerCase()}!`) // prettier-ignore
  }

  return (
    <div className='flex h-full w-full flex-1 flex-col gap-5'>
      <Header title={pluralLabel} description={description}>
        <div className='flex w-full flex-wrap items-center justify-center gap-2 lg:ml-auto lg:w-auto lg:justify-end'>
          {/* //* the paging rides in the header on a phone, its own row once space runs out */}
          <div className='order-last flex w-full justify-center lg:hidden'>
            <DataTablePagination table={table} isServerSide isCompact />
          </div>

          {canCreate && (
            <CanView subject={permission} action={PERMISSIONS_ALLOWED_ACTIONS.SYNC_TO_SAP}>
              <BpMasterSyncToSap type={type} items={itemsToSync} userCode={userCode} onSynced={handleSynced} />
            </CanView>
          )}

          <CanView subject={permission} action={PERMISSIONS_ALLOWED_ACTIONS.SYNC_FROM_SAP}>
            <BpMasterSyncFromSap type={type} lookups={lookups} userCode={userCode} onSynced={handleSynced} />
          </CanView>

          {canCreate && (
            <CanView subject={permission} action={PERMISSIONS_ALLOWED_ACTIONS.CREATE}>
              <TooltipWrapper label={`Add ${label}`}>
                <Button type='button' onClick={() => router.push(`${route}/add`)}>
                  <Icons.plus /> Add {label}
                </Button>
              </TooltipWrapper>
            </CanView>
          )}

          <div className='flex shrink-0 items-center gap-2'>
            <DataTableRefreshButton onRefresh={refreshTable} isLoading={isLoading} />

            <DataTableShowDeletedToggle isShowDeleted={isShowDeleted} onToggle={setIsShowDeleted} isLoading={isLoading} />

            <CanView subject={permission} action={PERMISSIONS_ALLOWED_ACTIONS.EXPORT}>
              <DataTableExportButton onExport={handleExport} isLoading={dataTableBpMastersSvrExport.isExecuting} />
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
              <DataTableColumnFilter column={table.getColumn('GroupName')} title='Group' isLoading={isLoading} />
              <DataTableColumnFilter column={table.getColumn('CurrName')} title='Currency' isLoading={isLoading} />
              <DataTableColumnFilter column={table.getColumn('syncStatus')} title='Sync Status' isLoading={isLoading} />
              <DataTableColumnFilter column={table.getColumn('isActive')} title='Active' isLoading={isLoading} />
              <DataTableColumnDateFilter column={table.getColumn('createdAt')} title='Created At' isLoading={isLoading} />
              <DataTableColumnDateFilter column={table.getColumn('updatedAt')} title='Updated At' isLoading={isLoading} />
            </DataTableColumnFilterWrapper>
          </DataTableToolbar>

          <DataTable
            table={table}
            isLoading={isLoading}
            isServerSide
            getRowClassName={getSoftDeletedRowClassName}
            paginationClassName='max-lg:hidden'
          />
        </DataTableContainer>
      </ContentWrapper>

      <AlertModal
        isOpen={deleteConfirm.isOpen}
        title='Are you sure?'
        description={`Are you sure you want to delete this ${label.toLowerCase()}${deleteConfirm?.target?.name ? ` "${deleteConfirm.target.name}"` : ''}?`}
        onConfirm={handleConfirmDelete}
        onConfirmText='Delete'
        onCancel={deleteConfirm.close}
      />

      <AlertModal
        isOpen={restoreConfirm.isOpen}
        title='Are you sure?'
        description={`Are you sure you want to restore this ${label.toLowerCase()}${restoreConfirm?.target?.name ? ` "${restoreConfirm.target.name}"` : ''}?`}
        onConfirm={handleConfirmRestore}
        onConfirmText='Restore'
        onCancel={restoreConfirm.close}
      />
    </div>
  )
}
