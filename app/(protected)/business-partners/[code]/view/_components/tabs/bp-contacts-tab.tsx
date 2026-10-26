'use client'

import { useEffect } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'

import { SapBusinessPartner, SapContactEmployee } from '@/types/sap'
import { useBusinessPartnerContacts } from '@/hooks/safe-actions/business-partner'
import { useDataTableClient } from '@/hooks/use-data-table-client'
import ContentWrapper from '@/components/content-wrapper'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/data-table/data-table'
import { DataTableBooleanCell, DataTableTextCell } from '@/components/data-table/data-table-column-cell'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import DataTableContainer from '@/components/data-table/data-table-container'
import DataTableToolbar from '@/components/data-table/data-table-toolbar'
import DataTableColumnFilterWrapper from '@/components/data-table/data-table-column-filter-wrapper'
import DataTableGlobalSearch from '@/components/data-table/data-table-global-search'
import DataTableColumnFilter from '@/components/data-table/data-table-faceted-filter'
import DataTableRefreshButton from '@/components/data-table/data-table-refresh-button'
import DataTableExportButton from '@/components/data-table/data-table-export-button'
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options'
import CanView from '@/components/rbac/can-view'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { multiSelectFilterFn } from '@/lib/data-table'
import { formatDate } from '@/lib/utils'
import { fromYesNo } from '@/lib/sap/utils'
import { exportToExcel } from '@/lib/xlsx'

type BPContactsTabProps = { businessPartner: SapBusinessPartner }

const ACTIVE_FILTER_OPTIONS = [
  { label: 'Yes', value: 'Yes' },
  { label: 'No', value: 'No' }
]

export default function BPContactsTab({ businessPartner: bp }: BPContactsTabProps) {
  const DATA_TABLE_UNIQUE_KEY = 'business-partner-contacts'

  const contacts = useBusinessPartnerContacts(bp.CardCode)

  const toActive = (row: SapContactEmployee) => (fromYesNo(row.Active) ? 'Yes' : 'No')

  const columns: ColumnDef<SapContactEmployee>[] = [
    {
      accessorKey: 'Name',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Contact ID' />,
      cell: ({ row: { original: data } }) => (
        <span className='flex items-center gap-2'>
          <DataTableTextCell value={data.Name} highlight={table.getState().globalFilter} />
          {bp.ContactPerson === data.Name && <Badge variant='secondary'>Default</Badge>}
        </span>
      ),
      meta: { title: 'Contact ID', exportValue: (row) => row.Name }
    },
    {
      accessorKey: 'Title',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Title' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.Title} highlight={table.getState().globalFilter} />,
      meta: { title: 'Title', exportValue: (row) => row.Title }
    },
    {
      accessorKey: 'Position',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Position' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.Position} highlight={table.getState().globalFilter} />,
      meta: { title: 'Position', exportValue: (row) => row.Position }
    },
    {
      accessorKey: 'E_Mail',
      header: ({ column }) => <DataTableColumnHeader column={column} title='E-Mail' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.E_Mail} highlight={table.getState().globalFilter} />,
      meta: { title: 'E-Mail', exportValue: (row) => row.E_Mail }
    },
    {
      accessorKey: 'Address',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Address' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.Address} highlight={table.getState().globalFilter} />,
      meta: { title: 'Address', exportValue: (row) => row.Address }
    },
    {
      accessorKey: 'Phone1',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Tel 1' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.Phone1} highlight={table.getState().globalFilter} />,
      meta: { title: 'Tel 1', exportValue: (row) => row.Phone1 }
    },
    {
      accessorKey: 'Phone2',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Tel 2' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.Phone2} highlight={table.getState().globalFilter} />,
      meta: { title: 'Tel 2', exportValue: (row) => row.Phone2 }
    },
    {
      accessorKey: 'MobilePhone',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Mobile Phone' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.MobilePhone} highlight={table.getState().globalFilter} />,
      meta: { title: 'Mobile Phone', exportValue: (row) => row.MobilePhone }
    },
    {
      id: 'Active',
      accessorFn: toActive,
      filterFn: multiSelectFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Active' />,
      cell: ({ row: { original: data } }) => (
        <DataTableBooleanCell value={fromYesNo(data.Active)} display={{ type: 'text', true: 'Yes', false: 'No' }} />
      ),
      meta: { title: 'Active', options: ACTIVE_FILTER_OPTIONS, exportValue: toActive }
    }
  ]

  const { table } = useDataTableClient({
    data: contacts.data.contacts,
    columns,
    getRowId: (row) => String(row.InternalCode ?? row.Name)
  })

  const listError = contacts.data.error

  //* sap failures come back as an error, not as an empty list
  useEffect(() => {
    if (listError) toast.error(listError)
  }, [listError])

  const handleExport = () => {
    const visibleColumns = table.getVisibleLeafColumns().filter((column) => column.columnDef.meta?.exportValue)
    const headers = visibleColumns.map((column) => column.columnDef.meta?.title ?? column.id)
    const rows = table
      .getFilteredRowModel()
      .rows.map((row) => visibleColumns.map((column) => column.columnDef.meta!.exportValue!(row.original)))

    exportToExcel({
      fileName: `${DATA_TABLE_UNIQUE_KEY.toUpperCase()}-${bp.CardCode}-${formatDate(new Date(), 'yyyy-MM-dd-HHmmss')}.xlsx`,
      sheetName: 'EXPORTED_DATA',
      headers,
      rows
    })
  }

  return (
    <ContentWrapper className='h-full'>
      <DataTableContainer>
        <DataTableToolbar>
          <DataTableColumnFilterWrapper>
            <DataTableGlobalSearch table={table} isLoading={contacts.isLoading} />
            <DataTableColumnFilter column={table.getColumn('Active')} title='Active' isLoading={contacts.isLoading} />
          </DataTableColumnFilterWrapper>

          <div className='ml-auto flex shrink-0 items-center gap-2'>
            <DataTableRefreshButton onRefresh={() => contacts.execute({ code: bp.CardCode })} isLoading={contacts.isLoading} />

            <CanView subject={PERMISSIONS_CODES.BUSINESS_PARTNERS} action={PERMISSIONS_ALLOWED_ACTIONS.EXPORT}>
              <DataTableExportButton onExport={handleExport} isLoading={contacts.isLoading} />
            </CanView>

            <DataTableViewOptions table={table} isHideLabel align='end' />
          </div>
        </DataTableToolbar>

        <DataTable table={table} isLoading={contacts.isLoading} />
      </DataTableContainer>
    </ContentWrapper>
  )
}
