'use client'

import { useRouter } from 'next/navigation'
import { ColumnDef } from '@tanstack/react-table'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'

import { useDataTableContainersSvr } from '@/hooks/safe-actions/container'
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
import { ContainerWithRelations, deleteContainer, getDataTableContainersSvrClient, restoreContainer } from '@/actions/container'
import AlertModal from '@/components/alert-modal'
import { useConfirmAction } from '@/hooks/use-confirm-action'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import CanView from '@/components/rbac/can-view'
import { formatDate } from '@/lib/utils'
import { exportToExcel } from '@/lib/xlsx'
import DataTableColumnFilterWrapper from '@/components/data-table/data-table-column-filter-wrapper'
import DataTableShowDeletedToggle from '@/components/data-table/data-table-show-deleted-toggle'
import DataTableRefreshButton from '@/components/data-table/data-table-refresh-button'
import DataTableExportButton from '@/components/data-table/data-table-export-button'
import { STORAGE_UNIT_STATUS_LABELS, STORAGE_UNIT_STATUS_OPTIONS } from '@/constants/storage-unit'
import { CONTAINER_TYPE_LABELS, CONTAINER_TYPE_OPTIONS } from '@/constants/container'
import { FilterOption } from '@/types/data-table'
import { Checkbox } from '@/components/ui/checkbox'
import { ButtonGroup } from '@/components/ui/button-group'
import LoadingButton from '@/components/forms/button-field'
import LabelSizeModal from '@/components/label-size-modal'
import { LABEL_MAX_COUNT, LabelSize } from '@/constants/label'
import { getContainerLabelPdfHref } from '@/lib/container'
import { useLabelsPdf } from '@/hooks/use-labels-pdf'
import { logger } from '@/lib/logger'

type LabelTarget = { mode: 'single'; code: string } | { mode: 'bulk' }

const YES_NO_OPTIONS = [
  { label: 'Yes', value: 'Yes' },
  { label: 'No', value: 'No' }
]

const toDateText = (date: Date | null) => (date ? formatDate(new Date(date), 'yyyy-MM-dd HH:mm:ss') : '')

type ContainerContentProps = {
  categoryOptions: FilterOption[]
  projectOptions: FilterOption[]
  locationOptions: FilterOption[]
  palletOptions: FilterOption[]
}

