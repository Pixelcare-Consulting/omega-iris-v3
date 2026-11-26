'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { useAction } from 'next-safe-action/hooks'
import { FormProvider, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import {
  deleteInbound,
  InboundOption,
  InboundProjectOption,
  InboundReferenceOptions,
  InboundWithInclude,
  saveInboundDraft,
  submitInbound
} from '@/actions/inbound'
import { INBOUND_STEP_SCHEMAS, type InboundFormInput as InboundFormValues, inboundFormSchema } from '@/schema/inbound'
import { DEFAULT_INBOUND_STEP, INBOUND_STATUS_CONFIG, INBOUND_STEPS, InboundStep } from '@/constants/inbound'
import Header from '@/components/header'
import ContentWrapper from '@/components/content-wrapper'
import AlertModal from '@/components/alert-modal'
import LoadingButton from '@/components/forms/button-field'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TooltipWrapper } from '@/components/tooltip-wrapper'
import { Icons } from '@/components/icons'
import { logger } from '@/lib/logger'
import { withCurrentOption } from '@/lib/form'
import InboundStepper from './inbound-stepper'
import InboundLocationStep from './inbound-location-step'
import InboundProjectStep from './inbound-project-step'
import InboundPoStep from './inbound-po-step'
import InboundItemsStep from './inbound-items-step'
import InboundReviewStep from './inbound-review-step'
import InboundSubmittedModal from './inbound-submitted-modal'
import { OPEN_SESSION_STATUSES } from '@/constants/session'

const IS_STRICT_STEPS = true

//* how long the form waits after the last change before it saves
const AUTO_SAVE_DELAY_MS = 800

//* one id, so a failing save shows one toast instead of a stack
const AUTO_SAVE_TOAST_ID = 'inbound-auto-save'

type InboundFormProps = {
  inbound: InboundWithInclude
  userCode: number | null
  locationOptions: InboundOption[]
  projectOptions: InboundProjectOption[]
  referenceOptions: InboundReferenceOptions
}

