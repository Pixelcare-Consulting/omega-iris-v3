'use client'

import { useEffect, useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'

import {
  failItemMasterSyncFromSap,
  finishItemMasterSyncFromSap,
  startItemMasterSyncFromSap,
  syncItemMastersFromSapPage
} from '@/actions/item-master-sync'
import { getSapSyncStateClient } from '@/actions/sap-sync-state'
import SapSyncModal from '@/components/sap-sync-modal'
import { Icons } from '@/components/icons'
import { Badge } from '@/components/ui/badge'
import { TooltipWrapper } from '@/components/tooltip-wrapper'
import LoadingButton from '@/components/forms/button-field'
import { useBatchRun } from '@/hooks/use-batch-run'
import { useLastBatchResult } from '@/hooks/use-last-batch-result'
import { useDisclosure } from '@/hooks/use-disclosure'
import { SAP_SYNC_FROM_PAGE_SIZE, SAP_SYNC_KEYS } from '@/constants/sap-sync'
import { useItemMasterLookups } from '@/hooks/safe-actions/item-master'
import { formatDate } from '@/lib/utils'
import { logger } from '@/lib/logger'

type ItemMasterSyncFromSapProps = { userCode: number | null; onSynced: () => void }

const PAGE_ERROR_MESSAGE = 'Unexpected error while syncing this page'

export default function ItemMasterSyncFromSap({ userCode, onSynced }: ItemMasterSyncFromSapProps) {
  const modal = useDisclosure()
  const [isStarting, setIsStarting] = useState(false)

  const syncState = useAction(getSapSyncStateClient)
  const startAction = useAction(startItemMasterSyncFromSap)
  const pageAction = useAction(syncItemMastersFromSapPage)
  const finishAction = useAction(finishItemMasterSyncFromSap)
  const failAction = useAction(failItemMasterSyncFromSap)

  const { stats, status, run, reset } = useBatchRun()
  const last = useLastBatchResult(SAP_SYNC_KEYS.ITEM_MASTER_FROM_SAP, userCode)

  const loadState = () => syncState.execute({ key: SAP_SYNC_KEYS.ITEM_MASTER_FROM_SAP })

  useEffect(() => {
    loadState()
  }, [])

  const state = syncState.result.data

  //* loaded once, every page gets them as metaData
  const lookups = useItemMasterLookups()
  const metaData = { itemGroups: lookups.data.itemGroups, manufacturers: lookups.data.manufacturers }

  //* the button waits for the sync state and lookups, a failed lookup keeps it off
  const isDependencyLoading = syncState.isExecuting || lookups.isLoading
  const isDependencyReady = lookups.isLoaded && !lookups.data.isError && metaData.itemGroups.length > 0 && metaData.manufacturers.length > 0

  const lastSyncLabel = (() => {
    if (!state) return 'Never synced'
    if (state.lastRunStatus === 'FAILED') return `Last sync failed: ${state.lastRunError ?? 'unknown error'}`
    if (state.lastRunStatus === 'RUNNING') return 'Sync in progress or stopped early'
    if (!state.lastSyncAt) return 'Never synced'

    const by = state.lastRunByName ? ` by ${state.lastRunByName}` : ''
    return `Last synced ${formatDate(new Date(state.lastSyncAt), 'MMM dd, yyyy hh:mm a')}${by}, ${state.lastRunCount ?? 0} items`
  })()

  const handleConfirm = async () => {
    setIsStarting(true)

    try {
      const response = await startAction.executeAsync()
      const started = response?.data

      if (!started || started.error || !started.data) {
        toast.error(started?.message ?? 'Could not start the sync')
        return
      }

      const { since, startedAt, total } = started.data
      setIsStarting(false)

      const result = await run({
        total,
        steps: Math.ceil(total / SAP_SYNC_FROM_PAGE_SIZE),
        stepSize: (index) => Math.min(SAP_SYNC_FROM_PAGE_SIZE, total - index * SAP_SYNC_FROM_PAGE_SIZE),
        runStep: async (index) => {
          const pageResponse = await pageAction.executeAsync({ startedAt, since, skip: index * SAP_SYNC_FROM_PAGE_SIZE, metaData })
          const page = pageResponse?.data

          if (!page || page.error || !page.data) throw new Error(page?.message ?? PAGE_ERROR_MESSAGE)

          return page.data
        },
        //* page- keys mark a failed page, the run then records a failure
        failStep: (index, message) => [{ key: `page-${index}`, label: `Page ${index + 1}`, entries: [{ field: 'Page', message }] }]
      })

      //* a failed page leaves the last sync point alone, so the next run repeats the window
      const pageError = result.errors.find((e) => e.key.startsWith('page-'))

      const closing = pageError
        ? await failAction.executeAsync({ message: pageError.entries[0]?.message ?? PAGE_ERROR_MESSAGE })
        : await finishAction.executeAsync({ startedAt, count: result.succeeded })

      const isClosed = !!closing?.data && !closing.data.error

      if (!isClosed) toast.error(closing?.data?.message ?? 'Could not save the sync result')

      if (result.errors.length > 0) {
        last.save({ finishedAt: new Date().toISOString(), stats: result })
        toast.warning(`${result.succeeded} of ${total} item masters synced from SAP, ${result.errors.length} with errors`)
      } else {
        last.clear()

        //* no success toast when the result wasn't saved
        if (isClosed) toast.success(total === 0 ? 'Item master is already up to date' : `${result.succeeded} item masters synced from SAP`)
      }

      loadState()
      onSynced()
    } catch (err: any) {
      logger.error(err, '[ITEM_MASTER_SYNC_FROM_SAP_ERROR]:')
      toast.error('Something went wrong! Please try again later.')
    } finally {
      setIsStarting(false)
    }
  }

  const handleClose = () => {
    reset()
    modal.onClose()
  }

  const isBusy = isStarting || status === 'processing'

  return (
    <>
      <TooltipWrapper label={isDependencyReady || isDependencyLoading ? 'Sync from SAP' : 'Could not load SAP manufacturers and groups'}>
        <LoadingButton
          type='button'
          variant='outline-primary'
          isLoading={isBusy || isDependencyLoading}
          loadingText={isDependencyLoading ? 'Loading' : 'Syncing'}
          disabled={!isDependencyReady}
          onClick={modal.onOpen}
        >
          <Icons.refreshCw /> Sync from SAP
        </LoadingButton>
      </TooltipWrapper>

      <TooltipWrapper label={lastSyncLabel}>
        <Badge
          variant={state?.lastRunStatus === 'FAILED' ? 'soft-red' : state?.lastSyncAt ? 'soft-green' : 'soft-slate'}
          className='order-first max-w-60 truncate' //* shows ahead of both sync buttons in the header row
        >
          {state?.lastSyncAt
            ? `Synced ${formatDate(new Date(state.lastSyncAt), 'MMM dd, hh:mm a')}`
            : state?.lastRunStatus === 'FAILED'
              ? 'Sync failed'
              : 'Never synced'}
        </Badge>
      </TooltipWrapper>

      <SapSyncModal
        isOpen={modal.isOpen}
        title='Sync from SAP'
        description={lastSyncLabel}
        confirmMessage='This pulls the SAP items that changed since the last sync. Portal-only details stay as they are.'
        confirmLabel='Sync from SAP'
        entityName='items'
        labelTitle='MFG P/N'
        stats={stats}
        status={status}
        lastResult={last.lastResult}
        isStarting={isStarting}
        onConfirm={handleConfirm}
        onClose={handleClose}
        onClearLast={last.clear}
      />
    </>
  )
}
