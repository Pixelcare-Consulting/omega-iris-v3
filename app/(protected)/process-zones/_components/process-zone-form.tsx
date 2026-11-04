'use client'

import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAction } from 'next-safe-action/hooks'
import { FormProvider, useForm } from 'react-hook-form'
import { useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'

import { getProcessZoneByCode, upsertProcessZone } from '@/actions/process-zone'
import { PageMetadata } from '@/types/common'
import { type ProcessZoneForm, processZoneFormSchema } from '@/schema/process-zone'
import Header from '@/components/header'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { TooltipWrapper } from '@/components/tooltip-wrapper'
import { FieldGroup } from '@/components/ui/field'
import { Row } from '@/components/row'
import { Column } from '@/components/column'
import ReadOnlyFieldHeader from '@/components/read-only-field-header'
import InputField from '@/components/forms/input-field'
import TextareaField from '@/components/forms/textarea-field'
import ContentWrapper from '@/components/content-wrapper'
import LoadingButton from '@/components/forms/button-field'
import { useSubmitIntent } from '@/hooks/use-submit-intent'
import SwitchField from '@/components/forms/switch-field'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { delay } from '@/lib/utils'
import { logger } from '@/lib/logger'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import CanView from '@/components/rbac/can-view'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'

type ProcessZoneFormProps = { pageMetaData: PageMetadata; processZone: Awaited<ReturnType<typeof getProcessZoneByCode>> }

export default function ProcessZoneForm({ pageMetaData, processZone }: ProcessZoneFormProps) {
  const router = useRouter()

  const { code } = useParams() as { code: string }

  const isCreate = code === 'add' || !processZone

  const defaultValues = useMemo(() => ({ id: null, code: '', name: '', description: '', isPalletEligible: false, isActive: true }), [])

  const values = useMemo(() => {
    if (processZone) {
      const { id, code, name, description, isPalletEligible, isActive } = processZone
      return { id, code, name, description: description ?? '', isPalletEligible, isActive }
    }

    if (isCreate) return defaultValues
  }, [isCreate, processZone, defaultValues])

  const form = useForm({
    mode: 'onChange',
    values,
    resetOptions: { keepDirtyValues: true },
    resolver: zodResolver(processZoneFormSchema)
  })

  const upsertProcessZoneAction = useAction(upsertProcessZone)

  const { intent, setIntent, consumeIntent } = useSubmitIntent()

  const handleSubmit = async (formValues: ProcessZoneForm) => {
    const submitIntent = consumeIntent()

    try {
      const response = await upsertProcessZoneAction.executeAsync(formValues)
      const result = response?.data

      if (result?.error) {
        if (result.status === 401 && result.paths && result.paths.length > 0) {
          result.paths.forEach((path) => {
            const field = path.field as keyof ProcessZoneForm
            form.setError(field, { type: 'custom', message: path.message })
          })
        }

        toast.error(result.message)
        return
      }

      toast.success(result?.message)

      if (result?.data?.processZone) {
        router.refresh()

        //* save and new stays on a blank form, editing hands off to the add page
        if (submitIntent === 'save-new') {
          if (isCreate) form.reset(defaultValues, { keepDirtyValues: false })
          else router.push('/process-zones/add')

          return
        }

        await delay(1500)

        if (isCreate) router.push('/process-zones')
        else router.push(`/process-zones/${result.data.processZone.code}`)
      }
    } catch (err: any) {
      logger.error(err, '[PROCESS_ZONE_FORM_HANDLE_SUBMIT_ERROR]:')
      toast.error('Something went wrong! Please try again later.')
    }
  }

  return (
    <FormProvider {...form}>
      <form className='flex h-full w-full flex-1 flex-col gap-5' onSubmit={form.handleSubmit(handleSubmit)}>
        <Header title={pageMetaData.title} description={pageMetaData.description}>
          <div className='ml-auto flex items-center gap-2'>
            <TooltipWrapper label='Back'>
              <Button type='button' variant='outline' onClick={() => router.push('/process-zones')}>
                <Icons.arrowLeft /> Back
              </Button>
            </TooltipWrapper>

            <CanView subject={PERMISSIONS_CODES.PROCESS_ZONES} action={PERMISSIONS_ALLOWED_ACTIONS.CREATE}>
              <TooltipWrapper label='Save & New'>
                {/* //* not a submit button, it would become the form's default and take over the enter key */}
                <LoadingButton
                  type='button'
                  variant='outline-primary'
                  isLoading={upsertProcessZoneAction.isExecuting && intent === 'save-new'}
                  disabled={upsertProcessZoneAction.isExecuting}
                  onClick={() => {
                    setIntent('save-new')
                    form.handleSubmit(handleSubmit)()
                  }}
                >
                  <Icons.plus /> Save & New
                </LoadingButton>
              </TooltipWrapper>
            </CanView>

            <TooltipWrapper label='Save'>
              <LoadingButton
                type='submit'
                variant='default'
                isLoading={upsertProcessZoneAction.isExecuting && intent === 'save'}
                disabled={upsertProcessZoneAction.isExecuting}
                onClick={() => setIntent('save')}
              >
                <Icons.save /> Save
              </LoadingButton>
            </TooltipWrapper>

            {processZone && (
              <DropdownMenu>
                <TooltipWrapper label='More Options'>
                  <DropdownMenuTrigger asChild>
                    <Button variant='ghost' size='icon-lg'>
                      <Icons.ellipsisVertical />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipWrapper>

                <DropdownMenuContent className='w-auto min-w-20' align='end'>
                  <CanView subject={PERMISSIONS_CODES.PROCESS_ZONES} action={PERMISSIONS_ALLOWED_ACTIONS.CREATE}>
                    <DropdownMenuItem onClick={() => router.push('/process-zones/add')}>
                      <Icons.plus /> Add
                    </DropdownMenuItem>
                  </CanView>

                  <CanView subject={PERMISSIONS_CODES.PROCESS_ZONES} action={PERMISSIONS_ALLOWED_ACTIONS.VIEW}>
                    <DropdownMenuItem onClick={() => router.push(`/process-zones/${processZone.code}/view`)}>
                      <Icons.eye /> View
                    </DropdownMenuItem>
                  </CanView>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </Header>

        <ContentWrapper>
          <ScrollArea className='m-1 flex-1' type='auto'>
            <FieldGroup className='p-4'>
              <Row gap={5}>
                <Column>
                  <ReadOnlyFieldHeader title='Details' description='Enter the details of the process zone' />
                  <Separator className='mt-4' />
                </Column>

                <Column md={6} lg={3}>
                  <InputField
                    control={form.control}
                    name='code'
                    label='Code'
                    description={isCreate ? 'At least 2 letters, numbers or dashes, cannot be changed later' : 'Code cannot be changed'}
                    isRequired
                    transform={(value) => value.toUpperCase()}
                    extendedProps={{ inputProps: { disabled: !isCreate } }}
                  />
                </Column>

                <Column md={6} lg={3}>
                  <InputField control={form.control} name='name' label='Name' description='Name must be unique' isRequired />
                </Column>

                <Column>
                  <TextareaField control={form.control} name='description' label='Description' />
                </Column>

                <Column>
                  <Separator className='mt-3 mb-4' />
                  <ReadOnlyFieldHeader title='Settings' description="Configure the process zone's setting" />
                </Column>

                <Column md={6} lg={3}>
                  <SwitchField
                    control={form.control}
                    name='isActive'
                    label='Active'
                    layout='choice-card'
                    description='Is this process zone active?'
                    extendedProps={{ switchProps: { disabled: isCreate } }}
                  />
                </Column>

                <Column md={6} lg={3}>
                  <SwitchField
                    control={form.control}
                    name='isPalletEligible'
                    label='Pallet Eligible'
                    layout='choice-card'
                    description='Can pallets be placed in this process zone?'
                  />
                </Column>
              </Row>
            </FieldGroup>
          </ScrollArea>
        </ContentWrapper>
      </form>
    </FormProvider>
  )
}
