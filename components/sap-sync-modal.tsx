'use client'

import { useState } from 'react'

import Modal from '@/components/modal'
import LoadingButton from '@/components/forms/button-field'
import BatchProgress from '@/components/batch-progress'
import BatchResult from '@/components/batch-result'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { BatchStats, BatchStatus, LastBatchResult } from '@/types/batch'

type SapSyncModalProps = {
  isOpen: boolean
  title: string
  description: string
  confirmMessage: string
  confirmLabel: string
  entityName: string
  labelTitle: string
  stats: BatchStats
  status: BatchStatus
  lastResult: LastBatchResult | null
  isStarting?: boolean
  onConfirm: () => void
  onClose: () => void
  onClearLast: () => void
}

//* confirm, then progress, then result, a saved result with errors shows first when there is one
export default function SapSyncModal({
  isOpen,
  title,
  description,
  confirmMessage,
  confirmLabel,
  entityName,
  labelTitle,
  stats,
  status,
  lastResult,
  isStarting,
  onConfirm,
  onClose,
  onClearLast
}: SapSyncModalProps) {
  const [isHideLast, setIsHideLast] = useState(false)

  const isProcessing = status === 'processing' || !!isStarting
  const savedResult = isHideLast ? null : lastResult

  const handleClose = () => {
    if (isProcessing) return

    setIsHideLast(false)
    onClose()
  }

  const handleConfirm = () => {
    setIsHideLast(true)
    onConfirm()
  }

  return (
    <Modal
      isOpen={isOpen}
      title={title}
      description={description}
      size='xl'
      isHideCloseButton={isProcessing}
      isCloseOnOutsideClick={!isProcessing}
      isCloseOnEscape={!isProcessing}
      onClose={handleClose}
    >
      <div className='flex min-w-0 flex-col gap-4'>
        {status === 'idle' && !isStarting && savedResult && (
          <BatchResult
            stats={savedResult.stats}
            entityName={entityName}
            verb='synced'
            labelTitle={labelTitle}
            finishedAt={savedResult.finishedAt}
            actions={
              <>
                <Button type='button' variant='outline' size='sm' onClick={onClearLast}>
                  <Icons.trash /> Clear
                </Button>
                <Button type='button' size='sm' onClick={() => setIsHideLast(true)}>
                  <Icons.refresh /> Sync again
                </Button>
              </>
            }
          />
        )}

        {status === 'idle' && !isStarting && !savedResult && (
          <>
            <p className='text-sm'>{confirmMessage}</p>

            <div className='flex justify-end gap-2'>
              <Button type='button' variant='outline' onClick={handleClose}>
                Cancel
              </Button>
              <LoadingButton type='button' onClick={handleConfirm}>
                <Icons.refresh /> {confirmLabel}
              </LoadingButton>
            </div>
          </>
        )}

        {isProcessing && <BatchProgress stats={stats} succeededLabel='Synced' />}

        {status === 'completed' && (
          <BatchResult
            stats={stats}
            entityName={entityName}
            verb='synced'
            labelTitle={labelTitle}
            actions={
              <Button type='button' size='sm' onClick={handleClose}>
                Close
              </Button>
            }
          />
        )}
      </div>
    </Modal>
  )
}
