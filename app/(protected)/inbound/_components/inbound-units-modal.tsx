'use client'

import { useEffect, useEffectEvent, useMemo } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'

import { getPackagingUnitsByInboundClient, InboundUnitRow } from '@/actions/packaging-unit'
import Modal from '@/components/modal'
import { DataTable } from '@/components/data-table/data-table'
import {
  DataTableActionsCellWrapper,
  DataTableDateCell,
  DataTableNumberCell,
  DataTableTextCell
} from '@/components/data-table/data-table-column-cell'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import DataTableContainer from '@/components/data-table/data-table-container'
import DataTableToolbar from '@/components/data-table/data-table-toolbar'
import DataTableColumnFilterWrapper from '@/components/data-table/data-table-column-filter-wrapper'
import DataTableGlobalSearch from '@/components/data-table/data-table-global-search'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ButtonGroup } from '@/components/ui/button-group'
import LoadingButton from '@/components/forms/button-field'
import { TooltipWrapper } from '@/components/tooltip-wrapper'
import RelationLink from '@/components/relation-link'
import LabelSizeModal from '@/components/label-size-modal'
import { LabelSize } from '@/constants/label'
import { useConfirmAction } from '@/hooks/use-confirm-action'
import { useDataTableClient } from '@/hooks/use-data-table-client'
import { useLabelsPdf } from '@/hooks/use-labels-pdf'
import { getPackagingUnitLabelPdfHref } from '@/lib/packaging-unit'

type LabelTarget = { mode: 'single'; code: string } | { mode: 'bulk' }

type InboundUnitsModalProps = {
  isOpen: boolean
  inboundCode: string
  onClose: () => void
}

//* the unique ids one inbound made, printed right after submit
export default function InboundUnitsModal({ isOpen, inboundCode, onClose }: InboundUnitsModalProps) {
  const unitsAction = useAction(getPackagingUnitsByInboundClient)
  const labelModal = useConfirmAction<LabelTarget>()
  const labelsPdf = useLabelsPdf('/api/packaging-units/labels/pdf')

  const result = unitsAction.result.data
  const units = useMemo(() => result?.data ?? [], [result])

  const columns: ColumnDef<InboundUnitRow>[] = [
    {
      id: 'select',
      enableSorting: false,
      enableHiding: false,
      size: 44,
      minSize: 44,
      maxSize: 44,
      header: ({ table }) => (
        <div className='flex justify-center'>
          <Checkbox
            aria-label='Select all rows'
            checked={table.getIsAllRowsSelected() ? true : table.getIsSomeRowsSelected() ? 'indeterminate' : false}
            onCheckedChange={(value) => table.toggleAllRowsSelected(value === true)}
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className='flex justify-center'>
          <Checkbox aria-label='Select row' checked={row.getIsSelected()} onCheckedChange={(value) => row.toggleSelected(!!value)} />
        </div>
      )
    },
    {
      accessorKey: 'code',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Code' />,
      cell: ({ row: { original } }) => (
        <RelationLink href={`/packaging-units/${encodeURIComponent(original.code)}/view`}>
          <DataTableTextCell value={original.code} highlight={table.getState().globalFilter} />
        </RelationLink>
      )
    },
    {
      accessorKey: 'mpn',
      header: ({ column }) => <DataTableColumnHeader column={column} title='MFG P/N' />,
      cell: ({ row: { original } }) => <DataTableTextCell value={original.mpn} highlight={table.getState().globalFilter} />
    },
    {
      accessorKey: 'quantity',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Qty' />,
      cell: ({ row: { original } }) => <DataTableNumberCell value={original.quantity} maximumFractionDigits={6} />
    },
    {
      accessorKey: 'locationCode',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Location' />,
      cell: ({ row: { original } }) => <DataTableTextCell value={original.locationCode} highlight={table.getState().globalFilter} />
    },
    {
      accessorKey: 'receivedAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Received At' />,
      cell: ({ row: { original } }) => <DataTableDateCell value={original.receivedAt} />
    },
    {
      id: 'actions',
      size: 70,
      minSize: 70,
      enableSorting: false,
      enableHiding: false,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Actions' className='text-center' />,
      cell: ({ row: { original } }) => (
        <DataTableActionsCellWrapper>
          <TooltipWrapper label='Print Label'>
            <Button variant='ghost' size='icon-sm' onClick={() => labelModal.open({ mode: 'single', code: original.code })}>
              <Icons.qrCode className='text-muted-foreground size-4' />
            </Button>
          </TooltipWrapper>
        </DataTableActionsCellWrapper>
      )
    }
  ]

  const { table } = useDataTableClient({ data: units, columns, getRowId: (row) => row.id })

  const rowSelection = table.getState().rowSelection
  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id])

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

  //* reads the latest action, so the effect reruns only on open or a new inbound
  const loadUnits = useEffectEvent(() => unitsAction.execute({ inboundCode }))

  useEffect(() => {
    if (isOpen) loadUnits()
  }, [isOpen, inboundCode])

  useEffect(() => {
    if (result?.error) toast.error(result.message)
  }, [result])

  return (
    <Modal
      isOpen={isOpen}
      title={`Unique IDs for ${inboundCode}`}
      description='Print one label or select several.'
      size='xl'
      onClose={onClose}
    >
      <div className='flex h-[60vh] min-h-0 flex-col'>
        <DataTableContainer>
          <DataTableToolbar>
            <DataTableColumnFilterWrapper>
              <DataTableGlobalSearch table={table} isLoading={unitsAction.isExecuting} />
            </DataTableColumnFilterWrapper>

            {selectedIds.length > 0 && (
              <ButtonGroup className='ml-auto'>
                <LoadingButton
                  type='button'
                  variant='outline-primary'
                  isLoading={labelsPdf.isLoading}
                  onClick={() => labelModal.open({ mode: 'bulk' })}
                >
                  <Icons.qrCode /> Print {selectedIds.length} {selectedIds.length === 1 ? 'Label' : 'Labels'}
                </LoadingButton>

                <TooltipWrapper label='Clear Selection'>
                  <Button type='button' variant='outline-primary' size='icon' onClick={() => table.resetRowSelection()}>
                    <Icons.x />
                  </Button>
                </TooltipWrapper>
              </ButtonGroup>
            )}
          </DataTableToolbar>

          <DataTable table={table} isLoading={unitsAction.isExecuting} />
        </DataTableContainer>
      </div>

      <LabelSizeModal
        isOpen={labelModal.isOpen}
        title={labelModal.target?.mode === 'single' ? 'Print Label' : 'Print Labels'}
        isBulk={labelModal.target?.mode === 'bulk'}
        description={
          labelModal.target?.mode === 'single'
            ? `QR label for "${labelModal.target.code}"`
            : `QR labels for ${selectedIds.length} selected ${selectedIds.length === 1 ? 'unique ID' : 'unique IDs'}`
        }
        isLoading={labelsPdf.isLoading}
        onClose={labelModal.close}
        onView={handleLabelView}
        onDownload={handleLabelDownload}
      />
    </Modal>
  )
}
