'use client'

import { useRouter } from 'next/navigation'
import { ColumnDef } from '@tanstack/react-table'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'

import { useDataTablePackagingUnitsSvr } from '@/hooks/safe-actions/packaging-unit'
import { DataTable } from '@/components/data-table/data-table'
import {
  DataTableActionsCellWrapper,
  DataTableBooleanCell,
  DataTableDateCell,
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
import DataTableColumnFilter from '@/components/data-table/data-table-faceted-filter'
import { dateFilterFn, getSoftDeletedRowClassName, multiSelectFilterFn } from '@/lib/data-table'
import DataTableShowDeletedToggle from '@/components/data-table/data-table-show-deleted-toggle'
import { DataTableActionsOptions } from '@/components/data-table/data-table-options'
import { DataTablePagination } from '@/components/data-table/data-table-pagination'
import DataTableColumnDateFilter from '@/components/data-table/data-table-column-date-filter'
import { useDataTableServer } from '@/hooks/use-data-table-server'
import { DEFAULT_TABLE_INITIAL_STATE } from '@/constants/data-table'
import Header from '@/components/header'
import { TooltipWrapper } from '@/components/tooltip-wrapper'
import ContentWrapper from '@/components/content-wrapper'
import { getDataTablePackagingUnitsSvrClient, getPackagingUnitSelectIdsClient, PackagingUnitWithRelations } from '@/actions/packaging-unit'
import { useConfirmAction } from '@/hooks/use-confirm-action'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import CanView from '@/components/rbac/can-view'
import RelationLink from '@/components/relation-link'
import { formatDate } from '@/lib/utils'
import { exportToExcel } from '@/lib/xlsx'
import DataTableColumnFilterWrapper from '@/components/data-table/data-table-column-filter-wrapper'
import DataTableRefreshButton from '@/components/data-table/data-table-refresh-button'
import DataTableExportButton from '@/components/data-table/data-table-export-button'
import { FilterOption } from '@/types/data-table'
import { Checkbox } from '@/components/ui/checkbox'
import { ButtonGroup } from '@/components/ui/button-group'
import LoadingButton from '@/components/forms/button-field'
import LabelSizeModal from '@/components/label-size-modal'
import { LABEL_MAX_COUNT, LabelSize } from '@/constants/label'
import { getAgingDays, getPackagingUnitLabelPdfHref, getPackagingUnitTransaction } from '@/lib/packaging-unit'
import { useLabelsPdf } from '@/hooks/use-labels-pdf'
import { logger } from '@/lib/logger'
import ItemMasterThumbnail from '@/app/(protected)/item-masters/_components/item-master-thumbnail'

type LabelTarget = { mode: 'single'; code: string } | { mode: 'bulk' }

type Row = PackagingUnitWithRelations

const toDateText = (date: Date | null) => (date ? formatDate(new Date(date), 'yyyy-MM-dd HH:mm:ss') : '')

//* hidden until turned on in the column options
const HIDDEN_COLUMNS = {
  thumbnail: false,
  projectCategoryCode: false,
  site: false,
  isMandatoryQc: false,
  receivedAt: false,
  receivedBy: false,
  notes: false,
  createdAt: false,
  updatedAt: false
}

type PackagingUnitContentProps = { projectOptions: FilterOption[]; locationOptions: FilterOption[]; containerOptions: FilterOption[] }

export default function PackagingUnitContent({ projectOptions, locationOptions, containerOptions }: PackagingUnitContentProps) {
  const router = useRouter()

  const DATA_TABLE_UNIQUE_KEY = 'unique-ids'

  const labelModal = useConfirmAction<LabelTarget>()
  const selectAllAction = useAction(getPackagingUnitSelectIdsClient)
  const dataTablePackagingUnitsSvrExport = useAction(getDataTablePackagingUnitsSvrClient)
  const labelsPdf = useLabelsPdf('/api/packaging-units/labels/pdf')

  const columns: ColumnDef<Row>[] = [
    {
      id: 'select',
      enableSorting: false,
      enableHiding: false,
      size: 44,
      minSize: 44,
      maxSize: 44,
      header: () => (
        <div className='flex justify-center'>
          <Checkbox
            aria-label='Select all matching rows'
            checked={isAllSelected ? true : selectedIds.length > 0 ? 'indeterminate' : false}
            disabled={selectAllAction.isExecuting}
            onCheckedChange={(value) => (value === true ? handleSelectAll() : table.resetRowSelection())}
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className='flex justify-center'>
          <Checkbox
            aria-label='Select row'
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
          />
        </div>
      ),
      meta: { title: 'Select' }
    },
    {
      accessorKey: 'code',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Code' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.code} highlight={table.getState().globalFilter} />,
      meta: { title: 'Code', exportValue: (row) => row.code }
    },
    {
      id: 'thumbnail',
      enableSorting: false,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Thumbnail' />,
      cell: ({ row: { original: data } }) => (
        <ItemMasterThumbnail id={data.inboundItem.itemMaster.thumbnail} alt={data.inboundItem.itemMaster.ItemCode} />
      ),
      meta: { title: 'Thumbnail' }
    },
    {
      id: 'sessionCode',
      enableSorting: false,
      accessorFn: (row) => getPackagingUnitTransaction(row).sessionCode,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Session' />,
      cell: ({ row: { original: data } }) => {
        const { sessionCode } = getPackagingUnitTransaction(data)

        return (
          <RelationLink href={`/sessions/${encodeURIComponent(sessionCode)}/view`}>
            <DataTableTextCell value={sessionCode} highlight={table.getState().globalFilter} />
          </RelationLink>
        )
      },
      meta: { title: 'Session', exportValue: (row) => getPackagingUnitTransaction(row).sessionCode }
    },
    {
      id: 'transactionCode',
      enableSorting: false,
      accessorFn: (row) => getPackagingUnitTransaction(row).code,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Transaction' />,
      cell: ({ row: { original: data } }) => {
        const transaction = getPackagingUnitTransaction(data)

        return (
          <RelationLink href={transaction.href}>
            <DataTableTextCell value={transaction.code} highlight={table.getState().globalFilter} />
          </RelationLink>
        )
      },
      meta: { title: 'Transaction', exportValue: (row) => getPackagingUnitTransaction(row).code }
    },
    {
      accessorKey: 'customerProjectCode',
      filterFn: multiSelectFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Project' />,
      cell: ({ row: { original: data } }) => (
        <RelationLink href={`/customer-projects/${encodeURIComponent(data.customerProjectCode)}/view`}>
          <DataTableTextCell value={data.customerProjectCode} highlight={table.getState().globalFilter} />
        </RelationLink>
      ),
      meta: {
        title: 'Project',
        options: projectOptions,
        exportValue: (row) => `${row.customerProject.code} (${row.customerProject.name})`
      }
    },
    {
      accessorKey: 'projectCategoryCode',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Project Category' />,
      cell: ({ row: { original: data } }) => (
        <RelationLink href={`/project-categories/${encodeURIComponent(data.projectCategoryCode)}/view`}>
          <DataTableTextCell value={data.projectCategoryCode} />
        </RelationLink>
      ),
      meta: { title: 'Project Category', exportValue: (row) => `${row.projectCategory.code} (${row.projectCategory.name})` }
    },
    {
      id: 'owner',
      accessorFn: (row) => row.inboundItem.owner ?? '',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Owner' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.inboundItem.owner} />,
      meta: { title: 'Owner', exportValue: (row) => row.inboundItem.owner ?? '' }
    },
    {
      id: 'mpn',
      accessorFn: (row) => row.inboundItem.mpn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='MFG P/N' />,
      cell: ({ row: { original: data } }) => (
        <RelationLink href={`/item-masters/${encodeURIComponent(data.inboundItem.mpn)}/view`}>
          <DataTableTextCell value={data.inboundItem.mpn} highlight={table.getState().globalFilter} />
        </RelationLink>
      ),
      meta: { title: 'MFG P/N', exportValue: (row) => row.inboundItem.mpn }
    },
    {
      id: 'partNumber',
      accessorFn: (row) => row.inboundItem.partNumber ?? '',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Part Number' />,
      cell: ({ row: { original: data } }) => (
        <DataTableTextCell value={data.inboundItem.partNumber} highlight={table.getState().globalFilter} />
      ),
      meta: { title: 'Part Number', exportValue: (row) => row.inboundItem.partNumber ?? '' }
    },
    {
      id: 'manufacturer',
      enableSorting: false,
      accessorFn: (row) => row.inboundItem.itemMaster.FirmName ?? '',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Manufacturer' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.inboundItem.itemMaster.FirmName} />,
      meta: { title: 'Manufacturer', exportValue: (row) => row.inboundItem.itemMaster.FirmName ?? '' }
    },
    {
      id: 'description',
      enableSorting: false,
      minSize: 220,
      accessorFn: (row) => row.inboundItem.itemMaster.ItemName ?? '',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Description' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.inboundItem.itemMaster.ItemName} isWrap />,
      meta: { title: 'Description', exportValue: (row) => row.inboundItem.itemMaster.ItemName ?? '' }
    },
    {
      id: 'poNum',
      enableSorting: false,
      accessorFn: (row) => row.inboundItem.inbound.poNum ?? '',
      header: ({ column }) => <DataTableColumnHeader column={column} title='PO Number' />,
      cell: ({ row: { original: data } }) => (
        <DataTableTextCell value={data.inboundItem.inbound.poNum} highlight={table.getState().globalFilter} />
      ),
      meta: { title: 'PO Number', exportValue: (row) => row.inboundItem.inbound.poNum ?? '' }
    },
    {
      id: 'commodity',
      enableSorting: false,
      accessorFn: (row) => row.inboundItem.commodity?.name ?? '',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Commodity' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.inboundItem.commodity?.name} />,
      meta: {
        title: 'Commodity',
        exportValue: (row) => (row.inboundItem.commodity ? `${row.inboundItem.commodity.code} (${row.inboundItem.commodity.name})` : '')
      }
    },
    {
      id: 'dateCode',
      accessorFn: (row) => row.inboundItem.dateCode ?? '',
      header: ({ column }) => <DataTableColumnHeader column={column} title='DC' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.inboundItem.dateCode} />,
      meta: { title: 'DC', exportValue: (row) => row.inboundItem.dateCode ?? '' }
    },
    {
      id: 'countryOfOrigin',
      accessorFn: (row) => row.inboundItem.countryOfOrigin ?? '',
      header: ({ column }) => <DataTableColumnHeader column={column} title='COO' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.inboundItem.countryOfOrigin} />,
      meta: { title: 'COO', exportValue: (row) => row.inboundItem.countryOfOrigin ?? '' }
    },
    {
      id: 'lotCode',
      accessorFn: (row) => row.inboundItem.lotCode ?? '',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Lot Code' />,
      cell: ({ row: { original: data } }) => (
        <DataTableTextCell value={data.inboundItem.lotCode} highlight={table.getState().globalFilter} />
      ),
      meta: { title: 'Lot Code', exportValue: (row) => row.inboundItem.lotCode ?? '' }
    },
    {
      id: 'site',
      enableSorting: false,
      accessorFn: (row) => row.location.site.code,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Site' />,
      cell: ({ row: { original: data } }) => (
        <RelationLink href={`/sites/${encodeURIComponent(data.location.site.code)}/view`}>
          <DataTableTextCell value={data.location.site.code} />
        </RelationLink>
      ),
      meta: { title: 'Site', exportValue: (row) => `${row.location.site.code} (${row.location.site.name})` }
    },
    {
      accessorKey: 'locationCode',
      filterFn: multiSelectFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Location' />,
      cell: ({ row: { original: data } }) => (
        <RelationLink href={`/locations/${encodeURIComponent(data.locationCode)}/view`}>
          <DataTableTextCell value={data.locationCode} highlight={table.getState().globalFilter} />
        </RelationLink>
      ),
      meta: { title: 'Location', options: locationOptions, exportValue: (row) => row.locationCode }
    },
    {
      accessorKey: 'palletCode',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Pallet' />,
      cell: ({ row: { original: data } }) => {
        if (!data.palletCode) return <DataTableTextCell value={null} />

        return (
          <RelationLink href={`/pallets/${encodeURIComponent(data.palletCode)}/view`}>
            <DataTableTextCell value={data.palletCode} highlight={table.getState().globalFilter} />
          </RelationLink>
        )
      },
      meta: { title: 'Pallet', exportValue: (row) => row.palletCode ?? '' }
    },
    {
      accessorKey: 'containerCode',
      filterFn: multiSelectFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Container' />,
      cell: ({ row: { original: data } }) => {
        if (!data.containerCode) return <DataTableTextCell value={null} />

        return (
          <RelationLink href={`/containers/${encodeURIComponent(data.containerCode)}/view`}>
            <DataTableTextCell value={data.containerCode} highlight={table.getState().globalFilter} />
          </RelationLink>
        )
      },
      meta: { title: 'Container', options: containerOptions, exportValue: (row) => row.containerCode ?? '' }
    },
    {
      id: 'packagingType',
      enableSorting: false,
      accessorFn: (row) => row.inboundItem.packagingType?.name ?? '',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Packaging Type' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.inboundItem.packagingType?.name} />,
      meta: {
        title: 'Packaging Type',
        exportValue: (row) =>
          row.inboundItem.packagingType ? `${row.inboundItem.packagingType.code} (${row.inboundItem.packagingType.name})` : ''
      }
    },
    {
      id: 'spq',
      accessorFn: (row) => row.inboundItem.spq,
      header: ({ column }) => <DataTableColumnHeader column={column} title='SPQ' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.inboundItem.spq} />,
      meta: { title: 'SPQ', exportValue: (row) => row.inboundItem.spq ?? '' }
    },
    {
      id: 'cost',
      accessorFn: (row) => row.inboundItem.cost,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Cost' />,
      cell: ({ row: { original: data } }) => (
        <DataTableNumberCell value={data.inboundItem.cost} minimumFractionDigits={4} maximumFractionDigits={6} />
      ),
      meta: { title: 'Cost', exportValue: (row) => row.inboundItem.cost ?? '' }
    },
    {
      accessorKey: 'quantity',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Quantity' />,
      cell: ({ row: { original: data } }) => <DataTableNumberCell value={data.quantity} maximumFractionDigits={6} />,
      meta: { title: 'Quantity', exportValue: (row) => row.quantity }
    },
    {
      id: 'agingDays',
      enableSorting: false,
      accessorFn: (row) => getAgingDays(row.receivedAt),
      header: ({ column }) => <DataTableColumnHeader column={column} title='Aging Days' />,
      cell: ({ row: { original: data } }) => <DataTableNumberCell value={getAgingDays(data.receivedAt)} />,
      meta: { title: 'Aging Days', exportValue: (row) => getAgingDays(row.receivedAt) }
    },
    {
      id: 'isMandatoryQc',
      enableSorting: false,
      accessorFn: (row) => (row.inboundItem.isMandatoryQc ? 'Yes' : 'No'),
      header: ({ column }) => <DataTableColumnHeader column={column} title='Mandatory QC' />,
      cell: ({ row: { original: data } }) => (
        <DataTableBooleanCell value={data.inboundItem.isMandatoryQc} display={{ type: 'text', true: 'Yes', false: 'No' }} />
      ),
      meta: { title: 'Mandatory QC', exportValue: (row) => (row.inboundItem.isMandatoryQc ? 'Yes' : 'No') }
    },
    {
      accessorKey: 'receivedAt',
      filterFn: dateFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Date Received' />,
      cell: ({ row: { original: data } }) => <DataTableDateCell value={data.receivedAt} />,
      meta: { title: 'Date Received', exportValue: (row) => toDateText(row.receivedAt) }
    },
    {
      id: 'receivedBy',
      enableSorting: false,
      accessorFn: (row) => row.receivedByUser.name,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Received By' />,
      cell: ({ row: { original: data } }) => (
        <RelationLink href={`/users/${data.receivedByUser.code}/view`}>
          <DataTableTextCell value={data.receivedByUser.name} />
        </RelationLink>
      ),
      meta: { title: 'Received By', exportValue: (row) => row.receivedByUser.name }
    },
    {
      id: 'notes',
      enableSorting: false,
      minSize: 220,
      accessorFn: (row) => row.inboundItem.notes ?? '',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Notes' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.inboundItem.notes} isWrap />,
      meta: { title: 'Notes', exportValue: (row) => row.inboundItem.notes ?? '' }
    },
    {
      accessorKey: 'createdAt',
      filterFn: dateFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Created At' />,
      cell: ({ row: { original: data } }) => <DataTableDateCell value={data.createdAt} />,
      meta: { title: 'Created At', exportValue: (row) => toDateText(row.createdAt) }
    },
    {
      accessorKey: 'updatedAt',
      filterFn: dateFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Updated At' />,
      cell: ({ row: { original: data } }) => <DataTableDateCell value={data.updatedAt} />,
      meta: { title: 'Updated At', exportValue: (row) => toDateText(row.updatedAt) }
    },
    {
      accessorKey: 'actions',
      enableSorting: false,
      enableHiding: false,
      minSize: 140,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Actions' className='text-center' />,
      cell: ({ row: { original } }) => {
        const { code, deletedAt } = original

        //* a deleted unit has no actions, nothing restores it
        if (deletedAt) return <DataTableTextCell value={null} />

        return (
          <DataTableActionsCellWrapper>
            <CanView subject={PERMISSIONS_CODES.PACKAGING_UNITS} action={PERMISSIONS_ALLOWED_ACTIONS.VIEW}>
              <TooltipWrapper label='View'>
                <Button variant='ghost' size='icon-sm' onClick={() => router.push(`/packaging-units/${encodeURIComponent(code)}/view`)}>
                  <Icons.eye className='text-muted-foreground size-4' />
                </Button>
              </TooltipWrapper>
            </CanView>

            <CanView subject={PERMISSIONS_CODES.PACKAGING_UNITS} action={PERMISSIONS_ALLOWED_ACTIONS.EDIT}>
              <TooltipWrapper label='Edit'>
                <Button variant='ghost' size='icon-sm' onClick={() => router.push(`/packaging-units/${encodeURIComponent(code)}`)}>
                  <Icons.pencil className='text-muted-foreground size-4' />
                </Button>
              </TooltipWrapper>
            </CanView>

            <CanView subject={PERMISSIONS_CODES.PACKAGING_UNITS} action={PERMISSIONS_ALLOWED_ACTIONS.VIEW}>
              <TooltipWrapper label='Print Label'>
                <Button variant='ghost' size='icon-sm' onClick={() => labelModal.open({ mode: 'single', code })}>
                  <Icons.qrCode className='text-muted-foreground size-4' />
                </Button>
              </TooltipWrapper>
            </CanView>
          </DataTableActionsCellWrapper>
        )
      }
    }
  ]

  const { table, params, setData, setRowCount, isShowDeleted, setIsShowDeleted, refreshKey, refreshTable } = useDataTableServer({
    columns,
    initialState: {
      ...DEFAULT_TABLE_INITIAL_STATE,
      columnVisibility: HIDDEN_COLUMNS,
      columnPinning: { left: ['select'], right: ['quantity', 'actions'] }
    },
    getRowId: (row) => row.id,
    enableRowSelection: (row) => !row.original.deletedAt
  })

  const dataTablePackagingUnitsSvr = useDataTablePackagingUnitsSvr(params, { setData, setRowCount }, [refreshKey])

  const isLoading = dataTablePackagingUnitsSvr.isLoading

  //* ids are kept across pages, so no rows need to be loaded
  const rowSelection = table.getState().rowSelection
  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id])

  const selectableCount = Math.min(table.getRowCount(), LABEL_MAX_COUNT)
  const isAllSelected = selectedIds.length > 0 && selectedIds.length >= selectableCount

  //* ticks every row matching the current search and filters, up to one pdf's worth
  const handleSelectAll = async () => {
    try {
      const response = await selectAllAction.executeAsync(params)
      const result = response?.data

      if (!result) {
        toast.error('Failed to select unique IDs!')
        return
      }

      //* the server already stops at one pdf's worth
      if (result.rowCount > LABEL_MAX_COUNT) {
        toast.info(
          `Selected the first ${LABEL_MAX_COUNT.toLocaleString('en-US')} of ${result.rowCount.toLocaleString('en-US')}, the most labels one PDF can hold.`
        )
      }

      table.setRowSelection(Object.fromEntries(result.ids.map((id) => [id, true])))
    } catch (err: any) {
      logger.error(err, '[SELECT_ALL_PACKAGING_UNITS_ERROR]:')
      toast.error('Something went wrong! Please try again later.')
    }
  }

  const handleLabelView = async (size: LabelSize) => {
    const target = labelModal.target
    if (!target) return

    if (target.mode === 'single') {
      window.open(getPackagingUnitLabelPdfHref(target.code, size), '_blank')
      labelModal.close()
      return
    }

    if (await labelsPdf.open(selectedIds, size, false)) labelModal.close()
  }

  const handleLabelDownload = async (size: LabelSize) => {
    const target = labelModal.target
    if (!target) return

    if (target.mode === 'single') {
      window.location.assign(getPackagingUnitLabelPdfHref(target.code, size, true))
      labelModal.close()
      return
    }

    if (await labelsPdf.open(selectedIds, size, true)) labelModal.close()
  }

  const handleExport = async () => {
    const visibleColumns = table.getVisibleLeafColumns().filter((column) => column.id !== 'actions' && column.columnDef.meta?.exportValue)

    if (visibleColumns.length === 0) {
      toast.error('No columns available to export!')
      return
    }

    const headers = visibleColumns.map((column) => column.columnDef.meta?.title ?? column.id)

    toast.promise(dataTablePackagingUnitsSvrExport.executeAsync({ ...params, isExport: true }), {
      loading: 'Preparing export...',
      success: (response) => {
        const result = response?.data

        if (!response || !result) throw { message: 'Failed to export unique IDs!', unExpectedError: true }

        const rows = result.data.map((row) => visibleColumns.map((column) => column.columnDef.meta!.exportValue!(row)))

        exportToExcel({
          fileName: `${DATA_TABLE_UNIQUE_KEY.toUpperCase()}-${formatDate(new Date(), 'yyyy-MM-dd-HHmmss')}.xlsx`,
          sheetName: 'EXPORTED_DATA',
          headers,
          rows
        })

        return 'Unique IDs exported successfully!'
      },
      error: (err: Error & { expectedError: boolean }) => {
        return err?.expectedError ? err.message : 'Something went wrong! Please try again later.'
      }
    })
  }

  return (
    <div className='flex h-full w-full flex-1 flex-col gap-5'>
      <Header title='Unique IDs' description='Track every package in stock'>
        <div className='flex w-full flex-wrap items-center justify-center gap-2 lg:ml-auto lg:w-auto lg:justify-end'>
          {/* //* the paging rides in the header on a phone, its own row once space runs out */}
          <div className='order-last flex w-full justify-center lg:hidden'>
            <DataTablePagination table={table} isServerSide isCompact />
          </div>

          {selectedIds.length > 0 && (
            <CanView subject={PERMISSIONS_CODES.PACKAGING_UNITS} action={PERMISSIONS_ALLOWED_ACTIONS.VIEW}>
              <ButtonGroup>
                <TooltipWrapper label='Print Labels'>
                  <LoadingButton
                    type='button'
                    variant='outline-primary'
                    isLoading={labelsPdf.isLoading}
                    onClick={() => labelModal.open({ mode: 'bulk' })}
                  >
                    <Icons.qrCode /> Print {selectedIds.length} {selectedIds.length === 1 ? 'Label' : 'Labels'}
                  </LoadingButton>
                </TooltipWrapper>

                <TooltipWrapper label='Clear Selection'>
                  <Button type='button' variant='outline-primary' size='icon' onClick={() => table.resetRowSelection()}>
                    <Icons.x />
                  </Button>
                </TooltipWrapper>
              </ButtonGroup>
            </CanView>
          )}

          <div className='flex shrink-0 items-center gap-2'>
            <DataTableRefreshButton onRefresh={refreshTable} isLoading={isLoading} />

            <DataTableShowDeletedToggle isShowDeleted={isShowDeleted} onToggle={setIsShowDeleted} isLoading={isLoading} />

            <CanView subject={PERMISSIONS_CODES.PACKAGING_UNITS} action={PERMISSIONS_ALLOWED_ACTIONS.EXPORT}>
              <DataTableExportButton onExport={handleExport} isLoading={dataTablePackagingUnitsSvrExport.isExecuting} />
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
              <DataTableColumnFilter column={table.getColumn('customerProjectCode')} title='Project' isLoading={isLoading} />
              <DataTableColumnFilter column={table.getColumn('locationCode')} title='Location' isLoading={isLoading} />
              <DataTableColumnFilter column={table.getColumn('containerCode')} title='Container' isLoading={isLoading} />
              <DataTableColumnDateFilter column={table.getColumn('receivedAt')} title='Date Received' isLoading={isLoading} />
            </DataTableColumnFilterWrapper>
          </DataTableToolbar>

          <DataTable
            table={table}
            isLoading={isLoading}
            isServerSide
            paginationClassName='max-lg:hidden'
            getRowClassName={getSoftDeletedRowClassName}
          />
        </DataTableContainer>
      </ContentWrapper>

      <LabelSizeModal
        isOpen={labelModal.isOpen}
        title={labelModal.target?.mode === 'single' ? 'Print Label' : 'Print Labels'}
        isBulk={labelModal.target?.mode === 'bulk'}
        description={
          labelModal.target?.mode === 'single'
            ? `QR label for "${labelModal.target.code}"`
            : `QR labels for ${selectedIds.length} selected ${selectedIds.length === 1 ? 'unique ID' : 'unique IDs'}, up to ${LABEL_MAX_COUNT.toLocaleString('en-US')} per PDF`
        }
        isLoading={labelsPdf.isLoading}
        onClose={labelModal.close}
        onView={handleLabelView}
        onDownload={handleLabelDownload}
      />
    </div>
  )
}
