'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAction } from 'next-safe-action/hooks'
import { ColumnDef } from '@tanstack/react-table'

import { deleteInboundItem, InboundCategory, InboundItemWithInclude, InboundReferenceOptions, InboundWithInclude } from '@/actions/inbound'
import { DataTable } from '@/components/data-table/data-table'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { DataTableActionsCellWrapper, DataTableNumberCell, DataTableTextCell } from '@/components/data-table/data-table-column-cell'
import DataTableContainer from '@/components/data-table/data-table-container'
import DataTableGlobalSearch from '@/components/data-table/data-table-global-search'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import AlertModal from '@/components/alert-modal'
import { TooltipWrapper } from '@/components/tooltip-wrapper'
import { useConfirmAction } from '@/hooks/use-confirm-action'
import { useDataTableClient } from '@/hooks/use-data-table-client'
import { usePurchaseOrder } from '@/hooks/safe-actions/inbound'
import { getOrderedQty, getOverReceivedParts, getShortParts, isPartOnPo } from '@/lib/inbound'
import { logger } from '@/lib/logger'
import InboundItemForm from './inbound-item-form'
import InboundPoDetailsSheet from './inbound-po-details-sheet'
import InboundItemImportModal from './inbound-item-import-modal'

type InboundItemsStepProps = {
  inbound: InboundWithInclude
  userCode: number | null
  category: InboundCategory | null
  referenceOptions: InboundReferenceOptions
  isReadOnly: boolean
}

