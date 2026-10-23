'use client'

import { useRouter } from 'next/navigation'

import { useDataTableRolesSvr } from '@/hooks/safe-actions/role'
import { DataTable } from '@/components/data-table/data-table'
import {
  DataTableActionsCellWrapper,
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
import { ColumnDef } from '@tanstack/react-table'
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
import { deleteRole, getDataTableRolesSvrClient, restoreRole } from '@/actions/role'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import AlertModal from '@/components/alert-modal'
import { useConfirmAction } from '@/hooks/use-confirm-action'
import { Role } from '@/prisma/generated/client'
import { SUPER_USER_ROLE_KEY } from '@/constants/role'
import { Badge } from '@/components/ui/badge'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import CanView from '@/components/rbac/can-view'
import { formatDate } from '@/lib/utils'
import { BADGE_COLOR_FILTER_OPTIONS, toBadgeVariant } from '@/lib/color'
import { exportToExcel } from '@/lib/xlsx'
import DataTableColumnFilterWrapper from '@/components/data-table/data-table-column-filter-wrapper'
import DataTableShowDeletedToggle from '@/components/data-table/data-table-show-deleted-toggle'
import DataTableRefreshButton from '@/components/data-table/data-table-refresh-button'
import DataTableExportButton from '@/components/data-table/data-table-export-button'

export default function RoleContent() {
  const router = useRouter()

  const DATA_TABLE_UNIQUE_KEY = 'roles'

  const deleteConfirm = useConfirmAction<{ code: number; name: string }>()
  const restoreConfirm = useConfirmAction<{ code: number; name: string }>()

  const columns: ColumnDef<Role>[] = [
    {
      accessorKey: 'code',
      header: ({ column }) => <DataTableColumnHeader column={column} title='ID' />,
      cell: ({ row: { original: data } }) => <DataTableNumberCell value={data.code} highlight={table.getState().globalFilter} />,
      meta: { title: 'ID', exportValue: (row) => row.code }
    },
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Name' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.name} highlight={table.getState().globalFilter} />,
      meta: { title: 'Name', exportValue: (row) => row.name }
    },
    {
      accessorKey: 'description',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Description' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.description} highlight={table.getState().globalFilter} />,
      meta: { title: 'Description', exportValue: (row) => row.description }
    },
    {
      accessorKey: 'color',
      filterFn: multiSelectFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Color' />,
      cell: ({ row: { original: data } }) => {
        if (!data.color) return '—'

        return (
          <Badge variant={toBadgeVariant(data.color)}>
            {/* //* the stored value, not a label, so search matches it exactly as typed */}
            <DataTableTextCell value={data.color} highlight={table.getState().globalFilter} />
          </Badge>
        )
      },
      meta: { title: 'Color', options: BADGE_COLOR_FILTER_OPTIONS, exportValue: (row) => row.color }
    },
    {
      accessorKey: 'createdAt',
      filterFn: dateFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Created At' />,
      cell: ({ row: { original: data } }) => <DataTableDateCell value={data.createdAt} />,
      meta: { title: 'Created At', exportValue: (row) => formatDate(new Date(row.createdAt), 'yyyy-MM-dd HH:mm:ss') }
    },
    {
      accessorKey: 'updatedAt',
      filterFn: dateFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Updated At' />,
      cell: ({ row: { original: data } }) => <DataTableDateCell value={data.updatedAt} />,
      meta: { title: 'Updated At', exportValue: (row) => formatDate(new Date(row.updatedAt), 'yyyy-MM-dd HH:mm:ss') }
    },
    {
      accessorKey: 'actions',
      enableSorting: false,
      enableHiding: false,
      minSize: 140,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Actions' className='text-center' />,
      cell: ({ row: { original } }) => {
        const { code, name, key, deletedAt, deletedBy, isSystem } = original

        const isSoftDeleted = deletedAt && deletedBy
        const isSuperRole = isSystem && key === SUPER_USER_ROLE_KEY

        //* the super user role gets no row actions at all
        if (isSuperRole) return null

        return (
          <>
            <DataTableActionsCellWrapper>
              {!isSoftDeleted ? (
                <>
                  <CanView subject={PERMISSIONS_CODES.ROLES} action={PERMISSIONS_ALLOWED_ACTIONS.VIEW}>
                    <TooltipWrapper label='View'>
                      <Button variant='ghost' size='icon-sm' onClick={() => router.push(`/roles/${code}/view`)}>
                        <Icons.eye className='text-muted-foreground size-4' />
                      </Button>
                    </TooltipWrapper>
                  </CanView>

                  <CanView subject={PERMISSIONS_CODES.ROLES} action={PERMISSIONS_ALLOWED_ACTIONS.EDIT}>
                    <TooltipWrapper label='Edit'>
                      <Button variant='ghost' size='icon-sm' onClick={() => router.push(`/roles/${code}`)}>
                        <Icons.pencil className='text-muted-foreground size-4' />
                      </Button>
                    </TooltipWrapper>
                  </CanView>

                  <CanView subject={PERMISSIONS_CODES.ROLES} action={PERMISSIONS_ALLOWED_ACTIONS.DELETE}>
                    <TooltipWrapper label='Delete'>
                      <Button variant='ghost' size='icon-sm' onClick={() => deleteConfirm.open({ code, name })} hidden={isSystem}>
                        <Icons.trash className='text-destructive size-4' />
                      </Button>
                    </TooltipWrapper>
                  </CanView>
                </>
              ) : (
                <CanView subject={PERMISSIONS_CODES.ROLES} action={PERMISSIONS_ALLOWED_ACTIONS.RESTORE}>
                  <TooltipWrapper label='Restore'>
                    <Button variant='ghost' size='icon-sm' onClick={() => restoreConfirm.open({ code, name })}>
                      <Icons.restore className='size-5 text-blue-500' />
                    </Button>
                  </TooltipWrapper>
                </CanView>
              )}
            </DataTableActionsCellWrapper>
          </>
        )
      }
    }
  ]

  const { table, params, setData, setRowCount, isShowDeleted, setIsShowDeleted, refreshKey, refetch, refreshTable } = useDataTableServer({
    columns,
    initialState: DEFAULT_TABLE_INITIAL_STATE,
    getRowId: (row) => row.id
  })

  const dataTableRolesSvr = useDataTableRolesSvr(params, { setData, setRowCount }, [refreshKey])
  const dataTableRolesSvrExport = useAction(getDataTableRolesSvrClient)
  const deleteRoleAction = useAction(deleteRole)
  const restoreRoleAction = useAction(restoreRole)

  const handleExport = async () => {
    const visibleColumns = table.getVisibleLeafColumns().filter((column) => column.id !== 'actions' && column.columnDef.meta?.exportValue)

    if (visibleColumns.length === 0) {
      toast.error('No columns available to export!')
      return
    }

    const headers = visibleColumns.map((column) => column.columnDef.meta?.title ?? column.id)

    toast.promise(dataTableRolesSvrExport.executeAsync({ ...params, isExport: true }), {
      loading: 'Preparing export...',
      success: (response) => {
        const result = response?.data

        if (!response || !result) throw { message: 'Failed to export users!', unExpectedError: true }

        const rows = result.data.map((row) => visibleColumns.map((column) => column.columnDef.meta!.exportValue!(row)))

        exportToExcel({
          fileName: `${DATA_TABLE_UNIQUE_KEY.toUpperCase()}-${formatDate(new Date(), 'yyyy-MM-dd-HHmmss')}.xlsx`,
          sheetName: 'EXPORTED_DATA',
          headers,
          rows
        })

        return 'Users exported successfully!'
      },
      error: (err: Error & { expectedError: boolean }) => {
        return err?.expectedError ? err.message : 'Something went wrong! Please try again later.'
      }
    })
  }

  const handleConfirmDeleteRole = async () => {
    if (!deleteConfirm.target || !deleteConfirm?.target?.code) return

    const { code } = deleteConfirm?.target

    deleteConfirm.close()

    toast.promise(deleteRoleAction.executeAsync({ code }), {
      loading: 'Deleting role...',
      success: (response) => {
        const result = response?.data

        if (!response || !result) throw { message: 'Failed to delete role!', unExpectedError: true }

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

  const handleConfirmRestoreRole = async () => {
    if (!restoreConfirm.target || !restoreConfirm?.target?.code) return

    const { code } = restoreConfirm?.target

    restoreConfirm.close()

    toast.promise(restoreRoleAction.executeAsync({ code }), {
      loading: 'Restoring role...',
      success: (response) => {
        const result = response?.data

        if (!response || !result) throw { message: 'Failed to restore role!', unExpectedError: true }

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
      <Header title='Roles' description='Manage and track your roles effectively'>
        <div className='flex w-full flex-wrap items-center justify-center gap-2 lg:ml-auto lg:w-auto lg:justify-end'>
          {/* //* the paging rides in the header on a phone, its own row once space runs out */}
          <div className='order-last flex w-full justify-center lg:hidden'>
            <DataTablePagination table={table} isServerSide isCompact />
          </div>

          <CanView subject={PERMISSIONS_CODES.ROLES} action={PERMISSIONS_ALLOWED_ACTIONS.CREATE}>
            <TooltipWrapper label='Add Role'>
              <Button type='button' onClick={() => router.push('/roles/add')}>
                <Icons.plus /> Add Role
              </Button>
            </TooltipWrapper>
          </CanView>

          <div className='flex shrink-0 items-center gap-2'>
            <DataTableRefreshButton onRefresh={refreshTable} isLoading={dataTableRolesSvr.isLoading} />

            <DataTableShowDeletedToggle isShowDeleted={isShowDeleted} onToggle={setIsShowDeleted} isLoading={dataTableRolesSvr.isLoading} />

            <CanView subject={PERMISSIONS_CODES.ROLES} action={PERMISSIONS_ALLOWED_ACTIONS.EXPORT}>
              <DataTableExportButton onExport={handleExport} isLoading={dataTableRolesSvrExport.isExecuting} />
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
              <DataTableGlobalSearch table={table} isLoading={dataTableRolesSvr.isLoading} />
              <DataTableColumnFilter column={table.getColumn('color')} title='Color' isLoading={dataTableRolesSvr.isLoading} />
              <DataTableColumnDateFilter column={table.getColumn('createdAt')} title='Created At' isLoading={dataTableRolesSvr.isLoading} />
              <DataTableColumnDateFilter column={table.getColumn('updatedAt')} title='Updated At' isLoading={dataTableRolesSvr.isLoading} />
            </DataTableColumnFilterWrapper>

            <div className='flex flex-col justify-center gap-1.5 *:w-full md:justify-start lg:flex-row lg:flex-wrap lg:items-center lg:*:w-auto'></div>
          </DataTableToolbar>

          <DataTable
            table={table}
            isLoading={dataTableRolesSvr.isLoading}
            isServerSide
            getRowClassName={getSoftDeletedRowClassName}
            paginationClassName='max-lg:hidden'
          />
        </DataTableContainer>
      </ContentWrapper>

      <AlertModal
        isOpen={deleteConfirm.isOpen}
        title='Are you sure?'
        description={`Are you sure you want to delete this role${deleteConfirm?.target?.name ? ` named "${deleteConfirm.target.name}"` : ''}?`}
        onConfirm={handleConfirmDeleteRole}
        onConfirmText='Delete'
        onCancel={deleteConfirm.close}
      />

      <AlertModal
        isOpen={restoreConfirm.isOpen}
        title='Are you sure?'
        description={`Are you sure you want to restore this role${restoreConfirm?.target?.name ? ` named "${restoreConfirm.target.name}"` : ''}?`}
        onConfirm={handleConfirmRestoreRole}
        onConfirmText='Restore'
        onCancel={restoreConfirm.close}
      />
    </div>
  )
}
