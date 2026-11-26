'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ColumnDef } from '@tanstack/react-table'

import { InboundItemWithInclude, InboundWithInclude } from '@/actions/inbound'
import { useDataTableClient } from '@/hooks/use-data-table-client'
import ContentWrapper from '@/components/content-wrapper'
import CanView from '@/components/rbac/can-view'
import RelationLink from '@/components/relation-link'
import { DataTable } from '@/components/data-table/data-table'
import { DataTableBooleanCell, DataTableNumberCell, DataTableTextCell } from '@/components/data-table/data-table-column-cell'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import DataTableContainer from '@/components/data-table/data-table-container'
import DataTableToolbar from '@/components/data-table/data-table-toolbar'
import DataTableColumnFilterWrapper from '@/components/data-table/data-table-column-filter-wrapper'
import DataTableGlobalSearch from '@/components/data-table/data-table-global-search'
import DataTableRefreshButton from '@/components/data-table/data-table-refresh-button'
import DataTableExportButton from '@/components/data-table/data-table-export-button'
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { formatDate } from '@/lib/utils'
import { exportToExcel } from '@/lib/xlsx'

type InboundPackagesTabProps = { inbound: InboundWithInclude }

export default function InboundPackagesTab({ inbound }: InboundPackagesTabProps) {
  const DATA_TABLE_UNIQUE_KEY = 'inbound-packages'

  const router = useRouter()
  const [isRefreshing, startRefresh] = useTransition()

  const columns: ColumnDef<InboundItemWithInclude>[] = [
    {
      accessorKey: 'lineNum',
      header: ({ column }) => <DataTableColumnHeader column={column} title='#' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={String(data.lineNum)} />,
      meta: { title: '#', exportValue: (row) => row.lineNum }
    },
    {
      accessorKey: 'owner',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Owner' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.owner} highlight={table.getState().globalFilter} />,
      meta: { title: 'Owner', exportValue: (row) => row.owner ?? '' }
    },
    {
      accessorKey: 'mpn',
      header: ({ column }) => <DataTableColumnHeader column={column} title='MFG P/N' />,
      cell: ({ row: { original: data } }) => (
        <RelationLink href={`/item-masters/${encodeURIComponent(data.mpn)}/view`}>
          <DataTableTextCell value={data.mpn} highlight={table.getState().globalFilter} />
        </RelationLink>
      ),
      meta: { title: 'MFG P/N', exportValue: (row) => row.mpn }
    },
    {
      accessorKey: 'partNumber',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Part Number' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.partNumber} highlight={table.getState().globalFilter} />,
      meta: { title: 'Part Number', exportValue: (row) => row.partNumber ?? '' }
    },
    {
      id: 'mfr',
      accessorFn: (row) => row.itemMaster.FirmName ?? '',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Manufacturer' />,
      cell: ({ row: { original: data } }) => (
        <DataTableTextCell value={data.itemMaster.FirmName} highlight={table.getState().globalFilter} />
      ),
      meta: { title: 'Manufacturer', exportValue: (row) => row.itemMaster.FirmName ?? '' }
    },
    {
      id: 'description',
      minSize: 220,
      accessorFn: (row) => row.itemMaster.ItemName ?? '',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Description' />,
      cell: ({ row: { original: data } }) => (
        <DataTableTextCell value={data.itemMaster.ItemName} highlight={table.getState().globalFilter} isWrap />
      ),
      meta: { title: 'Description', exportValue: (row) => row.itemMaster.ItemName ?? '' }
    },
    {
      id: 'commodity',
      accessorFn: (row) => row.commodity?.name ?? '',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Commodities' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.commodity?.name} highlight={table.getState().globalFilter} />,
      meta: { title: 'Commodities', exportValue: (row) => (row.commodity ? `${row.commodity.code} (${row.commodity.name})` : '') }
    },
    {
      accessorKey: 'dateCode',
      header: ({ column }) => <DataTableColumnHeader column={column} title='DC' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.dateCode} highlight={table.getState().globalFilter} />,
      meta: { title: 'DC', exportValue: (row) => row.dateCode ?? '' }
    },
    {
      accessorKey: 'countryOfOrigin',
      header: ({ column }) => <DataTableColumnHeader column={column} title='COO' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.countryOfOrigin} highlight={table.getState().globalFilter} />,
      meta: { title: 'COO', exportValue: (row) => row.countryOfOrigin ?? '' }
    },
    {
      accessorKey: 'lotCode',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Lot Code' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.lotCode} highlight={table.getState().globalFilter} />,
      meta: { title: 'Lot Code', exportValue: (row) => row.lotCode ?? '' }
    },
    {
      id: 'packagingType',
      accessorFn: (row) => row.packagingType?.name ?? '',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Packaging Type' />,
      cell: ({ row: { original: data } }) => (
        <DataTableTextCell value={data.packagingType?.name} highlight={table.getState().globalFilter} />
      ),
      meta: {
        title: 'Packaging Type',
        exportValue: (row) => (row.packagingType ? `${row.packagingType.code} (${row.packagingType.name})` : '')
      }
    },
    {
      accessorKey: 'spq',
      header: ({ column }) => <DataTableColumnHeader column={column} title='SPQ' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.spq} />,
      meta: { title: 'SPQ', exportValue: (row) => row.spq ?? '' }
    },
    {
      accessorKey: 'cost',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Cost' />,
      cell: ({ row: { original: data } }) => <DataTableNumberCell value={data.cost} minimumFractionDigits={4} maximumFractionDigits={6} />,
      meta: { title: 'Cost', exportValue: (row) => row.cost ?? '' }
    },
    {
      accessorKey: 'totalStock',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Received Qty' />,
      cell: ({ row: { original: data } }) => <DataTableNumberCell value={data.totalStock} maximumFractionDigits={6} />,
      meta: { title: 'Received Qty', exportValue: (row) => row.totalStock }
    },
    {
      accessorKey: 'isMandatoryQc',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Mandatory QC' />,
      cell: ({ row: { original: data } }) => (
        <DataTableBooleanCell value={data.isMandatoryQc} display={{ type: 'text', true: 'Yes', false: 'No' }} />
      ),
      meta: { title: 'Mandatory QC', exportValue: (row) => (row.isMandatoryQc ? 'Yes' : 'No') }
    },
    {
      accessorKey: 'notes',
      minSize: 220,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Notes' />,
      cell: ({ row: { original: data } }) => <DataTableTextCell value={data.notes} highlight={table.getState().globalFilter} isWrap />,
      meta: { title: 'Notes', exportValue: (row) => row.notes ?? '' }
    }
  ]

  const { table } = useDataTableClient({
    data: inbound.items,
    columns,
    initialState: { columnPinning: { right: ['totalStock'] }, columnVisibility: { notes: false } },
    getRowId: (row) => row.id
  })

  const handleExport = () => {
    const visibleColumns = table.getVisibleLeafColumns().filter((column) => column.columnDef.meta?.exportValue)
    const headers = visibleColumns.map((column) => column.columnDef.meta?.title ?? column.id)
    const rows = table
      .getFilteredRowModel()
      .rows.map((row) => visibleColumns.map((column) => column.columnDef.meta!.exportValue!(row.original)))

    exportToExcel({
      fileName: `${DATA_TABLE_UNIQUE_KEY.toUpperCase()}-${inbound.code}-${formatDate(new Date(), 'yyyy-MM-dd-HHmmss')}.xlsx`,
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
            <DataTableGlobalSearch table={table} isLoading={isRefreshing} />
          </DataTableColumnFilterWrapper>

          <div className='ml-auto flex shrink-0 items-center gap-2'>
            <DataTableRefreshButton onRefresh={() => startRefresh(() => router.refresh())} isLoading={isRefreshing} />

            <CanView subject={PERMISSIONS_CODES.INBOUNDS} action={PERMISSIONS_ALLOWED_ACTIONS.EXPORT}>
              <DataTableExportButton onExport={handleExport} isLoading={isRefreshing} />
            </CanView>

            <DataTableViewOptions table={table} isHideLabel align='end' />
          </div>
        </DataTableToolbar>

        <DataTable table={table} isLoading={isRefreshing} />
      </DataTableContainer>
    </ContentWrapper>
  )
}