export default function InboundItemsStep({ inbound, userCode, category, referenceOptions, isReadOnly }: InboundItemsStepProps) {
  const router = useRouter()

  const [formTarget, setFormTarget] = useState<{ item: InboundItemWithInclude | null } | null>(null)
  const [isPoDetailsOpen, setIsPoDetailsOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)

  const purchaseOrder = usePurchaseOrder(inbound.poNum)
  const deleteConfirm = useConfirmAction<{ lineNum: number }>()
  const deleteInboundItemAction = useAction(deleteInboundItem)

  const isPoRequired = !!category?.isPoRequired

  const poLines = useMemo(() => purchaseOrder.data?.DocumentLines ?? [], [purchaseOrder.data])

  //* parts whose packages add up past what the po still has open
  const overParts = useMemo(() => new Set(getOverReceivedParts(inbound.items, poLines).map((row) => row.mpn)), [inbound.items, poLines])

  //* parts whose packages add up to less than the open qty
  const shortParts = useMemo(() => new Set(getShortParts(inbound.items, poLines).map((row) => row.mpn)), [inbound.items, poLines])

  //* each part totals at most its open qty, partial off needs it exact
  const toPoStatus = (item: InboundItemWithInclude) => {
    const part = item.mpn.trim().toUpperCase()

    if (!isPartOnPo(item.mpn, poLines)) return { label: 'Not on PO', isOk: false }
    if (overParts.has(part)) return { label: 'Over open qty', isOk: false }
    if (!inbound.isPartialReceived && shortParts.has(part)) return { label: 'Below open qty', isOk: false }
    return { label: 'On PO', isOk: true }
  }

  const columns: ColumnDef<InboundItemWithInclude>[] = [
    {
      accessorKey: 'lineNum',
      header: ({ column }) => <DataTableColumnHeader column={column} title='#' />,
      cell: ({ row: { original } }) => <DataTableTextCell value={String(original.lineNum)} />
    },
    {
      accessorKey: 'owner',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Owner' />,
      cell: ({ row: { original } }) => <DataTableTextCell value={original.owner ?? ''} highlight={table.getState().globalFilter} />
    },
    {
      accessorKey: 'mpn',
      header: ({ column }) => <DataTableColumnHeader column={column} title='MFG P/N' />,
      cell: ({ row: { original } }) => <DataTableTextCell value={original.mpn} highlight={table.getState().globalFilter} />
    },
    {
      accessorKey: 'partNumber',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Part Number' />,
      cell: ({ row: { original } }) => <DataTableTextCell value={original.partNumber ?? ''} highlight={table.getState().globalFilter} />
    },
    {
      id: 'mfr',
      accessorFn: (item) => item.itemMaster.FirmName ?? '',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Manufacturer' />,
      cell: ({ row: { original } }) => (
        <DataTableTextCell value={original.itemMaster.FirmName ?? ''} highlight={table.getState().globalFilter} />
      )
    },
    {
      id: 'description',
      minSize: 220,
      accessorFn: (item) => item.itemMaster.ItemName ?? '',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Description' />,
      cell: ({ row: { original } }) => (
        <DataTableTextCell value={original.itemMaster.ItemName ?? ''} highlight={table.getState().globalFilter} isWrap />
      )
    },
    {
      id: 'commodity',
      accessorFn: (item) => item.commodity?.name ?? '',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Commodities' />,
      cell: ({ row: { original } }) => (
        <DataTableTextCell value={original.commodity?.name ?? ''} highlight={table.getState().globalFilter} />
      )
    },
    {
      accessorKey: 'dateCode',
      header: ({ column }) => <DataTableColumnHeader column={column} title='DC' />,
      cell: ({ row: { original } }) => <DataTableTextCell value={original.dateCode ?? ''} highlight={table.getState().globalFilter} />
    },
    {
      accessorKey: 'countryOfOrigin',
      header: ({ column }) => <DataTableColumnHeader column={column} title='COO' />,
      cell: ({ row: { original } }) => (
        <DataTableTextCell value={original.countryOfOrigin ?? ''} highlight={table.getState().globalFilter} />
      )
    },
    {
      accessorKey: 'lotCode',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Lot Code' />,
      cell: ({ row: { original } }) => <DataTableTextCell value={original.lotCode ?? ''} highlight={table.getState().globalFilter} />
    },
    {
      id: 'packagingType',
      accessorFn: (item) => item.packagingType?.name ?? '',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Packaging Type' />,
      cell: ({ row: { original } }) => (
        <DataTableTextCell value={original.packagingType?.name ?? ''} highlight={table.getState().globalFilter} />
      )
    },
    {
      accessorKey: 'spq',
      header: ({ column }) => <DataTableColumnHeader column={column} title='SPQ' />,
      cell: ({ row: { original } }) => <DataTableTextCell value={original.spq} />
    },
    {
      accessorKey: 'cost',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Cost' />,
      cell: ({ row: { original } }) => <DataTableNumberCell value={original.cost} minimumFractionDigits={4} maximumFractionDigits={6} />
    },
    {
      accessorKey: 'notes',
      minSize: 220,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Notes' />,
      cell: ({ row: { original } }) => <DataTableTextCell value={original.notes ?? ''} highlight={table.getState().globalFilter} isWrap />
    },
    {
      id: 'orderedQty',
      accessorFn: (item) => getOrderedQty(item.mpn, poLines),
      header: ({ column }) => <DataTableColumnHeader column={column} title='Ordered Qty' />,
      cell: ({ row: { original } }) => <DataTableNumberCell value={getOrderedQty(original.mpn, poLines)} maximumFractionDigits={6} />
    },
    {
      accessorKey: 'totalStock',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Received Qty' />,
      cell: ({ row: { original } }) => <DataTableNumberCell value={original.totalStock} maximumFractionDigits={6} />
    },
    {
      id: 'isPoLine',
      size: 110,
      minSize: 110,
      accessorFn: (item) => toPoStatus(item).label,
      header: ({ column }) => <DataTableColumnHeader column={column} title='PO Line' />,
      cell: ({ row: { original } }) => {
        const poStatus = toPoStatus(original)
        return <Badge variant={poStatus.isOk ? 'soft-green' : 'soft-red'}>{poStatus.label}</Badge>
      }
    },
    {
      id: 'actions',
      size: 100,
      minSize: 100,
      enableSorting: false,
      enableHiding: false,
      header: ({ column }) => <DataTableColumnHeader column={column} title='Actions' className='text-center' />,
      cell: ({ row: { original } }) => (
        <DataTableActionsCellWrapper>
          <TooltipWrapper label='Edit'>
            <Button type='button' variant='ghost' size='icon-sm' disabled={isReadOnly} onClick={() => setFormTarget({ item: original })}>
              <Icons.pencil className='text-muted-foreground size-4' />
            </Button>
          </TooltipWrapper>
          <TooltipWrapper label='Delete'>
            <Button
              type='button'
              variant='ghost'
              size='icon-sm'
              disabled={isReadOnly}
              onClick={() => deleteConfirm.open({ lineNum: original.lineNum })}
            >
              <Icons.trash className='text-destructive size-4' />
            </Button>
          </TooltipWrapper>
        </DataTableActionsCellWrapper>
      )
    }
  ]

  const { table } = useDataTableClient({
    data: inbound.items,
    columns,
    initialState: {
      columnPinning: { right: ['orderedQty', 'totalStock', 'isPoLine', 'actions'] },
      //* a po match and ordered qty mean nothing without a po
      columnVisibility: { orderedQty: isPoRequired, isPoLine: isPoRequired }
    },
    getRowId: (item) => item.id
  })

  const handleConfirmDelete = async () => {
    if (!deleteConfirm.target) return

    const { lineNum } = deleteConfirm.target

    deleteConfirm.close()

    try {
      const response = await deleteInboundItemAction.executeAsync({ inboundCode: inbound.code, lineNum })
      const result = response?.data

      if (!result || result.error) {
        toast.error(result?.message ?? 'Something went wrong! Please try again later.')
        return
      }

      toast.success(result.message)
      router.refresh()
    } catch (err: any) {
      logger.error(err, '[INBOUND_ITEMS_STEP_DELETE_ERROR]:')
      toast.error('Something went wrong! Please try again later.')
    }
  }

  return (
    <div className='flex flex-col gap-5'>
      <div className='flex flex-wrap items-end gap-3'>
        <div className='flex flex-1 flex-col gap-1'>
          <h2 className='text-base font-semibold'>Received &amp; inspection</h2>
          <p className='text-muted-foreground text-sm'>
            One row per package. Each row becomes a unique ID with its own QR when the inbound is submitted.
          </p>
        </div>

        <div className='flex flex-wrap gap-2'>
          {inbound.poNum && (
            <Button type='button' variant='outline' onClick={() => setIsPoDetailsOpen(true)}>
              <Icons.fileText /> PO Details
            </Button>
          )}

          {!isReadOnly && (
            <>
              <Button type='button' variant='outline' onClick={() => setIsImportOpen(true)}>
                <Icons.upload /> Import
              </Button>

              <Button type='button' onClick={() => setFormTarget({ item: null })}>
                <Icons.plus /> Add Package
              </Button>
            </>
          )}
        </div>
      </div>

      <DataTableContainer className='h-120 flex-none'>
        <DataTableGlobalSearch table={table} />
        <DataTable table={table} />
      </DataTableContainer>

      {formTarget && (
        <InboundItemForm
          isOpen={!!formTarget}
          inboundCode={inbound.code}
          inboundItem={formTarget.item}
          isPoRequired={isPoRequired}
          isMandatoryQc={!!category?.isMandatoryQc}
          items={inbound.items}
          purchaseOrder={purchaseOrder.data}
          referenceOptions={referenceOptions}
          onClose={() => setFormTarget(null)}
        />
      )}

      <InboundPoDetailsSheet isOpen={isPoDetailsOpen} purchaseOrder={purchaseOrder.data} onClose={() => setIsPoDetailsOpen(false)} />

      <InboundItemImportModal
        isOpen={isImportOpen}
        inboundCode={inbound.code}
        userCode={userCode}
        onClose={() => setIsImportOpen(false)}
        onImported={() => router.refresh()}
      />

      <AlertModal
        isOpen={deleteConfirm.isOpen}
        title='Are you sure?'
        description={`Remove line ${deleteConfirm.target?.lineNum ?? ''} from ${inbound.code}? A draft line is deleted for good.`}
        onConfirmText='Delete'
        onConfirm={handleConfirmDelete}
        onCancel={deleteConfirm.close}
        isLoading={deleteInboundItemAction.isExecuting}
        loadingText='Deleting'
      />
    </div>
  )
}
