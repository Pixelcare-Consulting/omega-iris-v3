'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAction } from 'next-safe-action/hooks'
import { FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { cancelSession } from '@/actions/session'
import { type CancelSessionForm, cancelSessionFormSchema } from '@/schema/session'
import Modal from '@/components/modal'
import TextareaField from '@/components/forms/textarea-field'
import LoadingButton from '@/components/forms/button-field'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { logger } from '@/lib/logger'

type CancelSessionModalProps = {
  isOpen: boolean
  sessionCode: string
  draftInboundCodes: string[]
  onClose: () => void
  onSuccess?: () => void
}

const SUBMITTED_NOTE = 'Submitted inbounds are cancelled too, and their unique IDs are deleted.'

//* names the drafts that go with the session
function toDraftNote(codes: string[]) {
  if (codes.length === 0) return `No draft inbounds are open. ${SUBMITTED_NOTE}`
  if (codes.length === 1) return `1 draft inbound, ${codes[0]}, is cancelled with it. ${SUBMITTED_NOTE}`
  return `${codes.length} draft inbounds, ${codes.join(', ')}, are cancelled with it. ${SUBMITTED_NOTE}`
}

export default function CancelSessionModal({ isOpen, sessionCode, draftInboundCodes, onClose, onSuccess }: CancelSessionModalProps) {
  const router = useRouter()

  const form = useForm({
    mode: 'onChange',
    values: { sessionCode, reason: '' },
    resolver: zodResolver(cancelSessionFormSchema)
  })

  const cancelSessionAction = useAction(cancelSession)

  const handleClose = () => {
    if (cancelSessionAction.isExecuting) return

    form.reset()
    onClose()
  }

  const handleSubmit = async (formValues: CancelSessionForm) => {
    try {
      const response = await cancelSessionAction.executeAsync(formValues)
      const result = response?.data

      if (!result || result.error) {
        toast.error(result?.message ?? 'Something went wrong! Please try again later.')
        return
      }

      toast.success(result.message)
      form.reset()
      onClose()
      onSuccess?.()
      router.refresh()
    } catch (err: any) {
      logger.error(err, '[CANCEL_SESSION_MODAL_ERROR]:')
      toast.error('Something went wrong! Please try again later.')
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      title={`Cancel session ${sessionCode}?`}
      description="The session and its records are kept, marked as cancelled. You can't undo this."
      onClose={handleClose}
      footer={
        <>
          <Button type='button' variant='outline' onClick={handleClose} disabled={cancelSessionAction.isExecuting}>
            Keep session
          </Button>
          <LoadingButton
            type='button'
            variant='destructive'
            isLoading={cancelSessionAction.isExecuting}
            loadingText='Cancelling'
            onClick={form.handleSubmit(handleSubmit)}
          >
            Cancel session
          </LoadingButton>
        </>
      }
    >
      <FormProvider {...form}>
        <div className='flex flex-col gap-4'>
          <div className='flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] leading-snug text-amber-900'>
            <Icons.info className='mt-0.5 size-4 shrink-0' />
            <span>{toDraftNote(draftInboundCodes)}</span>
          </div>

          <TextareaField
            control={form.control}
            name='reason'
            label='Reason'
            placeholder='Why is this session being cancelled?'
            isRequired
          />
        </div>
      </FormProvider>
    </Modal>
  )
}
