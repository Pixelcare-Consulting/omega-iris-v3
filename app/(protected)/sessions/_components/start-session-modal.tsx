'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAction } from 'next-safe-action/hooks'
import { FormProvider, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { SessionSiteOption, startSession } from '@/actions/session'
import { type StartSessionForm, startSessionFormSchema } from '@/schema/session'
import { BUILT_SESSION_TYPES, SESSION_TYPE_CONFIG, SESSION_TYPES, SITE_SWITCH_BY_SESSION_TYPE } from '@/constants/session'
import Modal from '@/components/modal'
import AlertModal from '@/components/alert-modal'
import { ComboboxField } from '@/components/forms/combobox-field'
import { renderCodeItem } from '@/components/forms/combobox-item-content'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { logger } from '@/lib/logger'
import SessionTypeCard from './session-type-card'
import type { SessionType } from '@/prisma/generated/enums'

type StartSessionModalProps = {
  isOpen: boolean
  sites: SessionSiteOption[]
  onClose: () => void
}

export default function StartSessionModal({ isOpen, sites, onClose }: StartSessionModalProps) {
  const router = useRouter()

  const [isConfirmOpen, setIsConfirmOpen] = useState(false)

  const defaultValues = useMemo(() => ({ siteCode: '', type: undefined as unknown as SessionType }), [sites])

  const form = useForm({
    mode: 'onChange',
    values: defaultValues,
    resetOptions: { keepDirtyValues: true },
    resolver: zodResolver(startSessionFormSchema)
  })

  const [siteCode, type] = useWatch({ control: form.control, name: ['siteCode', 'type'] })

  const startSessionAction = useAction(startSession)

  const siteOptions = useMemo(() => sites.map((site) => ({ ...site, label: site.name, value: site.code })), [sites])

  const site = useMemo(() => sites.find((row) => row.code === siteCode) ?? null, [sites, siteCode])

  const typeLabel = type ? SESSION_TYPE_CONFIG[type].label : ''
  const article = /^[aeiou]/i.test(typeLabel) ? 'an' : 'a'

  //* only the site's switched on processes can be picked
  const isTypeEnabled = (sessionType: SessionType) => !!site && site[SITE_SWITCH_BY_SESSION_TYPE[sessionType]]

  //* a process not built yet does nothing when clicked
  const handleSelectType = (sessionType: SessionType) => {
    if (!BUILT_SESSION_TYPES.includes(sessionType)) return
    form.setValue('type', sessionType, { shouldValidate: true, shouldDirty: true })
  }

  const handleClose = () => {
    if (startSessionAction.isExecuting) return

    setIsConfirmOpen(false)
    form.reset(defaultValues, { keepDirtyValues: false })
    onClose()
  }

  const handleStart = async (formValues: StartSessionForm) => {
    try {
      const response = await startSessionAction.executeAsync(formValues)
      const result = response?.data

      if (!result || result.error) {
        setIsConfirmOpen(false)
        toast.error(result?.message ?? 'Something went wrong! Please try again later.')
        return
      }

      toast.success(result.message)
      handleClose()

      //! a full load, in the prod build a push right after the action can drop and the bar never shows
      if (result.data?.inboundCode) window.location.assign(`/inbound/${result.data.inboundCode}`)
      else router.refresh()
    } catch (err: any) {
      logger.error(err, '[START_SESSION_MODAL_ERROR]:')
      toast.error('Something went wrong! Please try again later.')
    }
  }

  return (
    <>
      <Modal
        isOpen={isOpen && !isConfirmOpen}
        title='Start a session'
        description='Pick the work you are about to do. Only processes turned on for this site can start.'
        size='lg'
        isModal={false}
        onClose={handleClose}
        footer={
          <>
            <Button type='button' variant='outline' onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type='button'
              disabled={!form.formState.isValid || !type || !isTypeEnabled(type)}
              onClick={() => setIsConfirmOpen(true)}
            >
              Continue <Icons.arrowRight />
            </Button>
          </>
        }
      >
        <FormProvider {...form}>
          <div className='flex flex-col gap-5'>
            <ComboboxField
              control={form.control}
              type='Basic'
              name='siteCode'
              label='Site'
              data={siteOptions}
              searchKeys={['value']}
              renderItem={renderCodeItem}
              isRequired
            />

            <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
              {SESSION_TYPES.map((sessionType) => {
                const isEnabled = isTypeEnabled(sessionType)

                return (
                  <SessionTypeCard
                    key={sessionType}
                    type={sessionType}
                    isSelected={type === sessionType && isEnabled}
                    isDisabled={!isEnabled}
                    //* no tag before a site is picked, every card is off then
                    disabledReason={site && !isEnabled ? 'Off at this site' : undefined}
                    onSelect={handleSelectType}
                  />
                )
              })}
            </div>
          </div>
        </FormProvider>
      </Modal>

      <AlertModal
        isOpen={isOpen && isConfirmOpen}
        title={`Start ${article} ${typeLabel} session?`}
        description={`The timer starts now at ${site?.name ?? 'this site'}. A new ${typeLabel.toLowerCase()} draft is created and you go straight to its form.`}
        onConfirmText='Start session'
        onCancelText='Back'
        onCancel={() => setIsConfirmOpen(false)}
        onConfirm={form.handleSubmit(handleStart)}
        isLoading={startSessionAction.isExecuting}
        loadingText='Starting'
        extendedProps={{ alertDialogActionProps: { variant: 'default' } }}
      />
    </>
  )
}