export default function ContainerContent({ categoryOptions, projectOptions, locationOptions, palletOptions }: ContainerContentProps) {
  const router = useRouter()

  const DATA_TABLE_UNIQUE_KEY = 'containers'

  const deleteConfirm = useConfirmAction<{ code: string }>()
  const restoreConfirm = useConfirmAction<{ code: string }>()
  const labelModal = useConfirmAction<LabelTarget>()
  const selectAllAction = useAction(getDataTableContainersSvrClient)
  const dataTableContainersSvrExport = useAction(getDataTableContainersSvrClient)
  const deleteContainerAction = useAction(deleteContainer)
  const restoreContainerAction = useAction(restoreContainer)
  const labelsPdf = useLabelsPdf('/api/containers/labels/pdf')

  const columns: ColumnDef<ContainerWithRelations>[] = [
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
      cell: ({ row }) =>
        row.getCanSelect() ? (
          <div className='flex justify-center'>
            <Checkbox aria-label='Select row' checked={row.getIsSelected()} onCheckedChange={(value) => row.toggleSelected(!!value)} />
          </div>
        ) : null,
      meta: { title: 'Select' }
    },
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
      cell: ({ row: { original: data } }) => <DataTableTextCell value={STORAGE_UNIT_STATUS_LABELS[data.status]} />,
      meta: { title: 'Status', options: STORAGE_UNIT_STATUS_OPTIONS, exportValue: (row) => STORAGE_UNIT_STATUS_LABELS[row.status] }
    },
    {
      accessorKey: 'type',
      filterFn: multiSelectFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Type' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={CONTAINER_TYPE_LABELS[data.type]} />,
      meta: { title: 'Type', options: CONTAINER_TYPE_OPTIONS, exportValue: (row) => CONTAINER_TYPE_LABELS[row.type] }
    },
    {
      accessorFn: (row) => (row?.isGeneralPurpose ? 'Yes' : 'No'),
      accessorKey: 'isGeneralPurpose',
      filterFn: multiSelectFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='General Purpose' />,
      cell: ({ row: { original: data } }) => (
        <DataTableBooleanCell
          value={data.isGeneralPurpose}
          display={{ type: 'text', true: 'Yes', false: 'No' }}
          highlight={table.getState().globalFilter}
        />
      ),
      meta: { title: 'General Purpose', options: YES_NO_OPTIONS, exportValue: (row) => (row.isGeneralPurpose ? 'Yes' : 'No') }
    },
    {
      accessorKey: 'projectCategoryCode',
      filterFn: multiSelectFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Category' />,
      cell: ({ row: { original: data } }) => (
        <DataTableTextCell value={data.projectCategoryCode} highlight={table.getState().globalFilter} />
      ),
      meta: {
        title: 'Category',
        options: categoryOptions,
        exportValue: (row) => (row.projectCategory ? `${row.projectCategory.code} - ${row.projectCategory.name}` : '')
      }
    },
    {
      accessorKey: 'customerProjectCode',
      filterFn: multiSelectFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Project' />,
      cell: ({ row: { original: data } }) => (
        <DataTableTextCell value={data.customerProjectCode} highlight={table.getState().globalFilter} />
      ),
      meta: {
        title: 'Project',
        options: projectOptions,
        exportValue: (row) => (row.customerProject ? `${row.customerProject.code} - ${row.customerProject.name}` : '')
      }
    },
    {
      accessorKey: 'palletCode',
      filterFn: multiSelectFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Pallet' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.palletCode} highlight={table.getState().globalFilter} />,
      meta: { title: 'Pallet', options: palletOptions, exportValue: (row) => row.palletCode ?? '' }
    },
    {
      accessorKey: 'locationCode',
      filterFn: multiSelectFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Location' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.locationCode} highlight={table.getState().globalFilter} />,
      meta: { title: 'Location', options: locationOptions, exportValue: (row) => row.locationCode }
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
        const { code, deletedAt, deletedBy } = original

        const isSoftDeleted = deletedAt && deletedBy
        const codeSegment = encodeURIComponent(code)

        return (
          <DataTableActionsCellWrapper>
            {!isSoftDeleted ? (
              <>
                <CanView subject={PERMISSIONS_CODES.CONTAINERS} action={PERMISSIONS_ALLOWED_ACTIONS.VIEW}>
                  <TooltipWrapper label='View'>
                    <Button variant='ghost' size='icon-sm' onClick={() => router.push(`/containers/${codeSegment}/view`)}>
                      <Icons.eye className='text-muted-foreground size-4' />
                    </Button>
                  </TooltipWrapper>
                </CanView>

                <CanView subject={PERMISSIONS_CODES.CONTAINERS} action={PERMISSIONS_ALLOWED_ACTIONS.VIEW}>
                  <TooltipWrapper label='Print Label'>
                    <Button variant='ghost' size='icon-sm' onClick={() => labelModal.open({ mode: 'single', code })}>
                      <Icons.qrCode className='text-muted-foreground size-4' />
                    </Button>
                  </TooltipWrapper>
                </CanView>

                <CanView subject={PERMISSIONS_CODES.CONTAINERS} action={PERMISSIONS_ALLOWED_ACTIONS.EDIT}>
                  <TooltipWrapper label='Edit'>
                    <Button variant='ghost' size='icon-sm' onClick={() => router.push(`/containers/${codeSegment}`)}>
                      <Icons.pencil className='text-muted-foreground size-4' />
                    </Button>
                  </TooltipWrapper>
                </CanView>

                <CanView subject={PERMISSIONS_CODES.CONTAINERS} action={PERMISSIONS_ALLOWED_ACTIONS.DELETE}>
                  <TooltipWrapper label='Delete'>
                    <Button variant='ghost' size='icon-sm' onClick={() => deleteConfirm.open({ code })}>
                      <Icons.trash className='text-destructive size-4' />
                    </Button>
                  </TooltipWrapper>
                </CanView>
              </>
            ) : (
              <CanView subject={PERMISSIONS_CODES.CONTAINERS} action={PERMISSIONS_ALLOWED_ACTIONS.RESTORE}>
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
    initialState: {
      ...DEFAULT_TABLE_INITIAL_STATE,
      columnPinning: { ...DEFAULT_TABLE_INITIAL_STATE.columnPinning, left: ['select'] }
    },
    getRowId: (row) => row.id,
    enableRowSelection: (row) => !row.original.deletedAt
  })

  const dataTableContainersSvr = useDataTableContainersSvr(params, { setData, setRowCount }, [refreshKey])

  const isLoading = dataTableContainersSvr.isLoading

  //* ids are kept across pages, so no rows need to be loaded
  const rowSelection = table.getState().rowSelection
  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id])

  const selectableCount = Math.min(table.getRowCount(), LABEL_MAX_COUNT)
  const isAllSelected = selectedIds.length > 0 && selectedIds.length >= selectableCount

  //* ticks every row matching the current search and filters, up to one pdf's worth
  const handleSelectAll = async () => {
    try {
      const response = await selectAllAction.executeAsync({ ...params, isExport: true })
      const rows = response?.data?.data

      if (!rows) {
        toast.error('Failed to select containers!')
        return
      }

      const ids = rows.filter((row) => !row.deletedAt).map((row) => row.id)

      if (ids.length > LABEL_MAX_COUNT) {
        toast.info(
          `Selected the first ${LABEL_MAX_COUNT.toLocaleString('en-US')} of ${ids.length.toLocaleString('en-US')}, the most labels one PDF can hold.`
        )
      }

      table.setRowSelection(Object.fromEntries(ids.slice(0, LABEL_MAX_COUNT).map((id) => [id, true])))
    } catch (err: any) {
      logger.error(err, '[SELECT_ALL_CONTAINERS_ERROR]:')
      toast.error('Something went wrong! Please try again later.')
    }
  }

  const handleLabelView = async (size: LabelSize) => {
    const target = labelModal.target
    if (!target) return

    if (target.mode === 'single') {
      window.open(getContainerLabelPdfHref(target.code, size), '_blank')
      labelModal.close()
      return
    }

    if (await labelsPdf.open(selectedIds, size, false)) labelModal.close()
  }

  const handleLabelDownload = async (size: LabelSize) => {
    const target = labelModal.target
    if (!target) return

    if (target.mode === 'single') {
      window.location.assign(getContainerLabelPdfHref(target.code, size, true))
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

    toast.promise(dataTableContainersSvrExport.executeAsync({ ...params, isExport: true }), {
      loading: 'Preparing export...',
      success: (response) => {
        const result = response?.data

        if (!response || !result) throw { message: 'Failed to export containers!', unExpectedError: true }

        const rows = result.data.map((row) => visibleColumns.map((column) => column.columnDef.meta!.exportValue!(row)))

        exportToExcel({
          fileName: `${DATA_TABLE_UNIQUE_KEY.toUpperCase()}-${formatDate(new Date(), 'yyyy-MM-dd-HHmmss')}.xlsx`,
          sheetName: 'EXPORTED_DATA',
          headers,
          rows
        })

        return 'Containers exported successfully!'
      },
      error: (err: Error & { expectedError: boolean }) => {
        return err?.expectedError ? err.message : 'Something went wrong! Please try again later.'
      }
    })
  }

  const handleConfirmDelete = async () => {
    if (!deleteConfirm.target?.code) return

    const { code } = deleteConfirm.target

    deleteConfirm.close()

    toast.promise(deleteContainerAction.executeAsync({ code }), {
      loading: 'Deleting container...',
      success: (response) => {
        const result = response?.data

        if (!response || !result) throw { message: 'Failed to delete container!', unExpectedError: true }

        if (!result.error) {
          //* a deleted row can't print, so drop it from the ticks
          table
            .getRowModel()
            .rows.find((row) => row.original.code === code)
            ?.toggleSelected(false)

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

    toast.promise(restoreContainerAction.executeAsync({ code }), {
      loading: 'Restoring container...',
      success: (response) => {
        const result = response?.data

        if (!response || !result) throw { message: 'Failed to restore container!', unExpectedError: true }

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
      <Header title='Containers' description='Manage and track your containers'>
        <div className='flex w-full flex-wrap items-center justify-center gap-2 lg:ml-auto lg:w-auto lg:justify-end'>
          {/* //* the paging rides in the header on a phone, its own row once space runs out */}
          <div className='order-last flex w-full justify-center lg:hidden'>
            <DataTablePagination table={table} isServerSide isCompact />
          </div>

          {selectedIds.length > 0 && (
            <CanView subject={PERMISSIONS_CODES.CONTAINERS} action={PERMISSIONS_ALLOWED_ACTIONS.VIEW}>
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

          <CanView subject={PERMISSIONS_CODES.CONTAINERS} action={PERMISSIONS_ALLOWED_ACTIONS.CREATE}>
            <TooltipWrapper label='Generate Containers'>
              <Button type='button' variant='outline-primary' onClick={() => router.push('/containers/generate')}>
                <Icons.layers /> Generate
              </Button>
            </TooltipWrapper>

            <TooltipWrapper label='Add Container'>
              <Button type='button' onClick={() => router.push('/containers/add')}>
                <Icons.plus /> Add Container
              </Button>
            </TooltipWrapper>
          </CanView>

          <div className='flex shrink-0 items-center gap-2'>
            <DataTableRefreshButton onRefresh={refreshTable} isLoading={isLoading} />

            <DataTableShowDeletedToggle isShowDeleted={isShowDeleted} onToggle={setIsShowDeleted} isLoading={isLoading} />

            <CanView subject={PERMISSIONS_CODES.CONTAINERS} action={PERMISSIONS_ALLOWED_ACTIONS.EXPORT}>
              <DataTableExportButton onExport={handleExport} isLoading={dataTableContainersSvrExport.isExecuting} />
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
              <DataTableColumnFilter column={table.getColumn('type')} title='Type' isLoading={isLoading} />
              <DataTableColumnFilter column={table.getColumn('isGeneralPurpose')} title='General Purpose' isLoading={isLoading} />
              <DataTableColumnFilter column={table.getColumn('projectCategoryCode')} title='Category' isLoading={isLoading} />
              <DataTableColumnFilter column={table.getColumn('customerProjectCode')} title='Project' isLoading={isLoading} />
              <DataTableColumnFilter column={table.getColumn('palletCode')} title='Pallet' isLoading={isLoading} />
              <DataTableColumnFilter column={table.getColumn('locationCode')} title='Location' isLoading={isLoading} />
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
        description={`Are you sure you want to delete container${deleteConfirm?.target?.code ? ` "${deleteConfirm.target.code}"` : ''}?`}
        onConfirm={handleConfirmDelete}
        onConfirmText='Delete'
        onCancel={deleteConfirm.close}
      />

      <AlertModal
        isOpen={restoreConfirm.isOpen}
        title='Are you sure?'
        description={`Are you sure you want to restore container${restoreConfirm?.target?.code ? ` "${restoreConfirm.target.code}"` : ''}?`}
        onConfirm={handleConfirmRestore}
        onConfirmText='Restore'
        onCancel={restoreConfirm.close}
      />

      <LabelSizeModal
        isOpen={labelModal.isOpen}
        title={labelModal.target?.mode === 'single' ? 'Print Label' : 'Print Labels'}
        isBulk={labelModal.target?.mode === 'bulk'}
        description={
          labelModal.target?.mode === 'single'
            ? `QR label for "${labelModal.target.code}"`
            : `QR labels for ${selectedIds.length} selected ${selectedIds.length === 1 ? 'container' : 'containers'}, up to ${LABEL_MAX_COUNT.toLocaleString('en-US')} per PDF`
        }
        isLoading={labelsPdf.isLoading}
        onClose={labelModal.close}
        onView={handleLabelView}
        onDownload={handleLabelDownload}
      />
    </div>
  )
}
