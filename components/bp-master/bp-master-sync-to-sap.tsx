'use client'

import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'

import { syncBpMastersToSap } from '@/actions/bp-master-sync'
import SapSyncModal from '@/components/sap-sync-modal'
import { Icons } from '@/components/icons'
import { TooltipWrapper } from '@/components/tooltip-wrapper'
import LoadingButton from '@/components/forms/button-field'
import { useBatchRun } from '@/hooks/use-batch-run'
import { useLastBatchResult } from '@/hooks/use-last-batch-result'
import { useDisclosure } from '@/hooks/use-disclosure'
import { SAP_SYNC_TO_CHUNK_SIZE } from '@/constants/sap-sync'
import { BP_MASTER_CONFIG, BP_SYNC_KEYS, BpMasterType } from '@/constants/bp-master'
import { chunkArray } from '@/lib/utils'
import { logger } from '@/lib/logger'

type BpMasterSyncToSapProps = {
  type: BpMasterType
  items: { id: string; CardCode: string }[]
  userCode: number | null
  onSynced: () => void
}

//* pushes the selected partners in chunks, a chunk with no answer counts as failed
export default function BpMasterSyncToSap({ type, items, userCode, onSynced }: BpMasterSyncToSapProps) {
  const modal = useDisclosure()

  const { label, pluralLabel } = BP_MASTER_CONFIG[type]
  const entityName = pluralLabel.toLowerCase()

  const syncAction = useAction(syncBpMastersToSap)
  const { stats, status, run, reset } = useBatchRun()
  const last = useLastBatchResult(BP_SYNC_KEYS[type].to, userCode)

  const handleConfirm = async () => {
    try {
      const chunks = chunkArray(items, SAP_SYNC_TO_CHUNK_SIZE)

      const result = await run({
        total: items.length,
        steps: chunks.length,
        stepSize: (index) => chunks[index].length,
        runStep: async (index) => {
          const response = await syncAction.executeAsync({ type, ids: chunks[index].map((item) => item.id) })
          const data = response?.data

          if (!data || data.error || !data.data) throw new Error(data?.message ?? 'Unexpected error while syncing')

          return data.data
        },
        failStep: (index, message) => chunks[index].map((item) => ({ key: item.id, label: item.CardCode, entries: [{ field: label, message }] })) // prettier-ignore
      })

      if (result.errors.length > 0) {
        last.save({ finishedAt: new Date().toISOString(), stats: result })
        toast.warning(`${result.succeeded} of ${result.total} ${entityName} synced to SAP, ${result.errors.length} with errors`)
      } else {
        last.clear()
        toast.success(`${result.succeeded} ${entityName} synced to SAP`)
      }
    } catch (err: any) {
      logger.error(err, '[BP_MASTER_SYNC_TO_SAP_ERROR]:')
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
      <TooltipWrapper label={`Sync selected ${entityName} to SAP`}>
        <LoadingButton type='button' variant='outline-primary' isLoading={status === 'processing'} onClick={modal.onOpen}>
          <Icons.upload /> Sync {items.length} to SAP
        </LoadingButton>
      </TooltipWrapper>

      <SapSyncModal
        isOpen={modal.isOpen}
        title='Sync to SAP'
        description={`${items.length} selected ${items.length === 1 ? label.toLowerCase() : entityName}`}
        confirmMessage={`This creates the selected ${entityName} in SAP with their addresses and contacts. ${pluralLabel} missing a required field are skipped and listed with their errors.`}
        confirmLabel='Sync to SAP'
        entityName={entityName}
        labelTitle={`${label} Code`}
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
