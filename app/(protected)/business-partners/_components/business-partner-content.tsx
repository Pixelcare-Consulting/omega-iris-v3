'use client'

import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAction } from 'next-safe-action/hooks'
import { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'

import { BusinessPartnerRow, deleteBusinessPartner, getDataTableBusinessPartnersSvrClient } from '@/actions/business-partner'
import { useBusinessPartnerLookups, useDataTableBusinessPartnersSvr } from '@/hooks/safe-actions/business-partner'
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
import { ACTIVE_OPTIONS, ALL_CURRENCIES, CARD_TYPE_OPTIONS, toCurrencyLabel, toOptionLabel } from '@/constants/business-partner'
import { formatDate } from '@/lib/utils'
import { formatSapDateTime, toSapDateTime } from '@/lib/sap/utils'
import { exportToExcel } from '@/lib/xlsx'

export default function BusinessPartnerContent() {
  const router = useRouter()

  const DATA_TABLE_UNIQUE_KEY = 'business-partners'

  const deleteConfirm = useConfirmAction<{ code: string; name: string }>()

  const lookups = useBusinessPartnerLookups()

  //* picker values are the sap codes, the server filters on them as is
  const filterOptions = useMemo(() => {
    const { groups, currencies, salesPersons } = lookups.data

    return {
      groups: groups.map((g): FilterOption => ({ label: g.Name, value: String(g.Code) })),
      currencies: [ALL_CURRENCIES, ...currencies].map((c): FilterOption => ({
        label: c.Code === ALL_CURRENCIES.Code ? c.Name : `${c.Code} - ${c.Name}`,
        value: c.Code
      })),
      salesPersons: salesPersons.map((s): FilterOption => ({ label: s.SalesEmployeeName, value: String(s.SalesEmployeeCode) }))
    }
  }, [lookups.data])

  const columns: ColumnDef<BusinessPartnerRow>[] = [
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
      accessorKey: 'CardType',
      header: ({ column }) => <DataTableColumnHeader column={column} title='BP Type' />,
      cell: ({ row: { original: data } }) => (
        <DataTableTextCell value={toOptionLabel(CARD_TYPE_OPTIONS, data.CardType)} highlight={table.getState().globalFilter} />
      ),
      meta: {
        title: 'BP Type',

        options: CARD_TYPE_OPTIONS,
        exportValue: (row) => toOptionLabel(CARD_TYPE_OPTIONS, row.CardType)
      }
    },
    {
      accessorKey: 'GroupName',
      enableSorting: false,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Group' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.GroupName} highlight={table.getState().globalFilter} />,
      meta: { title: 'Group', options: filterOptions.groups, exportValue: (row) => row.GroupName }
    },
    {
      accessorKey: 'Currency',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Currency' />,
      cell: ({ row: { original: data } }) => (
        <DataTableTextCell value={toCurrencyLabel(data.Currency)} highlight={table.getState().globalFilter} />
      ),
      meta: { title: 'Currency', options: filterOptions.currencies, exportValue: (row) => toCurrencyLabel(row.Currency) }
    },
    {
      accessorKey: 'FederalTaxID',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Federal Tax ID' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.FederalTaxID} highlight={table.getState().globalFilter} />,
      meta: { title: 'Federal Tax ID', exportValue: (row) => row.FederalTaxID }
    },
    {
      accessorKey: 'SalesEmployeeName',
      enableSorting: false,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Sales Employee' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.SalesEmployeeName} highlight={table.getState().globalFilter} />,
      meta: { title: 'Sales Employee', options: filterOptions.salesPersons, exportValue: (row) => row.SalesEmployeeName }
    },
    {
      accessorKey: 'Phone1',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Tel 1' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.Phone1} highlight={table.getState().globalFilter} />,
      meta: { title: 'Tel 1', exportValue: (row) => row.Phone1 }
    },
    {
      accessorKey: 'EmailAddress',
      header: ({ column }) => <DataTableColumnHeader column={column} title='E-Mail' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.EmailAddress} highlight={table.getState().globalFilter} />,
      meta: { title: 'E-Mail', exportValue: (row) => row.EmailAddress }
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
        const { CardCode, CardName } = original
        const href = `/business-partners/${encodeURIComponent(CardCode)}`

        return (
          <DataTableActionsCellWrapper>
            <CanView subject={PERMISSIONS_CODES.BUSINESS_PARTNERS} action={PERMISSIONS_ALLOWED_ACTIONS.VIEW}>
              <TooltipWrapper label='View'>
                <Button variant='ghost' size='icon-sm' onClick={() => router.push(`${href}/view`)}>
                  <Icons.eye className='text-muted-foreground size-4' />
                </Button>
              </TooltipWrapper>
            </CanView>

            <CanView subject={PERMISSIONS_CODES.BUSINESS_PARTNERS} action={PERMISSIONS_ALLOWED_ACTIONS.EDIT}>
              <TooltipWrapper label='Edit'>
                <Button variant='ghost' size='icon-sm' onClick={() => router.push(href)}>
                  <Icons.pencil className='text-muted-foreground size-4' />
                </Button>
              </TooltipWrapper>
            </CanView>

            <CanView subject={PERMISSIONS_CODES.BUSINESS_PARTNERS} action={PERMISSIONS_ALLOWED_ACTIONS.DELETE}>
              <TooltipWrapper label='Delete'>
                <Button variant='ghost' size='icon-sm' onClick={() => deleteConfirm.open({ code: CardCode, name: CardName })}>
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
    getRowId: (row) => row.CardCode
  })

  //* fetched once above, every table request reuses it
  const tableLookups = useMemo(() => {
    if (!lookups.isLoaded) return undefined

    const { groups, salesPersons, currencies } = lookups.data
    return { groups, salesPersons, currencies }
  }, [lookups.isLoaded, lookups.data])

  const tableParams = { ...params, lookups: tableLookups }

  const dataTableBusinessPartnersSvr = useDataTableBusinessPartnersSvr(
    tableParams,
    { setData, setRowCount, setPageIndex: table.setPageIndex },
    [refreshKey]
  )
  const dataTableBusinessPartnersSvrExport = useAction(getDataTableBusinessPartnersSvrClient)
  const deleteBusinessPartnerAction = useAction(deleteBusinessPartner)

  const listError = dataTableBusinessPartnersSvr.data.error

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

    toast.promise(dataTableBusinessPartnersSvrExport.executeAsync({ ...params, lookups: tableLookups, isExport: true }), {
      loading: 'Preparing export...',
      success: (response) => {
        const result = response?.data

        if (!response || !result) throw { message: 'Failed to export business partners!', unExpectedError: true }

        const rows = result.data.map((row) => visibleColumns.map((column) => column.columnDef.meta!.exportValue!(row)))

        exportToExcel({
          fileName: `${DATA_TABLE_UNIQUE_KEY.toUpperCase()}-${formatDate(new Date(), 'yyyy-MM-dd-HHmmss')}.xlsx`,
          sheetName: 'EXPORTED_DATA',
          headers,
          rows
        })

        return 'Business partners exported successfully!'
      },
      error: (err: Error & { expectedError: boolean }) => {
        return err?.expectedError ? err.message : 'Something went wrong! Please try again later.'
      }
    })
  }

  const handleConfirmDeleteBusinessPartner = async () => {
    if (!deleteConfirm.target?.code) return

    const { code } = deleteConfirm.target

    deleteConfirm.close()

    toast.promise(deleteBusinessPartnerAction.executeAsync({ code }), {
      loading: 'Deleting business partner...',
      success: (response) => {
        const result = response?.data

        if (!response || !result) throw { message: 'Failed to delete business partner!', unExpectedError: true }

        if (!result.error) {
          refetch()

          return result.message
        }

        //* sap's own reason, e.g. the bp still has documents
        throw { message: result.message, expectedError: true }
      },
      error: (err: Error & { expectedError: boolean }) => {
        return err?.expectedError ? err.message : 'Something went wrong! Please try again later.'
      }
    })
  }

  return (
    <div className='flex h-full w-full flex-1 flex-col gap-5'>
      <Header title='Business Partners' description='Manage the business partners in SAP' badge={<SapLiveBadge />}>
        <div className='flex w-full flex-wrap items-center justify-center gap-2 lg:ml-auto lg:w-auto lg:justify-end'>
          {/* //* the paging rides in the header on a phone, its own row once space runs out */}
          <div className='order-last flex w-full justify-center lg:hidden'>
            <DataTablePagination table={table} isServerSide isCompact />
          </div>

          <CanView subject={PERMISSIONS_CODES.BUSINESS_PARTNERS} action={PERMISSIONS_ALLOWED_ACTIONS.CREATE}>
            <TooltipWrapper label='Add Business Partner'>
              <Button type='button' onClick={() => router.push('/business-partners/add')}>
                <Icons.plus /> Add Business Partner
              </Button>
            </TooltipWrapper>
          </CanView>

          <div className='flex shrink-0 items-center gap-2'>
            <DataTableRefreshButton onRefresh={refreshTable} isLoading={dataTableBusinessPartnersSvr.isLoading} />

            <CanView subject={PERMISSIONS_CODES.BUSINESS_PARTNERS} action={PERMISSIONS_ALLOWED_ACTIONS.EXPORT}>
              <DataTableExportButton onExport={handleExport} isLoading={dataTableBusinessPartnersSvrExport.isExecuting} />
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
              <DataTableGlobalSearch table={table} placeholder='Search...' isLoading={dataTableBusinessPartnersSvr.isLoading} />
              <DataTableColumnFilter
                column={table.getColumn('CardType')}
                title='BP Type'
                isLoading={dataTableBusinessPartnersSvr.isLoading}
              />
              <DataTableColumnFilter column={table.getColumn('GroupName')} title='Group' isLoading={lookups.isLoading} />
              <DataTableColumnFilter column={table.getColumn('Currency')} title='Currency' isLoading={lookups.isLoading} />
              <DataTableColumnFilter column={table.getColumn('SalesEmployeeName')} title='Sales Employee' isLoading={lookups.isLoading} />
              <DataTableColumnFilter column={table.getColumn('Valid')} title='Active' isLoading={dataTableBusinessPartnersSvr.isLoading} />
            </DataTableColumnFilterWrapper>
          </DataTableToolbar>

          <DataTable
            table={table}
            isLoading={dataTableBusinessPartnersSvr.isLoading}
            isServerSide

            paginationClassName='max-lg:hidden'
          />
        </DataTableContainer>
      </ContentWrapper>

      <AlertModal
        isOpen={deleteConfirm.isOpen}
        title='Are you sure?'
        description={`Are you sure you want to delete the business partner "${deleteConfirm.target?.name}" (${deleteConfirm.target?.code}) in SAP? This cannot be undone.`}
        onConfirm={handleConfirmDeleteBusinessPartner}
        onConfirmText='Delete'
        onCancel={deleteConfirm.close}
      />
    </div>
  )
}
