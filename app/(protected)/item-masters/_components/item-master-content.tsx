'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ColumnDef } from '@tanstack/react-table'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'

import { useDataTableItemMastersSvr } from '@/hooks/safe-actions/item-master'
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
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import DataTableColumnFilter from '@/components/data-table/data-table-faceted-filter'
import { dateFilterFn, getSoftDeletedRowClassName, multiSelectFilterFn } from '@/lib/data-table'
import { DataTableActionsOptions } from '@/components/data-table/data-table-options'
import { DataTablePagination } from '@/components/data-table/data-table-pagination'
import DataTableColumnDateFilter from '@/components/data-table/data-table-column-date-filter'
import { useDataTableServer } from '@/hooks/use-data-table-server'
import { DEFAULT_TABLE_INITIAL_STATE } from '@/constants/data-table'
import Header from '@/components/header'
import { TooltipWrapper } from '@/components/tooltip-wrapper'
import ContentWrapper from '@/components/content-wrapper'
import { deleteItemMaster, ItemMasterWithRelations, restoreItemMaster } from '@/actions/item-master'
import AlertModal from '@/components/alert-modal'
import { useConfirmAction } from '@/hooks/use-confirm-action'
import { FilterOption } from '@/types/data-table'
import RelationLink from '@/components/relation-link'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import CanView from '@/components/rbac/can-view'
import { formatDate } from '@/lib/utils'
import { logger } from '@/lib/logger'
import DataTableColumnFilterWrapper from '@/components/data-table/data-table-column-filter-wrapper'
import DataTableShowDeletedToggle from '@/components/data-table/data-table-show-deleted-toggle'
import DataTableRefreshButton from '@/components/data-table/data-table-refresh-button'
import DataTableExportButton from '@/components/data-table/data-table-export-button'
import ItemMasterThumbnail from './item-master-thumbnail'

type ItemMasterContentProps = { manufacturerOptions: FilterOption[]; commodityOptions: FilterOption[] }

const DATA_TABLE_UNIQUE_KEY = 'item-masters'

