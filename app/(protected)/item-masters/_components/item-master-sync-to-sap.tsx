'use client'

import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'

import { syncItemMastersToSap } from '@/actions/item-master-sync'
import SapSyncModal from '@/components/sap-sync-modal'
import { Icons } from '@/components/icons'
import { TooltipWrapper } from '@/components/tooltip-wrapper'
import LoadingButton from '@/components/forms/button-field'
import { useBatchRun } from '@/hooks/use-batch-run'
import { useLastBatchResult } from '@/hooks/use-last-batch-result'
import { useDisclosure } from '@/hooks/use-disclosure'
import { SAP_SYNC_KEYS, SAP_SYNC_TO_CHUNK_SIZE } from '@/constants/sap-sync'
import { chunkArray } from '@/lib/utils'
import { logger } from '@/lib/logger'

type ItemMasterSyncToSapProps = {
  items: { id: string; ItemCode: string }[]
  userCode: number | null
  onSynced: () => void
}

//* pushes the selected items in chunks, a chunk with no answer counts as failed
export default function ItemMasterSyncToSap({ items, userCode, onSynced }: ItemMasterSyncToSapProps) {
  const modal = useDisclosure()

  const syncAction = useAction(syncItemMastersToSap)
  const { stats, status, run, reset } = useBatchRun()
  const last = useLastBatchResult(SAP_SYNC_KEYS.ITEM_MASTER_TO_SAP, userCode)

  const handleConfirm = async () => {
    try {
      const chunks = chunkArray(items, SAP_SYNC_TO_CHUNK_SIZE)

      const result = await run({
        total: items.length,
        steps: chunks.length,
        stepSize: (index) => chunks[index].length,
        runStep: async (index) => {
          const response = await syncAction.executeAsync({ ids: chunks[index].map((item) => item.id) })
          const data = response?.data

          if (!data || data.error || !data.data) throw new Error(data?.message ?? 'Unexpected error while syncing')

          return data.data
        },
        failStep: (index, message) => chunks[index].map((item) => ({ key: item.id, label: item.ItemCode, entries: [{ field: 'Item', message }] })) // prettier-ignore
      })

      if (result.errors.length > 0) {
        last.save({ finishedAt: new Date().toISOString(), stats: result })
        toast.warning(`${result.succeeded} of ${result.total} item masters synced to SAP, ${result.errors.length} with errors`)
      } else {
        last.clear()
        toast.success(`${result.succeeded} item masters synced to SAP`)
      }
    } catch (err: any) {
      logger.error(err, '[ITEM_MASTER_SYNC_TO_SAP_ERROR]:')
      toast.error('Something went wrong! Please try again later.')
    }
  }

  //* the selection clears on close, so the modal keeps its count while the result shows
  const handleClose = () => {
    if (status === 'completed') onSynced()

    reset()
    modal.onClose()
  }

  if (items.length === 0 && !modal.isOpen) return null

  return (
    <>
      <TooltipWrapper label='Sync selected items to SAP'>
        <LoadingButton type='button' isLoading={status === 'processing'} onClick={modal.onOpen}>
          <Icons.upload /> Sync {items.length} to SAP
        </LoadingButton>
      </TooltipWrapper>

      <SapSyncModal
        isOpen={modal.isOpen}
        title='Sync to SAP'
        description={`${items.length} selected ${items.length === 1 ? 'item' : 'items'}`}
        confirmMessage='This creates the selected items in SAP. Items missing a required field are skipped and listed with their errors.'
        confirmLabel='Sync to SAP'
        entityName='items'
        labelTitle='MFG P/N'
        stats={stats}
        status={status}
        lastResult={last.lastResult}
        onConfirm={handleConfirm}
        onClose={handleClose}
        onClearLast={last.clear}
      />
    </>
  )
}
