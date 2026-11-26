'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAction } from 'next-safe-action/hooks'

import { createInboundDraft } from '@/actions/inbound'
import { completeSession } from '@/actions/session'
import Modal from '@/components/modal'
import AlertModal from '@/components/alert-modal'
import LoadingButton from '@/components/forms/button-field'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import CanView from '@/components/rbac/can-view'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { logger } from '@/lib/logger'
import InboundUnitsModal from './inbound-units-modal'

type InboundSubmittedModalProps = {
  isOpen: boolean
  inboundCode: string
  sessionCode: string
  packageCount: number
  isSessionPaused: boolean
  onClose: () => void
}

//* after a submit, the next inbound or the end of the session, one unique id per package
export default function InboundSubmittedModal({
  isOpen,
  inboundCode,
  sessionCode,
  packageCount,
  isSessionPaused,
  onClose
}: InboundSubmittedModalProps) {
  const router = useRouter()

  const createInboundDraftAction = useAction(createInboundDraft)
  const completeSessionAction = useAction(completeSession)

  const [isCompleteOpen, setIsCompleteOpen] = useState(false)
  const [isUnitsOpen, setIsUnitsOpen] = useState(false)

  const isBusy = createInboundDraftAction.isExecuting || completeSessionAction.isExecuting

  const handleStartNew = async () => {
    try {
      const response = await createInboundDraftAction.executeAsync({ sessionCode })
      const result = response?.data

      if (!result || result.error) {
        toast.error(result?.message ?? 'Something went wrong! Please try again later.')
        return
      }

      toast.success(result.message)

      //! a full load, in the prod build a push right after the action can drop
      if (result.data?.inboundCode) window.location.assign(`/inbound/${result.data.inboundCode}`)
      else {
        onClose()
        router.refresh()
      }
    } catch (err: any) {
      logger.error(err, '[INBOUND_SUBMITTED_START_NEW_ERROR]:')
      toast.error('Something went wrong! Please try again later.')
    }
  }

  const handleCompleteSession = async () => {
    try {
      const response = await completeSessionAction.executeAsync({ sessionCode })
      const result = response?.data

      setIsCompleteOpen(false)

      if (!result || result.error) {
        toast.error(result?.message ?? 'Something went wrong! Please try again later.')
        return
      }

      toast.success(result.message)
      window.location.assign('/sessions')
    } catch (err: any) {
      logger.error(err, '[INBOUND_SUBMITTED_COMPLETE_ERROR]:')
      toast.error('Something went wrong! Please try again later.')
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      title={`Inbound ${inboundCode} submitted`}
      description={`${packageCount} ${packageCount === 1 ? 'package' : 'packages'} received, ${packageCount} unique ${packageCount === 1 ? 'ID' : 'IDs'} created. ${isSessionPaused ? 'Resume the session to start a new inbound.' : "What's next?"}`}
      isHideCloseButton={isBusy}
      onClose={onClose}
    >
      <div className='flex flex-col gap-2'>
        <div className='flex flex-col gap-2 sm:flex-row'>
          <LoadingButton
            type='button'
            className='flex-1'
            isLoading={createInboundDraftAction.isExecuting}
            loadingText='Starting'
            disabled={isBusy || isSessionPaused}
            onClick={handleStartNew}
          >
            <Icons.plus /> Start New Inbound
          </LoadingButton>

          <LoadingButton
            type='button'
            variant='outline'
            className='flex-1'
            isLoading={completeSessionAction.isExecuting}
            loadingText='Completing'
            disabled={isBusy}
            onClick={() => setIsCompleteOpen(true)}
          >
            <Icons.circleCheck /> Complete Session
          </LoadingButton>
        </div>

        <CanView subject={PERMISSIONS_CODES.PACKAGING_UNITS} action={PERMISSIONS_ALLOWED_ACTIONS.VIEW}>
          <Button type='button' variant='outline' disabled={isBusy || packageCount === 0} onClick={() => setIsUnitsOpen(true)}>
            <Icons.qrCode /> View Unique IDs
          </Button>
        </CanView>
      </div>

      <AlertModal
        isOpen={isCompleteOpen}
        title={`Complete session ${sessionCode}?`}
        description="The timer stops and the session closes. You can't undo this."
        onConfirmText='Complete'
        onCancelText='Keep working'
        onConfirm={handleCompleteSession}
        onCancel={() => setIsCompleteOpen(false)}
        isLoading={completeSessionAction.isExecuting}
        loadingText='Completing'
        extendedProps={{ alertDialogActionProps: { variant: 'default' } }}
      />

      {isUnitsOpen && <InboundUnitsModal isOpen={isUnitsOpen} inboundCode={inboundCode} onClose={() => setIsUnitsOpen(false)} />}
    </Modal>
  )
}