export default function ItemMasterContent({ manufacturerOptions, commodityOptions }: ItemMasterContentProps) {
  const router = useRouter()

  const [isExporting, setIsExporting] = useState(false)

  const deleteConfirm = useConfirmAction<{ code: string }>()
  const restoreConfirm = useConfirmAction<{ code: string }>()

  const columns: ColumnDef<ItemMasterWithRelations>[] = [
    {
      accessorKey: 'thumbnail',
      enableSorting: false,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Thumbnail' />,
      cell: ({ row: { original: data } }) => <ItemMasterThumbnail id={data.thumbnail} alt={data.code} />,
      meta: { title: 'Thumbnail' }
    },
    {
      accessorKey: 'code',
      header: ({ column }) => <DataTableColumnHeader column={column} title='MFG P/N' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.code} highlight={table.getState().globalFilter} />,
      meta: { title: 'MFG P/N' }
    },
    {
      accessorKey: 'description',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Description' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.description} highlight={table.getState().globalFilter} />,
      meta: { title: 'Description' }
    },
    {
      accessorKey: 'manufacturerCode',
      filterFn: multiSelectFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Manufacturer' />,
      cell: ({ row: { original: data } }) => {
        if (!data.manufacturer) return '—'

        return (
          <RelationLink href={`/manufacturers/${data.manufacturer.code}/view`}>
            <DataTableTextCell value={`${data.manufacturer.code} - ${data.manufacturer.name}`} highlight={table.getState().globalFilter} />
          </RelationLink>
        )
      },
      meta: { title: 'Manufacturer', options: manufacturerOptions }
    },
    {
      accessorKey: 'commodityCode',
      filterFn: multiSelectFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Commodity' />,
      cell: ({ row: { original: data } }) => {
        if (!data.commodity) return '—'

        return (
          <RelationLink href={`/commodities/${data.commodity.code}/view`}>
            <DataTableTextCell value={`${data.commodity.code} - ${data.commodity.name}`} highlight={table.getState().globalFilter} />
          </RelationLink>
        )
      },
      meta: { title: 'Commodity', options: commodityOptions }
    },
    {
      accessorKey: 'notes',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Notes' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.notes} highlight={table.getState().globalFilter} />,
      meta: { title: 'Notes' }
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
      meta: {
        title: 'Active',
        options: [
          { label: 'Yes', value: 'Yes' },
          { label: 'No', value: 'No' }
        ]
      }
    },
    {
      accessorKey: 'createdAt',
      filterFn: dateFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Created At' />,
      cell: ({ row: { original: data } }) => <DataTableDateCell value={data.createdAt} />,
      meta: { title: 'Created At' }
    },
    {
      accessorKey: 'updatedAt',
      filterFn: dateFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Updated At' />,
      cell: ({ row: { original: data } }) => <DataTableDateCell value={data.updatedAt} />,
      meta: { title: 'Updated At' }
    },
    {
      accessorKey: 'actions',
      enableSorting: false,
      enableHiding: false,
      minSize: 140,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Actions' className='text-center' />,
      cell: ({ row: { original } }) => {
        const { code, deletedAt, deletedBy } = original

        const isSoftDeleted = deletedAt && deletedBy

        return (
          <DataTableActionsCellWrapper>
            {!isSoftDeleted ? (
              <>
                <CanView subject={PERMISSIONS_CODES.ITEM_MASTERS} action={PERMISSIONS_ALLOWED_ACTIONS.VIEW}>
                  <TooltipWrapper label='View'>
                    <Button variant='ghost' size='icon-sm' onClick={() => router.push(`/item-masters/${encodeURIComponent(code)}/view`)}>
                      <Icons.eye className='text-muted-foreground size-4' />
                    </Button>
                  </TooltipWrapper>
                </CanView>

                <CanView subject={PERMISSIONS_CODES.ITEM_MASTERS} action={PERMISSIONS_ALLOWED_ACTIONS.EDIT}>
                  <TooltipWrapper label='Edit'>
                    <Button variant='ghost' size='icon-sm' onClick={() => router.push(`/item-masters/${encodeURIComponent(code)}`)}>
                      <Icons.pencil className='text-muted-foreground size-4' />
                    </Button>
                  </TooltipWrapper>
                </CanView>

                <CanView subject={PERMISSIONS_CODES.ITEM_MASTERS} action={PERMISSIONS_ALLOWED_ACTIONS.DELETE}>
                  <TooltipWrapper label='Delete'>
                    <Button variant='ghost' size='icon-sm' onClick={() => deleteConfirm.open({ code })}>
                      <Icons.trash className='text-destructive size-4' />
                    </Button>
                  </TooltipWrapper>
                </CanView>
              </>
            ) : (
              <CanView subject={PERMISSIONS_CODES.ITEM_MASTERS} action={PERMISSIONS_ALLOWED_ACTIONS.RESTORE}>
                <TooltipWrapper label='Restore'>
                  <Button variant='ghost' size='icon-sm' onClick={() => restoreConfirm.open({ code })}>
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
    initialState: { ...DEFAULT_TABLE_INITIAL_STATE, columnVisibility: { notes: false } },
    getRowId: (row) => row.id
  })

  const dataTableItemMastersSvr = useDataTableItemMastersSvr(params, { setData, setRowCount }, [refreshKey])
  const deleteItemMasterAction = useAction(deleteItemMaster)
  const restoreItemMasterAction = useAction(restoreItemMaster)

  const isLoading = dataTableItemMastersSvr.isLoading

  //* the server builds the file, xlsx-js-style cannot embed the thumbnails
  const requestExport = async () => {
    const columnIds = table
      .getVisibleLeafColumns()
      .map((column) => column.id)
      .filter((id) => id !== 'actions')

    if (columnIds.length === 0) throw { message: 'No columns available to export!', expectedError: true }

    const response = await fetch('/api/item-masters/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...params, columnIds })
    })

    if (!response.ok) {
      const body = await response.json().catch(() => null)
      throw { message: body?.message ?? 'Failed to export item masters!', expectedError: true }
    }

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = `${DATA_TABLE_UNIQUE_KEY.toUpperCase()}-${formatDate(new Date(), 'yyyy-MM-dd-HHmmss')}.xlsx`
    link.click()

    URL.revokeObjectURL(url)
  }

  const handleExport = async () => {
    setIsExporting(true)

    toast.promise(
      requestExport().finally(() => setIsExporting(false)),
      {
        loading: 'Preparing export...',
        success: 'Item masters exported successfully!',
        error: (err: Error & { expectedError: boolean }) => {
          if (!err?.expectedError) logger.error(err, '[ITEM_MASTER_EXPORT_ERROR]:')
          return err?.expectedError ? err.message : 'Something went wrong! Please try again later.'
        }
      }
    )
  }

  const handleConfirmDelete = async () => {
    if (!deleteConfirm.target?.code) return

    const { code } = deleteConfirm.target

    deleteConfirm.close()

    toast.promise(deleteItemMasterAction.executeAsync({ code }), {
      loading: 'Deleting item...',
      success: (response) => {
        const result = response?.data

        if (!response || !result) throw { message: 'Failed to delete item!', unExpectedError: true }

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

  const handleConfirmRestore = async () => {
    if (!restoreConfirm.target?.code) return

    const { code } = restoreConfirm.target

    restoreConfirm.close()

    toast.promise(restoreItemMasterAction.executeAsync({ code }), {
      loading: 'Restoring item...',
      success: (response) => {
        const result = response?.data

        if (!response || !result) throw { message: 'Failed to restore item!', unExpectedError: true }

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

  return (
    <div className='flex h-full w-full flex-1 flex-col gap-5'>
      <Header title='Item Master' description='Manage your items, their manufacturer, commodity and thumbnail'>
        <div className='flex w-full flex-wrap items-center justify-center gap-2 lg:ml-auto lg:w-auto lg:justify-end'>
          {/* //* the paging rides in the header on a phone, its own row once space runs out */}
          <div className='order-last flex w-full justify-center lg:hidden'>
            <DataTablePagination table={table} isServerSide isCompact />
          </div>

          <CanView subject={PERMISSIONS_CODES.ITEM_MASTERS} action={PERMISSIONS_ALLOWED_ACTIONS.CREATE}>
            <TooltipWrapper label='Add Item'>
              <Button type='button' onClick={() => router.push('/item-masters/add')}>
                <Icons.plus /> Add Item
              </Button>
            </TooltipWrapper>
          </CanView>

          <div className='flex shrink-0 items-center gap-2'>
            <DataTableRefreshButton onRefresh={refreshTable} isLoading={isLoading} />

            <DataTableShowDeletedToggle isShowDeleted={isShowDeleted} onToggle={setIsShowDeleted} isLoading={isLoading} />

            <CanView subject={PERMISSIONS_CODES.ITEM_MASTERS} action={PERMISSIONS_ALLOWED_ACTIONS.EXPORT}>
              <DataTableExportButton onExport={handleExport} isLoading={isExporting} />
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
              <DataTableColumnFilter column={table.getColumn('manufacturerCode')} title='Manufacturer' isLoading={isLoading} />
              <DataTableColumnFilter column={table.getColumn('commodityCode')} title='Commodity' isLoading={isLoading} />
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
        description={`Are you sure you want to delete this item${deleteConfirm?.target?.code ? ` "${deleteConfirm.target.code}"` : ''}?`}
        onConfirm={handleConfirmDelete}
        onConfirmText='Delete'
        onCancel={deleteConfirm.close}
      />

      <AlertModal
        isOpen={restoreConfirm.isOpen}
        title='Are you sure?'
        description={`Are you sure you want to restore this item${restoreConfirm?.target?.code ? ` "${restoreConfirm.target.code}"` : ''}?`}
        onConfirm={handleConfirmRestore}
        onConfirmText='Restore'
        onCancel={restoreConfirm.close}
      />
    </div>
  )
}
