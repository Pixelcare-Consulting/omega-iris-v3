'use client'

import { ColumnDef } from '@tanstack/react-table'

import { DataTable } from '@/components/data-table/data-table'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { DataTableNumberCell, DataTableTextCell } from '@/components/data-table/data-table-column-cell'
import DataTableContainer from '@/components/data-table/data-table-container'
import DataTableGlobalSearch from '@/components/data-table/data-table-global-search'
import { useDataTableClient } from '@/hooks/use-data-table-client'
import { InboundPurchaseOrder, InboundPurchaseOrderLine } from '@/actions/inbound'
import { cn, formatDate } from '@/lib/utils'

type PoSummaryProps = { purchaseOrder: InboundPurchaseOrder }

const formatSapDate = (value: string) => formatDate(new Date(value), 'MMM dd, yyyy')

function SummaryItem({ label, value, className, isWrap }: { label: string; value: React.ReactNode; className?: string; isWrap?: boolean }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-0.5', className)}>
      <span className='text-muted-foreground text-xs'>{label}</span>
      <span className={cn('text-sm font-medium', isWrap ? 'wrap-break-word' : 'truncate')}>{value || '—'}</span>
    </div>
  )
}

const columns: ColumnDef<InboundPurchaseOrderLine>[] = [
  {
    accessorKey: 'ItemCode',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Item No.' />,
    cell: ({ row, table }) => <DataTableTextCell value={row.original.ItemCode} highlight={table.getState().globalFilter} />
  },
  {
    accessorKey: 'ItemDescription',
    minSize: 220,
    header: ({ column }) => <DataTableColumnHeader column={column} title='Item Description' />,
    cell: ({ row, table }) => <DataTableTextCell value={row.original.ItemDescription} highlight={table.getState().globalFilter} isWrap />
  },
  {
    accessorKey: 'ManufacturerName',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Manufacturer' />,
    cell: ({ row, table }) => <DataTableTextCell value={row.original.ManufacturerName ?? ''} highlight={table.getState().globalFilter} />
  },
  {
    accessorKey: 'Quantity',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Ordered Qty' />,
    cell: ({ row }) => <DataTableNumberCell value={row.original.Quantity} maximumFractionDigits={6} />
  },
  {
    //* what a package must match
    accessorKey: 'OpenQuantity',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Open Qty' />,
    cell: ({ row }) => <DataTableNumberCell value={row.original.OpenQuantity} maximumFractionDigits={6} />
  },
  {
    accessorKey: 'Price',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Unit Price' />,
    cell: ({ row }) => <DataTableNumberCell value={row.original.Price} minimumFractionDigits={4} maximumFractionDigits={6} />
  }
]

export default function PoSummary({ purchaseOrder }: PoSummaryProps) {
  const { DocNum, CardCode, CardName, DocDate, DocDueDate, DocumentLines } = purchaseOrder

  const { table } = useDataTableClient({ data: DocumentLines, columns, getRowId: (line) => String(line.LineNum) })

  return (
    <div className='flex flex-col gap-4'>
      {/* //* one line on wide screens, vendor name gets the most room and wraps */}
      <div className='bg-muted/40 grid grid-cols-2 gap-4 rounded-lg border p-3.5 sm:grid-cols-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]'>
        <SummaryItem label='PO No.' value={DocNum} />
        <SummaryItem label='Vendor Code' value={CardCode} />
        <SummaryItem label='Vendor Name' value={CardName} className='col-span-2 lg:col-span-1' isWrap />
        <SummaryItem label='Posting Date' value={formatSapDate(DocDate)} />
        <SummaryItem label='Delivery Date' value={formatSapDate(DocDueDate)} />
      </div>

      {/* //* a po can carry many lines, so they search and page in the browser */}
      <DataTableContainer className='h-105 flex-none'>
        <DataTableGlobalSearch table={table} />
        <DataTable table={table} />
      </DataTableContainer>
    </div>
  )
}
