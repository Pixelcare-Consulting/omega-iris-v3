'use client'

import { useRouter } from 'next/navigation'
import { useAction } from 'next-safe-action/hooks'
import { ColumnDef } from '@tanstack/react-table'

import { useDataTableUsersSvr } from '@/hooks/safe-actions/user'
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
import { DataTableActionsOptions } from '@/components/data-table/data-table-options'
import { DataTablePagination } from '@/components/data-table/data-table-pagination'
import DataTableColumnDateFilter from '@/components/data-table/data-table-column-date-filter'
import { useDataTableServer } from '@/hooks/use-data-table-server'
import { DEFAULT_TABLE_INITIAL_STATE } from '@/constants/data-table'
import Header from '@/components/header'
import { TooltipWrapper } from '@/components/tooltip-wrapper'
import ContentWrapper from '@/components/content-wrapper'
import { deleteUser, getDataTableUsersSvrClient, restoreUser, UserWithInclude } from '@/actions/user'
import { toast } from 'sonner'
import AlertModal from '@/components/alert-modal'
import { useConfirmAction } from '@/hooks/use-confirm-action'
import CanView from '@/components/rbac/can-view'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { Badge } from '@/components/ui/badge'
import { toBadgeVariant } from '@/lib/color'
import { formatDate } from '@/lib/utils'
import { exportToExcel } from '@/lib/xlsx'
import DataTableColumnFilterWrapper from '@/components/data-table/data-table-column-filter-wrapper'
import DataTableShowDeletedToggle from '@/components/data-table/data-table-show-deleted-toggle'
import DataTableRefreshButton from '@/components/data-table/data-table-refresh-button'
import DataTableExportButton from '@/components/data-table/data-table-export-button'
import RelationLink from '@/components/relation-link'
import { FilterOption } from '@/types/data-table'

type UserContentProps = {
  roleOptions: FilterOption[]
}

