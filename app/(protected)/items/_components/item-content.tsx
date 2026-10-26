'use client'

import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAction } from 'next-safe-action/hooks'
import { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'

import { ItemRow, deleteItem, getDataTableItemsSvrClient } from '@/actions/item'
import { useDataTableItemsSvr, useItemLookups } from '@/hooks/safe-actions/item'
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
import { DataTableActionsOptions } from '@/components/data-table/data-table-options'
import { DataTablePagination } from '@/components/data-table/data-table-pagination'
import DataTableColumnFilterWrapper from '@/components/data-table/data-table-column-filter-wrapper'
import DataTableRefreshButton from '@/components/data-table/data-table-refresh-button'
import DataTableExportButton from '@/components/data-table/data-table-export-button'
import DataTableColumnFilter from '@/components/data-table/data-table-faceted-filter'
import { FilterOption } from '@/types/data-table'
import { useDataTableServer } from '@/hooks/use-data-table-server'
import { DEFAULT_TABLE_INITIAL_STATE } from '@/constants/data-table'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import Header from '@/components/header'
import SapLiveBadge from '@/components/sap-live-badge'
import { TooltipWrapper } from '@/components/tooltip-wrapper'
import ContentWrapper from '@/components/content-wrapper'
import AlertModal from '@/components/alert-modal'
import { useConfirmAction } from '@/hooks/use-confirm-action'
import CanView from '@/components/rbac/can-view'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { ACTIVE_OPTIONS, toOptionLabel } from '@/constants/business-partner'
import { ITEM_TYPE_OPTIONS, YES_NO_OPTIONS } from '@/constants/item'
import { formatDate } from '@/lib/utils'
import { formatSapDateTime, toSapDateTime } from '@/lib/sap/utils'
import { exportToExcel } from '@/lib/xlsx'

export default function ItemContent() {
  const router = useRouter()

  const DATA_TABLE_UNIQUE_KEY = 'items'

  const deleteConfirm = useConfirmAction<{ code: string; name: string }>()

  const lookups = useItemLookups()

  //* picker values are the sap codes, the server filters on them as is
  const filterOptions = useMemo(() => {
    const { itemGroups, vatGroups } = lookups.data

    return {
      itemGroups: itemGroups.map((g): FilterOption => ({ label: g.GroupName, value: String(g.Number) })),
      vatGroups: vatGroups.map((v): FilterOption => ({ label: v.Name, value: v.Code }))
    }
  }, [lookups.data])

  const columns: ColumnDef<ItemRow>[] = [
    {
      accessorKey: 'ItemCode',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Item No.' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.ItemCode} highlight={table.getState().globalFilter} />,
      meta: { title: 'Item No.', exportValue: (row) => row.ItemCode }
    },
    {
      accessorKey: 'ItemName',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Description' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.ItemName} highlight={table.getState().globalFilter} />,
      meta: { title: 'Description', exportValue: (row) => row.ItemName }
    },
    {
      accessorKey: 'ItemType',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Item Type' />,
      cell: ({ row: { original: data } }) => (
        <DataTableTextCell value={toOptionLabel(ITEM_TYPE_OPTIONS, data.ItemType)} highlight={table.getState().globalFilter} />
      ),
      meta: { title: 'Item Type', options: ITEM_TYPE_OPTIONS, exportValue: (row) => toOptionLabel(ITEM_TYPE_OPTIONS, row.ItemType) }
    },
    {
      accessorKey: 'ItemGroupName',
      enableSorting: false,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Item Group' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.ItemGroupName} highlight={table.getState().globalFilter} />,
      meta: { title: 'Item Group', options: filterOptions.itemGroups, exportValue: (row) => row.ItemGroupName }
    },
    {
      accessorKey: 'InventoryItem',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Inventory Item' />,
      cell: ({ row: { original: data } }) => (
        <DataTableBooleanCell
          value={data.InventoryItem === 'tYES'}
          display={{ type: 'text', true: 'Yes', false: 'No' }}
          highlight={table.getState().globalFilter}
        />
      ),
      meta: { title: 'Inventory Item', options: YES_NO_OPTIONS, exportValue: (row) => (row.InventoryItem === 'tYES' ? 'Yes' : 'No') }
    },
    {
      accessorKey: 'SalesItem',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Sales Item' />,
      cell: ({ row: { original: data } }) => (
        <DataTableBooleanCell
          value={data.SalesItem === 'tYES'}
          display={{ type: 'text', true: 'Yes', false: 'No' }}
          highlight={table.getState().globalFilter}
        />
      ),
      meta: { title: 'Sales Item', options: YES_NO_OPTIONS, exportValue: (row) => (row.SalesItem === 'tYES' ? 'Yes' : 'No') }
    },
    {
      accessorKey: 'PurchaseItem',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Purchase Item' />,
      cell: ({ row: { original: data } }) => (
        <DataTableBooleanCell
          value={data.PurchaseItem === 'tYES'}
          display={{ type: 'text', true: 'Yes', false: 'No' }}
          highlight={table.getState().globalFilter}
        />
      ),
      meta: { title: 'Purchase Item', options: YES_NO_OPTIONS, exportValue: (row) => (row.PurchaseItem === 'tYES' ? 'Yes' : 'No') }
    },
    {
      accessorKey: 'WTLiable',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Withholding Tax Liable' />,
      cell: ({ row: { original: data } }) => (
        <DataTableBooleanCell
          value={data.WTLiable === 'tYES'}
          display={{ type: 'text', true: 'Yes', false: 'No' }}
          highlight={table.getState().globalFilter}
        />
      ),
      meta: { title: 'Withholding Tax Liable', options: YES_NO_OPTIONS, exportValue: (row) => (row.WTLiable === 'tYES' ? 'Yes' : 'No') }
    },
    {
      accessorKey: 'ManufacturerName',
      enableSorting: false,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Manufacturer' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.ManufacturerName} highlight={table.getState().globalFilter} />,
      meta: { title: 'Manufacturer', exportValue: (row) => row.ManufacturerName }
    },
    {
      accessorKey: 'TaxGroupName',
      enableSorting: false,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Tax Group' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.TaxGroupName} highlight={table.getState().globalFilter} />,
      meta: { title: 'Tax Group', options: filterOptions.vatGroups, exportValue: (row) => row.TaxGroupName }
    },
    {
      accessorKey: 'Valid',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Active' />,
      cell: ({ row: { original: data } }) => (
        <DataTableBooleanCell
          value={data.Valid === 'tYES'}
          display={{ type: 'text', true: 'Yes', false: 'No' }}
          highlight={table.getState().globalFilter}
        />
      ),
      meta: { title: 'Active', options: ACTIVE_OPTIONS, exportValue: (row) => (row.Valid === 'tYES' ? 'Yes' : 'No') }
    },
    {
      id: 'CreatedAt',
      accessorFn: (row) => toSapDateTime(row.CreateDate, row.CreateTime),
      enableSorting: false,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Created At' />,
      cell: ({ row: { original: data } }) => (
        <DataTableDateCell
          value={toSapDateTime(data.CreateDate, data.CreateTime)}
          formatStr={data.CreateTime ? undefined : 'MMM d, yyyy'}
        />
      ),
      meta: {
        title: 'Created At',
        exportValue: (row) => formatSapDateTime(row.CreateDate, row.CreateTime, 'yyyy-MM-dd HH:mm:ss', 'yyyy-MM-dd')
      }
    },
    {
      id: 'UpdatedAt',
      accessorFn: (row) => toSapDateTime(row.UpdateDate, row.UpdateTime),
      enableSorting: false,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Updated At' />,
      cell: ({ row: { original: data } }) => (
        <DataTableDateCell
          value={toSapDateTime(data.UpdateDate, data.UpdateTime)}
          formatStr={data.UpdateTime ? undefined : 'MMM d, yyyy'}
        />
      ),
      meta: {
        title: 'Updated At',
        exportValue: (row) => formatSapDateTime(row.UpdateDate, row.UpdateTime, 'yyyy-MM-dd HH:mm:ss', 'yyyy-MM-dd')
      }
    },
    {
      accessorKey: 'actions',
      enableSorting: false,
      enableHiding: false,
      minSize: 140,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Actions' className='text-center' />,
      cell: ({ row: { original } }) => {
        const { ItemCode, ItemName } = original
        const href = `/items/${encodeURIComponent(ItemCode)}`

        return (
          <DataTableActionsCellWrapper>
            <CanView subject={PERMISSIONS_CODES.ITEMS} action={PERMISSIONS_ALLOWED_ACTIONS.VIEW}>
              <TooltipWrapper label='View'>
                <Button variant='ghost' size='icon-sm' onClick={() => router.push(`${href}/view`)}>
                  <Icons.eye className='text-muted-foreground size-4' />
                </Button>
              </TooltipWrapper>
            </CanView>

            <CanView subject={PERMISSIONS_CODES.ITEMS} action={PERMISSIONS_ALLOWED_ACTIONS.EDIT}>
              <TooltipWrapper label='Edit'>
                <Button variant='ghost' size='icon-sm' onClick={() => router.push(href)}>
                  <Icons.pencil className='text-muted-foreground size-4' />
                </Button>
              </TooltipWrapper>
            </CanView>

            <CanView subject={PERMISSIONS_CODES.ITEMS} action={PERMISSIONS_ALLOWED_ACTIONS.DELETE}>
              <TooltipWrapper label='Delete'>
                <Button variant='ghost' size='icon-sm' onClick={() => deleteConfirm.open({ code: ItemCode, name: ItemName })}>
                  <Icons.trash className='text-destructive size-4' />
                </Button>
              </TooltipWrapper>
            </CanView>
          </DataTableActionsCellWrapper>
        )
      }
    }
  ]

  const { table, params, setData, setRowCount, refreshKey, refetch, refreshTable } = useDataTableServer({
    columns,
    initialState: { ...DEFAULT_TABLE_INITIAL_STATE, columnVisibility: { CreatedAt: false, UpdatedAt: false } },
    getRowId: (row) => row.ItemCode
  })

  //* fetched once above, every table request reuses it
  const tableLookups = lookups.isLoaded ? lookups.data : undefined

  const tableParams = { ...params, lookups: tableLookups }

  const dataTableItemsSvr = useDataTableItemsSvr(tableParams, { setData, setRowCount, setPageIndex: table.setPageIndex }, [refreshKey])
  const dataTableItemsSvrExport = useAction(getDataTableItemsSvrClient)
  const deleteItemAction = useAction(deleteItem)

  const listError = dataTableItemsSvr.data.error

  //* sap failures come back as an error, not as an empty list
  useEffect(() => {
    if (listError) toast.error(listError)
  }, [listError])

  const handleExport = async () => {
    if (!tableLookups) return

    const visibleColumns = table.getVisibleLeafColumns().filter((column) => column.id !== 'actions' && column.columnDef.meta?.exportValue)

    if (visibleColumns.length === 0) {
      toast.error('No columns available to export!')
      return
    }

    const headers = visibleColumns.map((column) => column.columnDef.meta?.title ?? column.id)

    toast.promise(dataTableItemsSvrExport.executeAsync({ ...params, lookups: tableLookups, isExport: true }), {
      loading: 'Preparing export...',
      success: (response) => {
        const result = response?.data

        if (!response || !result) throw { message: 'Failed to export items!', unExpectedError: true }

        const rows = result.data.map((row) => visibleColumns.map((column) => column.columnDef.meta!.exportValue!(row)))

        exportToExcel({
          fileName: `${DATA_TABLE_UNIQUE_KEY.toUpperCase()}-${formatDate(new Date(), 'yyyy-MM-dd-HHmmss')}.xlsx`,
          sheetName: 'EXPORTED_DATA',
          headers,
          rows
        })

        return 'Items exported successfully!'
      },
      error: (err: Error & { expectedError: boolean }) => {
        return err?.expectedError ? err.message : 'Something went wrong! Please try again later.'
      }
    })
  }

  const handleConfirmDeleteItem = async () => {
    if (!deleteConfirm.target?.code) return

    const { code } = deleteConfirm.target

    deleteConfirm.close()

    toast.promise(deleteItemAction.executeAsync({ code }), {
      loading: 'Deleting item...',
      success: (response) => {
        const result = response?.data

        if (!response || !result) throw { message: 'Failed to delete item!', unExpectedError: true }

        if (!result.error) {
          refetch()

          return result.message
        }

        //* sap's own reason, e.g. the item is used in documents
        throw { message: result.message, expectedError: true }
      },
      error: (err: Error & { expectedError: boolean }) => {
        return err?.expectedError ? err.message : 'Something went wrong! Please try again later.'
      }
    })
  }

  return (
    <div className='flex h-full w-full flex-1 flex-col gap-5'>
      <Header title='Items' description='Manage the items in SAP' badge={<SapLiveBadge />}>
        <div className='flex w-full flex-wrap items-center justify-center gap-2 lg:ml-auto lg:w-auto lg:justify-end'>
          {/* //* the paging rides in the header on a phone, its own row once space runs out */}
          <div className='order-last flex w-full justify-center lg:hidden'>
            <DataTablePagination table={table} isServerSide isCompact />
          </div>

          <CanView subject={PERMISSIONS_CODES.ITEMS} action={PERMISSIONS_ALLOWED_ACTIONS.CREATE}>
            <TooltipWrapper label='Add Item'>
              <Button type='button' onClick={() => router.push('/items/add')}>
                <Icons.plus /> Add Item
              </Button>
            </TooltipWrapper>
          </CanView>

          <div className='flex shrink-0 items-center gap-2'>
            <DataTableRefreshButton onRefresh={refreshTable} isLoading={dataTableItemsSvr.isLoading} />

            <CanView subject={PERMISSIONS_CODES.ITEMS} action={PERMISSIONS_ALLOWED_ACTIONS.EXPORT}>
              <DataTableExportButton onExport={handleExport} isLoading={dataTableItemsSvrExport.isExecuting} />
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
              <DataTableGlobalSearch table={table} placeholder='Search...' isLoading={dataTableItemsSvr.isLoading} />
              <DataTableColumnFilter column={table.getColumn('ItemType')} title='Item Type' isLoading={dataTableItemsSvr.isLoading} />
              <DataTableColumnFilter column={table.getColumn('ItemGroupName')} title='Item Group' isLoading={lookups.isLoading} />
              <DataTableColumnFilter
                column={table.getColumn('InventoryItem')}
                title='Inventory Item'
                isLoading={dataTableItemsSvr.isLoading}
              />
              <DataTableColumnFilter column={table.getColumn('SalesItem')} title='Sales Item' isLoading={dataTableItemsSvr.isLoading} />
              <DataTableColumnFilter
                column={table.getColumn('PurchaseItem')}
                title='Purchase Item'
                isLoading={dataTableItemsSvr.isLoading}
              />
              <DataTableColumnFilter
                column={table.getColumn('WTLiable')}
                title='Withholding Tax Liable'
                isLoading={dataTableItemsSvr.isLoading}
              />
              <DataTableColumnFilter column={table.getColumn('TaxGroupName')} title='Tax Group' isLoading={lookups.isLoading} />
              <DataTableColumnFilter column={table.getColumn('Valid')} title='Active' isLoading={dataTableItemsSvr.isLoading} />
            </DataTableColumnFilterWrapper>
          </DataTableToolbar>

          <DataTable table={table} isLoading={dataTableItemsSvr.isLoading} isServerSide paginationClassName='max-lg:hidden' />
        </DataTableContainer>
      </ContentWrapper>

      <AlertModal
        isOpen={deleteConfirm.isOpen}
        title='Are you sure?'
        description={`Are you sure you want to delete the item "${deleteConfirm.target?.name}" (${deleteConfirm.target?.code}) in SAP? This cannot be undone.`}
        onConfirm={handleConfirmDeleteItem}
        onConfirmText='Delete'
        onCancel={deleteConfirm.close}
      />
    </div>
  )
}