export default function InboundForm({ inbound, userCode, locationOptions, projectOptions, referenceOptions }: InboundFormProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const values = useMemo(
    () => ({
      code: inbound.code,
      locationCode: inbound.locationCode ?? '',
      customerProjectCode: inbound.customerProjectCode ?? '',
      poNum: inbound.poNum ?? '',
      isPartialReceived: inbound.isPartialReceived,
      notes: inbound.notes ?? ''
    }),
    [inbound]
  )

  const form = useForm({
    mode: 'onChange',
    values,
    resetOptions: { keepDirtyValues: true },
    resolver: zodResolver(inboundFormSchema)
  })

  const watchedValues = useWatch({ control: form.control })

  const saveInboundDraftAction = useAction(saveInboundDraft)
  const submitInboundAction = useAction(submitInbound)
  const deleteInboundAction = useAction(deleteInbound)

  const [clearItemCount, setClearItemCount] = useState<number | null>(null)
  const [isSubmitConfirmOpen, setIsSubmitConfirmOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [isJustSubmitted, setIsJustSubmitted] = useState(false)

  //* only active ones are listed, the saved one stays so an old inbound never shows blank
  const locationSelectOptions = useMemo(() => {
    const current = inbound.location ? { ...inbound.location, label: `${inbound.location.code} · ${inbound.location.name}`, value: inbound.location.code } : null // prettier-ignore
    return withCurrentOption(locationOptions, current)
  }, [locationOptions, inbound.location])

  const projectSelectOptions = useMemo(() => {
    const current = inbound.customerProject ? { ...inbound.customerProject, label: `${inbound.customerProject.code} · ${inbound.customerProject.name}`, value: inbound.customerProject.code } : null // prettier-ignore
    return withCurrentOption(projectOptions, current)
  }, [projectOptions, inbound.customerProject])

  const project = useMemo(() => projectSelectOptions.find((row) => row.code === watchedValues.customerProjectCode) ?? null, [projectSelectOptions, watchedValues.customerProjectCode]) // prettier-ignore

  //* the po step drops out once the picked project needs no po
  const steps = useMemo(() => INBOUND_STEPS.filter((step) => step !== 'po' || !project || project.category.isPoRequired), [project])

  //* a step counts as done once its own field is saved
  const completedSteps = useMemo(() => {
    const done: InboundStep[] = []

    if (inbound.locationCode) done.push('location')
    if (inbound.customerProjectCode) done.push('project')
    if (inbound.poNum) done.push('po')
    if (inbound.items.length > 0) done.push('items')

    return done
  }, [inbound])

  const summaries = useMemo<Partial<Record<InboundStep, string>>>(() => {
    const totalStock = inbound.items.reduce((total, item) => total + item.totalStock, 0)

    return {
      location: inbound.location?.code,
      project: inbound.customerProject ? `${inbound.customerProject.code} · ${inbound.customerProject.category.name}` : undefined,
      po: inbound.poNum ? `PO ${inbound.poNum}` : undefined,
      items: `${inbound.items.length} packages · ${totalStock.toLocaleString('en-US')} pcs`
    }
  }, [inbound])

  const requestedStep = searchParams.get('step') as InboundStep | null
  const currentStep = requestedStep && steps.includes(requestedStep) ? requestedStep : DEFAULT_INBOUND_STEP
  const currentIndex = steps.indexOf(currentStep)
  const isLastStep = currentIndex === steps.length - 1

  const isSessionPaused = inbound.session.status === 'PAUSED'
  const isReadOnly = inbound.status !== 'DRAFT' || inbound.session.status !== 'IN_PROGRESS'
  const status = INBOUND_STATUS_CONFIG[inbound.status]

  //* local state opens it at once, the url keeps it after a reload while the session is open
  const isSubmittedOpen =
    isJustSubmitted ||
    (searchParams.get('submitted') === '1' &&
      inbound.status === 'SUBMITTED' &&
      (OPEN_SESSION_STATUSES as readonly string[]).includes(inbound.session.status))

  const goToStep = (step: InboundStep) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('step', step)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  //! history api, not the router, a router.replace right after the submit action can drop
  const setSubmittedParam = (isOpen: boolean) => {
    const params = new URLSearchParams(window.location.search)
    if (isOpen) params.set('submitted', '1')
    else params.delete('submitted')
    window.history.replaceState(null, '', `${pathname}?${params.toString()}`)
    setIsJustSubmitted(isOpen)
  }

  //* true once saved, a po change with packages stops here and asks first
  const handleSave = async (formValues: InboundFormValues, isClearItems = false) => {
    try {
      const response = await saveInboundDraftAction.executeAsync({ ...formValues, isClearItems })
      const result = response?.data

      if (result?.data?.isClearNeeded) {
        setClearItemCount(result.data.itemCount)
        return false
      }

      if (!result || result.error) {
        result?.paths?.forEach((path) => form.setError(path.field as keyof InboundFormValues, { message: path.message }))
        toast.error(result?.message ?? 'Could not save the draft, it will try again on your next change.', { id: AUTO_SAVE_TOAST_ID })
        return false
      }

      //* what just saved is the new clean point, anything typed meanwhile stays dirty
      form.reset(formValues, { keepValues: true, keepDirtyValues: false })
      router.refresh()
      return true
    } catch (err: any) {
      logger.error(err, '[INBOUND_FORM_SAVE_ERROR]:')
      toast.error('Could not save the draft, it will try again on your next change.', { id: AUTO_SAVE_TOAST_ID })
      return false
    }
  }

  //* saves anything still waiting before leaving the step
  const flushSave = async () => (form.formState.isDirty ? handleSave(form.getValues()) : true)

  //* checks only the current step, errors land on that step's fields
  const validateStep = (step: InboundStep, formValues: InboundFormValues) => {
    if (!IS_STRICT_STEPS) return true

    const result = INBOUND_STEP_SCHEMAS[step].safeParse({ ...formValues, itemCount: inbound.items.length })

    if (result.success) return true

    result.error.issues.forEach((issue) => {
      const field = String(issue.path[0])

      //* item count has no field, the step shows it as a toast
      if (field === 'itemCount') toast.error(issue.message)
      else form.setError(field as keyof InboundFormValues, { message: issue.message })
    })

    return false
  }

  //* a locked inbound only pages through, nothing to check or save
  const handleNext = async () => {
    if (!isReadOnly && !validateStep(currentStep, form.getValues())) return
    if (!isReadOnly && !(await flushSave())) return

    const nextStep = steps[currentIndex + 1]
    if (nextStep) goToStep(nextStep)
  }

  const handleBack = () => {
    const previousStep = steps[currentIndex - 1]
    if (previousStep) goToStep(previousStep)
  }

  //* the packages go, then the change saves
  const handleConfirmClear = async () => {
    setClearItemCount(null)
    await handleSave(form.getValues(), true)
  }

  //* back to what is saved, the po or project change is dropped
  const handleCancelClear = () => {
    setClearItemCount(null)
    form.reset(values, { keepDirtyValues: false })
  }

  const handleSubmitInbound = async () => {
    if (!(await flushSave())) {
      setIsSubmitConfirmOpen(false)
      return
    }

    try {
      const response = await submitInboundAction.executeAsync({ inboundCode: inbound.code })
      const result = response?.data

      setIsSubmitConfirmOpen(false)

      if (!result || result.error) {
        toast.error(result?.message ?? 'Something went wrong! Please try again later.')
        result?.paths?.forEach((path) => form.setError(path.field as keyof InboundFormValues, { message: path.message }))
        return
      }

      toast.success(result.message)
      setSubmittedParam(true)
      router.refresh()
    } catch (err: any) {
      logger.error(err, '[INBOUND_FORM_SUBMIT_ERROR]:')
      toast.error('Something went wrong! Please try again later.')
    }
  }

  const handleDeleteInbound = async () => {
    try {
      const response = await deleteInboundAction.executeAsync({ inboundCode: inbound.code })
      const result = response?.data

      setIsDeleteConfirmOpen(false)

      if (!result || result.error) {
        toast.error(result?.message ?? 'Something went wrong! Please try again later.')
        return
      }

      toast.success(result.message)

      //! navigate before refresh, refreshing here 404s on the deleted draft
      router.push(`/sessions/${encodeURIComponent(inbound.session.code)}/view`)
      router.refresh()
    } catch (err: any) {
      logger.error(err, '[INBOUND_FORM_DELETE_ERROR]:')
      toast.error('Something went wrong! Please try again later.')
    }
  }

  //* auto save, a short pause after the last change, held while the clear dialog is open
  useEffect(() => {
    if (isReadOnly || !form.formState.isDirty || clearItemCount !== null) return

    const timer = setTimeout(() => handleSave(form.getValues()), AUTO_SAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [JSON.stringify(watchedValues), form.formState.isDirty, clearItemCount])

  //* the browser warns before a tab closes with a change not saved yet
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (form.formState.isDirty || saveInboundDraftAction.isExecuting) event.preventDefault()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [form.formState.isDirty, saveInboundDraftAction.isExecuting])

  return (
    <FormProvider {...form}>
      <div className='flex h-full w-full flex-1 flex-col gap-5'>
        <Header
          title={`Inbound ${inbound.code}`}
          description={`Session ${inbound.session.code} · ${inbound.session.site.name}`}
          badge={
            <Badge variant='soft-green'>
              <Icons.check />
              <span>Auto Save</span>
            </Badge>
          }
        >
          <div className='ml-auto flex flex-wrap items-center gap-2'>
            <Badge variant={status.variant}>{status.label}</Badge>

            {saveInboundDraftAction.isExecuting && (
              <span className='text-muted-foreground flex items-center gap-1.5 text-xs'>
                <Icons.spinner className='size-3.5 animate-spin' /> Saving
              </span>
            )}

            <span className='text-muted-foreground text-xs'>
              Step {currentIndex + 1} of {steps.length}
            </span>

            {inbound.status === 'DRAFT' && (
              <TooltipWrapper label='Delete Draft'>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  className='text-destructive hover:text-destructive'
                  aria-label='Delete Draft'
                  disabled={isReadOnly}
                  onClick={() => setIsDeleteConfirmOpen(true)}
                >
                  <Icons.trash />
                </Button>
              </TooltipWrapper>
            )}

            <Button type='button' variant='outline' disabled={currentIndex === 0} onClick={handleBack}>
              <Icons.arrowLeft /> Back
            </Button>

            {!isLastStep && (
              <LoadingButton type='button' isLoading={saveInboundDraftAction.isExecuting} loadingText='Saving' onClick={handleNext}>
                Next <Icons.arrowRight />
              </LoadingButton>
            )}

            {isLastStep && (
              <LoadingButton
                type='button'
                isLoading={submitInboundAction.isExecuting}
                loadingText='Submitting'
                disabled={isReadOnly}
                onClick={() => setIsSubmitConfirmOpen(true)}
              >
                <Icons.send /> Submit Inbound
              </LoadingButton>
            )}
          </div>
        </Header>

        <ContentWrapper>
          {/* //! radix wraps the content in a display table that grows with a wide table, block keeps it at the page width */}
          <ScrollArea className='m-1 min-w-0 flex-1' type='auto' viewPortClassName='[&>div]:!block'>
            <div className='flex flex-col gap-4 p-1'>
              {isReadOnly && (
                <div className='flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900'>
                  <Icons.info className='mt-0.5 size-4 shrink-0' />
                  <span>
                    {inbound.status !== 'DRAFT'
                      ? `This inbound is ${status.label.toLowerCase()}. It can no longer change.`
                      : isSessionPaused
                        ? 'Session paused. Resume to keep editing.'
                        : 'The session is closed. This draft can no longer change.'}
                  </span>
                </div>
              )}

              <InboundStepper
                steps={steps}
                currentStep={currentStep}
                completedSteps={completedSteps}
                summaries={summaries}
                isFreeNavigation={!IS_STRICT_STEPS}
                onStepChange={goToStep}
              />

              <fieldset disabled={isReadOnly} className='bg-card min-w-0 rounded-xl border p-4 sm:p-6'>
                {currentStep === 'location' && (
                  <InboundLocationStep siteName={inbound.session.site.name} locationOptions={locationSelectOptions} />
                )}

                {currentStep === 'project' && <InboundProjectStep projectOptions={projectSelectOptions} project={project} />}

                {currentStep === 'po' && <InboundPoStep isReadOnly={isReadOnly} />}

                {currentStep === 'items' && (
                  <InboundItemsStep
                    inbound={inbound}
                    userCode={userCode}
                    category={inbound.customerProject?.category ?? null}
                    referenceOptions={referenceOptions}
                    isReadOnly={isReadOnly}
                  />
                )}

                {currentStep === 'review' && <InboundReviewStep inbound={inbound} isReadOnly={isReadOnly} />}
              </fieldset>
            </div>
          </ScrollArea>
        </ContentWrapper>
      </div>

      <AlertModal
        isOpen={clearItemCount !== null}
        title='Remove the packages?'
        description={`Changing the PO removes the ${clearItemCount ?? 0} package(s) already added, since packages must be checked against the new PO.`}
        onConfirmText='Remove and Change'
        onCancelText='Keep Current PO'
        onConfirm={handleConfirmClear}
        onCancel={handleCancelClear}
      />

      <AlertModal
        isOpen={isSubmitConfirmOpen}
        title={`Submit inbound ${inbound.code}?`}
        description={`Its lines lock and ${inbound.items.length} unique ${inbound.items.length === 1 ? 'ID is' : 'IDs are'} created. You can't undo this.`}
        onConfirmText='Submit'
        onConfirm={handleSubmitInbound}
        onCancel={() => setIsSubmitConfirmOpen(false)}
        isLoading={submitInboundAction.isExecuting || saveInboundDraftAction.isExecuting}
        loadingText='Submitting'
        extendedProps={{ alertDialogActionProps: { variant: 'default' } }}
      />

      <AlertModal
        isOpen={isDeleteConfirmOpen}
        title={`Delete draft ${inbound.code}?`}
        description="The draft and its packages are removed for good. You can't undo this."
        onConfirmText='Delete Draft'
        onCancelText='Keep'
        onConfirm={handleDeleteInbound}
        onCancel={() => setIsDeleteConfirmOpen(false)}
        isLoading={deleteInboundAction.isExecuting}
        loadingText='Deleting'
      />

      <InboundSubmittedModal
        isOpen={isSubmittedOpen}
        inboundCode={inbound.code}
        sessionCode={inbound.session.code}
        packageCount={inbound.items.length}
        isSessionPaused={isSessionPaused}
        onClose={() => setSubmittedParam(false)}
      />
    </FormProvider>
  )
}