export default function UserContent({ roleOptions }: UserContentProps) {
  const router = useRouter()

  const DATA_TABLE_UNIQUE_KEY = 'users'

  const deleteConfirm = useConfirmAction<{ code: number; name: string; email: string }>()
  const restoreConfirm = useConfirmAction<{ code: number; name: string; email: string }>()

  const columns: ColumnDef<UserWithInclude>[] = [
    {
      accessorKey: 'code',
      header: ({ column }) => <DataTableColumnHeader column={column} title='ID' />,
      cell: ({ row: { original: data } }) => <DataTableNumberCell value={data.code} highlight={table.getState().globalFilter} />,
      meta: { title: 'ID', exportValue: (row) => row.code }
    },
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Full Name' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.name} highlight={table.getState().globalFilter} />,
      meta: { title: 'Full Name', exportValue: (row) => row.name }
    },
    {
      accessorKey: 'username',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Username' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.username} highlight={table.getState().globalFilter} />,
      meta: { title: 'Username', exportValue: (row) => row.username }
    },
    {
      accessorKey: 'email',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Email' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.email} highlight={table.getState().globalFilter} />,
      meta: { title: 'Email', exportValue: (row) => row.email }
    },
    {
      accessorKey: 'employeeId',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Employee ID' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.employeeId} highlight={table.getState().globalFilter} />,
      meta: { title: 'Employee ID', exportValue: (row) => row.employeeId ?? '' }
    },
    {
      accessorFn: (row) => row?.role?.key,
      accessorKey: 'roleName',
      filterFn: multiSelectFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Role' />,
      cell: ({ row: { original: data } }) => (
        <RelationLink href={`/roles/${data.role.code}/view`}>
          <Badge variant={toBadgeVariant(data.role.color)}>
            <DataTableTextCell value={data.role.name} highlight={table.getState().globalFilter} />
          </Badge>
        </RelationLink>
      ),
      meta: { title: 'Role', options: roleOptions, exportValue: (row) => row.role?.name ?? '' }
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
        ],
        exportValue: (row) => (row.isActive ? 'Yes' : 'No')
      }
    },
    {
      accessorFn: (row) => (row?.isInternal ? 'Yes' : 'No'),
      accessorKey: 'isInternal',
      filterFn: multiSelectFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Internal' />,
      cell: ({ row: { original: data } }) => (
        <DataTableBooleanCell
          value={data.isInternal}
          display={{ type: 'text', true: 'Yes', false: 'No' }}
          highlight={table.getState().globalFilter}
        />
      ),
      meta: {
        title: 'Internal',
        options: [
          { label: 'Yes', value: 'Yes' },
          { label: 'No', value: 'No' }
        ],
        exportValue: (row) => (row.isInternal ? 'Yes' : 'No')
      }
    },
    {
      accessorFn: (row) => (row?.isLocked ? 'Yes' : 'No'),
      accessorKey: 'isLocked',
      filterFn: multiSelectFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Locked' />,
      cell: ({ row: { original: data } }) => (
        <DataTableBooleanCell
          value={data.isLocked}
          display={{ type: 'text', true: 'Yes', false: 'No' }}
          highlight={table.getState().globalFilter}
        />
      ),
      meta: {
        title: 'Locked',
        options: [
          { label: 'Yes', value: 'Yes' },
          { label: 'No', value: 'No' }
        ],
        exportValue: (row) => (row.isLocked ? 'Yes' : 'No')
      }
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
        const { code, name, email, deletedAt, deletedBy, isSystem } = original

        const isSoftDeleted = deletedAt && deletedBy

        return (
          <>
            <DataTableActionsCellWrapper>
              {!isSoftDeleted ? (
                <>
                  <CanView subject={PERMISSIONS_CODES.USERS} action={PERMISSIONS_ALLOWED_ACTIONS.VIEW}>
                    <TooltipWrapper label='View'>
                      <Button variant='ghost' size='icon-sm' onClick={() => router.push(`/users/${code}/view`)}>
                        <Icons.eye className='text-muted-foreground size-4' />
                      </Button>
                    </TooltipWrapper>
                  </CanView>

                  {/* //* a system user can only be viewed */}
                  {!isSystem && (
                    <>
                      <CanView subject={PERMISSIONS_CODES.USERS} action={PERMISSIONS_ALLOWED_ACTIONS.EDIT}>
                        <TooltipWrapper label='Edit'>
                          <Button variant='ghost' size='icon-sm' onClick={() => router.push(`/users/${code}`)}>
                            <Icons.pencil className='text-muted-foreground size-4' />
                          </Button>
                        </TooltipWrapper>
                      </CanView>

                      <CanView subject={PERMISSIONS_CODES.USERS} action={PERMISSIONS_ALLOWED_ACTIONS.DELETE}>
                        <TooltipWrapper label='Delete'>
                          <Button variant='ghost' size='icon-sm' onClick={() => deleteConfirm.open({ code, name, email })}>
                            <Icons.trash className='text-destructive size-4' />
                          </Button>
                        </TooltipWrapper>
                      </CanView>
                    </>
                  )}
                </>
              ) : !isSystem ? (
                <CanView subject={PERMISSIONS_CODES.USERS} action={PERMISSIONS_ALLOWED_ACTIONS.RESTORE}>
                  <TooltipWrapper label='Restore'>
                    <Button variant='ghost' size='icon-sm' onClick={() => restoreConfirm.open({ code, name, email })}>
                      <Icons.restore className='size-5 text-blue-500' />
                    </Button>
                  </TooltipWrapper>
                </CanView>
              ) : null}
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

  const dataTableUsersSvr = useDataTableUsersSvr(params, { setData, setRowCount }, [refreshKey])
  const dataTableUsersSvrExport = useAction(getDataTableUsersSvrClient)
  const deleteUserAction = useAction(deleteUser)
  const restoreUserAction = useAction(restoreUser)

  const handleExport = async () => {
    const visibleColumns = table.getVisibleLeafColumns().filter((column) => column.id !== 'actions' && column.columnDef.meta?.exportValue)

    if (visibleColumns.length === 0) {
      toast.error('No columns available to export!')
      return
    }

    const headers = visibleColumns.map((column) => column.columnDef.meta?.title ?? column.id)

    toast.promise(dataTableUsersSvrExport.executeAsync({ ...params, isExport: true }), {
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

  const handleConfirmDeleteUser = async () => {
    if (!deleteConfirm.target || !deleteConfirm?.target?.code) return

    const { code } = deleteConfirm?.target

    deleteConfirm.close()

    toast.promise(deleteUserAction.executeAsync({ code }), {
      loading: 'Deleting user...',
      success: (response) => {
        const result = response?.data

        if (!response || !result) throw { message: 'Failed to delete user!', unExpectedError: true }

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

  const handleConfirmRestoreUser = async () => {
    if (!restoreConfirm.target || !restoreConfirm?.target?.code) return

    const { code } = restoreConfirm?.target

    restoreConfirm.close()

    toast.promise(restoreUserAction.executeAsync({ code }), {
      loading: 'Restoring user...',
      success: (response) => {
        const result = response?.data

        if (!response || !result) throw { message: 'Failed to restore user!', unExpectedError: true }

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
      <Header title='Users' description='Manage and track your users effectively'>
        <div className='flex w-full flex-wrap items-center justify-center gap-2 lg:ml-auto lg:w-auto lg:justify-end'>
          {/* //* the paging rides in the header on a phone, its own row once space runs out */}
          <div className='order-last flex w-full justify-center lg:hidden'>
            <DataTablePagination table={table} isServerSide isCompact />
          </div>

          <CanView subject={PERMISSIONS_CODES.USERS} action={PERMISSIONS_ALLOWED_ACTIONS.CREATE}>
            <TooltipWrapper label='Add User'>
              <Button type='button' onClick={() => router.push('/users/add')}>
                <Icons.plus /> Add User
              </Button>
            </TooltipWrapper>
          </CanView>

          <div className='flex shrink-0 items-center gap-2'>
            <DataTableRefreshButton onRefresh={refreshTable} isLoading={dataTableUsersSvr.isLoading} />

            <DataTableShowDeletedToggle isShowDeleted={isShowDeleted} onToggle={setIsShowDeleted} isLoading={dataTableUsersSvr.isLoading} />

            <CanView subject={PERMISSIONS_CODES.USERS} action={PERMISSIONS_ALLOWED_ACTIONS.EXPORT}>
              <DataTableExportButton onExport={handleExport} isLoading={dataTableUsersSvrExport.isExecuting} />
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
              <DataTableGlobalSearch table={table} isLoading={dataTableUsersSvr.isLoading} />
              <DataTableColumnFilter column={table.getColumn('roleName')} title='Role' isLoading={dataTableUsersSvr.isLoading} />
              <DataTableColumnFilter column={table.getColumn('isActive')} title='Active' isLoading={dataTableUsersSvr.isLoading} />
              <DataTableColumnFilter column={table.getColumn('isInternal')} title='Internal' isLoading={dataTableUsersSvr.isLoading} />
              <DataTableColumnFilter column={table.getColumn('isLocked')} title='Locked' isLoading={dataTableUsersSvr.isLoading} />
              <DataTableColumnDateFilter column={table.getColumn('createdAt')} title='Created At' isLoading={dataTableUsersSvr.isLoading} />
              <DataTableColumnDateFilter column={table.getColumn('updatedAt')} title='Updated At' isLoading={dataTableUsersSvr.isLoading} />
            </DataTableColumnFilterWrapper>
          </DataTableToolbar>

          <DataTable
            table={table}
            isLoading={dataTableUsersSvr.isLoading}
            isServerSide
            getRowClassName={getSoftDeletedRowClassName}
            paginationClassName='max-lg:hidden'
          />
        </DataTableContainer>
      </ContentWrapper>

      <AlertModal
        isOpen={deleteConfirm.isOpen}
        title='Are you sure?'
        description={`Are you sure you want to delete this user ${deleteConfirm?.target?.name ? 'named' : 'emailed'} "${deleteConfirm?.target?.name || deleteConfirm?.target?.email}"?`}
        onConfirm={handleConfirmDeleteUser}
        onConfirmText='Delete'
        onCancel={deleteConfirm.close}
      />

      <AlertModal
        isOpen={restoreConfirm.isOpen}
        title='Are you sure?'
        description={`Are you sure you want to restore this user ${restoreConfirm?.target?.name ? 'named' : 'emailed'} "${restoreConfirm?.target?.name || restoreConfirm?.target?.email}"?`}
        onConfirm={handleConfirmRestoreUser}
        onConfirmText='Restore'
        onCancel={restoreConfirm.close}
      />
    </div>
  )
}
