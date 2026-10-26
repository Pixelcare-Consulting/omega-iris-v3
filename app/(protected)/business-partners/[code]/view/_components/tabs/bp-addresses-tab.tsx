'use client'

import { useEffect, useMemo } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'

import { BusinessPartnerLookups } from '@/actions/business-partner'
import { SapBPAddress, SapBusinessPartner } from '@/types/sap'
import { useBusinessPartnerAddresses } from '@/hooks/safe-actions/business-partner'
import { useDataTableClient } from '@/hooks/use-data-table-client'
import ContentWrapper from '@/components/content-wrapper'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/data-table/data-table'
import { DataTableTextCell } from '@/components/data-table/data-table-column-cell'
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
import { ADDRESS_TYPE_OPTIONS, toOptionLabel } from '@/constants/business-partner'
import { multiSelectFilterFn } from '@/lib/data-table'
import { formatDate } from '@/lib/utils'
import { exportToExcel } from '@/lib/xlsx'

type BPAddressesTabProps = { businessPartner: SapBusinessPartner; lookups: BusinessPartnerLookups | null }

export default function BPAddressesTab({ businessPartner: bp, lookups }: BPAddressesTabProps) {
  const DATA_TABLE_UNIQUE_KEY = 'business-partner-addresses'

  const addresses = useBusinessPartnerAddresses(bp.CardCode)

  const countryNames = useMemo(() => new Map((lookups?.countries ?? []).map((c) => [c.Code, c.Name])), [lookups])
  const toCountryName = (code?: string | null) => (code ? (countryNames.get(code) ?? code) : null)

  //* the default of each type gets a badge
  const isDefault = (row: SapBPAddress) => (row.AddressType === 'bo_BillTo' ? bp.BilltoDefault : bp.ShipToDefault) === row.AddressName

  const typeOptions = useMemo(() => ADDRESS_TYPE_OPTIONS.map((o) => ({ label: o.label, value: o.label })), [])

  const countryOptions = useMemo(() => (lookups?.countries ?? []).map((c) => ({ label: c.Name, value: c.Name })), [lookups])

  const columns: ColumnDef<SapBPAddress>[] = [
    {
      accessorKey: 'AddressName',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Address ID' />,
      cell: ({ row: { original: data } }) => (
        <span className='flex items-center gap-2'>
          <DataTableTextCell value={data.AddressName} highlight={table.getState().globalFilter} />
          {isDefault(data) && <Badge variant='secondary'>Default</Badge>}
        </span>
      ),
      meta: { title: 'Address ID', exportValue: (row) => row.AddressName }
    },
    {
      id: 'AddressType',
      accessorFn: (row) => toOptionLabel(ADDRESS_TYPE_OPTIONS, row.AddressType),
      filterFn: multiSelectFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Address Type' />,
      cell: ({ getValue }) => <DataTableTextCell value={getValue<string>()} highlight={table.getState().globalFilter} />,
      meta: { title: 'Address Type', options: typeOptions, exportValue: (row) => toOptionLabel(ADDRESS_TYPE_OPTIONS, row.AddressType) }
    },
    {
      accessorKey: 'AddressName2',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Address Name 2' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.AddressName2} highlight={table.getState().globalFilter} />,
      meta: { title: 'Address Name 2', exportValue: (row) => row.AddressName2 }
    },
    {
      accessorKey: 'AddressName3',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Address Name 3' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.AddressName3} highlight={table.getState().globalFilter} />,
      meta: { title: 'Address Name 3', exportValue: (row) => row.AddressName3 }
    },
    {
      accessorKey: 'Street',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Street / PO Box' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.Street} highlight={table.getState().globalFilter} />,
      meta: { title: 'Street / PO Box', exportValue: (row) => row.Street }
    },
    {
      accessorKey: 'City',
      header: ({ column }) => <DataTableColumnHeader column={column} title='City' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.City} highlight={table.getState().globalFilter} />,
      meta: { title: 'City', exportValue: (row) => row.City }
    },
    {
      accessorKey: 'ZipCode',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Zip Code' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.ZipCode} highlight={table.getState().globalFilter} />,
      meta: { title: 'Zip Code', exportValue: (row) => row.ZipCode }
    },
    {
      accessorKey: 'State',
      header: ({ column }) => <DataTableColumnHeader column={column} title='State' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.State} highlight={table.getState().globalFilter} />,
      meta: { title: 'State', exportValue: (row) => row.State }
    },
    {
      id: 'Country',
      accessorFn: (row) => toCountryName(row.Country),
      filterFn: multiSelectFilterFn,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Country/Region' />,
      cell: ({ getValue }) => <DataTableTextCell value={getValue<string | null>()} highlight={table.getState().globalFilter} />,
      meta: { title: 'Country/Region', options: countryOptions, exportValue: (row) => toCountryName(row.Country) }
    }
  ]

  const { table } = useDataTableClient({
    data: addresses.data.addresses,
    columns,
    getRowId: (row) => `${row.AddressType}-${row.AddressName}`
  })

  const listError = addresses.data.error

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
            <DataTableGlobalSearch table={table} isLoading={addresses.isLoading} />
            <DataTableColumnFilter column={table.getColumn('AddressType')} title='Address Type' isLoading={addresses.isLoading} />
            <DataTableColumnFilter column={table.getColumn('Country')} title='Country/Region' isLoading={addresses.isLoading} />
          </DataTableColumnFilterWrapper>

          <div className='ml-auto flex shrink-0 items-center gap-2'>
            <DataTableRefreshButton onRefresh={() => addresses.execute({ code: bp.CardCode })} isLoading={addresses.isLoading} />

            <CanView subject={PERMISSIONS_CODES.BUSINESS_PARTNERS} action={PERMISSIONS_ALLOWED_ACTIONS.EXPORT}>
              <DataTableExportButton onExport={handleExport} isLoading={addresses.isLoading} />
            </CanView>

            <DataTableViewOptions table={table} isHideLabel align='end' />
          </div>
        </DataTableToolbar>

        <DataTable table={table} isLoading={addresses.isLoading} />
      </DataTableContainer>
    </ContentWrapper>
  )
}
