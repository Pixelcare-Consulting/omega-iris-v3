'use client'

import { ColumnDef } from '@tanstack/react-table'

import Modal from '@/components/modal'
import { DataTable } from '@/components/data-table/data-table'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { DataTableActionsCellWrapper, DataTableTextCell } from '@/components/data-table/data-table-column-cell'
import DataTableContainer from '@/components/data-table/data-table-container'
import DataTableGlobalSearch from '@/components/data-table/data-table-global-search'
import DataTableToolbar from '@/components/data-table/data-table-toolbar'
import DataTableColumnFilterWrapper from '@/components/data-table/data-table-column-filter-wrapper'
import { Button } from '@/components/ui/button'
import { useDataTableServer } from '@/hooks/use-data-table-server'
import { useDataTableInboundItemMastersSvr } from '@/hooks/safe-actions/inbound'
import { DEFAULT_TABLE_INITIAL_STATE } from '@/constants/data-table'
import { InboundItemMasterRow } from '@/actions/inbound'

type ItemMasterPickerModalProps = {
  isOpen: boolean
  inboundCode: string
  isPoRequired: boolean //* parts not on the po are blocked
  selectedMpn: string | null
  onSelect: (row: InboundItemMasterRow) => void
  onClose: () => void
}

export default function ItemMasterPickerModal({
  isOpen,
  inboundCode,
  isPoRequired,
  selectedMpn,
  onSelect,
  onClose
}: ItemMasterPickerModalProps) {
  const columns: ColumnDef<InboundItemMasterRow>[] = [
    {
      accessorKey: 'ItemCode',
      enableSorting: false,
      header: ({ column }) => <DataTableColumnHeader column={column} title='MFG P/N' />,
      cell: ({ row: { original } }) => <DataTableTextCell value={original.ItemCode} highlight={table.getState().globalFilter} />
    },
    {
      accessorKey: 'ItemName',
      enableSorting: false,
      minSize: 220,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Description' />,
      cell: ({ row: { original } }) => (
        <DataTableTextCell value={original.ItemName ?? ''} highlight={table.getState().globalFilter} isWrap />
      )
    },
    {
      accessorKey: 'FirmName',
      enableSorting: false,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Manufacturer' />,
      cell: ({ row: { original } }) => <DataTableTextCell value={original.FirmName ?? ''} highlight={table.getState().globalFilter} />
    },
    {
      accessorKey: 'actions',
      enableSorting: false,
      enableHiding: false,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Actions' className='text-center' />,
      cell: ({ row: { original } }) => {
        const isSelected = original.ItemCode === selectedMpn
        const isBlocked = isPoRequired && !original.isOnPo

        return (
          <DataTableActionsCellWrapper>
            <Button
              type='button'
              size='sm'
              variant={isSelected ? 'outline' : 'default'}
              disabled={isBlocked}
              onClick={() => onSelect(original)}
            >
              {isSelected ? 'Selected' : 'Select'}
            </Button>
          </DataTableActionsCellWrapper>
        )
      }
    }
  ]

  const { table, params, setData, setRowCount } = useDataTableServer({
    columns,
    initialState: { ...DEFAULT_TABLE_INITIAL_STATE, columnPinning: { right: ['actions'] } },
    getRowId: (row) => row.ItemCode
  })

  const dataTableItemMastersSvr = useDataTableInboundItemMastersSvr(
    { ...params, inboundCode },
    { setData, setRowCount, setPageIndex: table.setPageIndex }
  )

  const isLoading = dataTableItemMastersSvr.isLoading

  return (
    <Modal
      isOpen={isOpen}
      title='Select MFG P/N'
      description={isPoRequired ? 'Only the parts on the PO are listed.' : 'Any part from the item master.'}
      size='xl'
      onClose={onClose}
    >
      <div className='flex h-[60vh] min-h-0 flex-col'>
        <DataTableContainer>
          <DataTableToolbar>
            <DataTableColumnFilterWrapper>
              <DataTableGlobalSearch table={table} isLoading={isLoading} />
            </DataTableColumnFilterWrapper>
          </DataTableToolbar>

          <DataTable table={table} isLoading={isLoading} isServerSide />
        </DataTableContainer>
      </div>
    </Modal>
  )
}
