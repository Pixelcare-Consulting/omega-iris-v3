'use client'

import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAction } from 'next-safe-action/hooks'
import { FormProvider, useForm, useWatch } from 'react-hook-form'
import { useEffect, useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'

import { PalletWithRelations, previewPalletCodesClient, upsertPallet } from '@/actions/pallet'
import { PageMetadata } from '@/types/common'
import { type PalletForm, palletFormSchema } from '@/schema/pallet'
import Header from '@/components/header'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { TooltipWrapper } from '@/components/tooltip-wrapper'
import { FieldGroup } from '@/components/ui/field'
import { Row } from '@/components/row'
import { Column } from '@/components/column'
import ReadOnlyFieldHeader from '@/components/read-only-field-header'
import InputField from '@/components/forms/input-field'
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
import { ComboboxField } from '@/components/forms/combobox-field'
import { renderCodeItem } from '@/components/forms/combobox-item-content'
import { toFormOption, toFormOptions, withCurrentOption } from '@/lib/form'
import { useProjectCategories } from '@/hooks/safe-actions/project-category'
import { useCustomerProjects } from '@/hooks/safe-actions/customer-project'
import { usePalletLocations } from '@/hooks/safe-actions/pallet'
import { STORAGE_UNIT_STATUS_OPTIONS } from '@/constants/storage-unit'
import { getPalletPrefixParts, formatPalletCode } from '@/lib/pallet'

type PalletFormProps = { pageMetaData: PageMetadata; pallet: PalletWithRelations | null }

const DEFAULT_VALUES = {
  id: null,
  code: '',
  locationCode: '',
  status: 'ACTIVE',
  isGeneralPurpose: false,
  projectCategoryCode: '',
  customerProjectCode: ''
} as const

export default function PalletForm({ pageMetaData, pallet }: PalletFormProps) {
  const router = useRouter()

  const { code } = useParams() as { code: string }

  const isCreate = code === 'add' || !pallet

  const values = useMemo(() => {
    if (pallet) {
      const { id, code, locationCode, status, isGeneralPurpose, projectCategoryCode, customerProjectCode } = pallet
      return {
        id,
        code,
        locationCode,
        status,
        isGeneralPurpose,
        projectCategoryCode: projectCategoryCode ?? '',
        customerProjectCode: customerProjectCode ?? ''
      }
    }

    if (isCreate) return { ...DEFAULT_VALUES }
  }, [isCreate, pallet])

  const form = useForm({
    mode: 'onChange',
    values,
    resetOptions: { keepDirtyValues: true },
    resolver: zodResolver(palletFormSchema)
  })

  const [isGeneralPurpose, projectCategoryCode, customerProjectCode] = useWatch({
    control: form.control,
    name: ['isGeneralPurpose', 'projectCategoryCode', 'customerProjectCode']
  })

  const locations = usePalletLocations()
  const projectCategories = useProjectCategories()
  const customerProjects = useCustomerProjects()
  const upsertPalletAction = useAction(upsertPallet)
  const { intent, setIntent, consumeIntent } = useSubmitIntent()
  const previewCodesAction = useAction(previewPalletCodesClient)

  //* pickers list usable rows only, an old record keeps its own
  const locationOptions = useMemo(() => {
    const current = pallet?.location ? toFormOption(pallet.location) : null
    return withCurrentOption(toFormOptions(locations.data), current)
  }, [locations.data, pallet])

  const categoryOptions = useMemo(() => {
    const current = pallet?.projectCategory ? toFormOption(pallet.projectCategory) : null
    return withCurrentOption(toFormOptions(projectCategories.data), current)
  }, [projectCategories.data, pallet])

  //* only the picked category's projects
  const projectOptions = useMemo(() => {
    const current = pallet?.customerProject ? toFormOption(pallet.customerProject) : null
    const options = toFormOptions(customerProjects.data.filter((project) => project.categoryCode === projectCategoryCode))
    return withCurrentOption(options, current)
  }, [customerProjects.data, projectCategoryCode, pallet])

  const handleSubmit = async (formValues: PalletForm) => {
    const submitIntent = consumeIntent()

    try {
      const response = await upsertPalletAction.executeAsync(formValues)
      const result = response?.data

      if (result?.error) {
        toast.error(result.message)
        return
      }

      toast.success(result?.message)

      if (result?.data?.pallet) {
        router.refresh()

        if (submitIntent === 'save-new') {
          if (isCreate) form.reset(DEFAULT_VALUES, { keepDirtyValues: false })
          else router.push('/pallets/add')

          return
        }

        await delay(1500)

        if (isCreate) router.push('/pallets')
        else router.push(`/pallets/${encodeURIComponent(result.data.pallet.code)}`)
      }
    } catch (err: any) {
      logger.error(err, '[PALLET_FORM_HANDLE_SUBMIT_ERROR]:')
      toast.error('Something went wrong! Please try again later.')
    }
  }

  //* estimated only, the server assigns the real number on save
  useEffect(() => {
    if (!isCreate) return

    const project = { isGeneralPurpose, projectCategoryCode, customerProjectCode }

    if (!isGeneralPurpose && (!projectCategoryCode || !customerProjectCode)) {
      form.setValue('code', '')
      return
    }

    previewCodesAction.executeAsync({ prefixes: [getPalletPrefixParts(project)] }).then((response) => {
      const preview = response?.data?.[0]
      form.setValue('code', preview ? formatPalletCode(preview.scope, preview.value) : '')
    })
  }, [isCreate, isGeneralPurpose, projectCategoryCode, customerProjectCode])

  return (
    <FormProvider {...form}>
      <form className='flex h-full w-full flex-1 flex-col gap-5' onSubmit={form.handleSubmit(handleSubmit)}>
        <Header title={pageMetaData.title} description={pageMetaData.description}>
          <div className='ml-auto flex items-center gap-2'>
            <TooltipWrapper label='Back'>
              <Button type='button' variant='outline' onClick={() => router.push('/pallets')}>
                <Icons.arrowLeft /> Back
              </Button>
            </TooltipWrapper>

            <CanView subject={PERMISSIONS_CODES.PALLETS} action={PERMISSIONS_ALLOWED_ACTIONS.CREATE}>
              <TooltipWrapper label='Save & New'>
                {/* //* not a submit button, it would become the form's default and take over the enter key */}
                <LoadingButton
                  type='button'
                  variant='outline-primary'
                  isLoading={upsertPalletAction.isExecuting && intent === 'save-new'}
                  disabled={upsertPalletAction.isExecuting}
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
                isLoading={upsertPalletAction.isExecuting && intent === 'save'}
                disabled={upsertPalletAction.isExecuting}
                onClick={() => setIntent('save')}
              >
                <Icons.save /> Save
              </LoadingButton>
            </TooltipWrapper>

            {pallet && (
              <DropdownMenu>
                <TooltipWrapper label='More Options'>
                  <DropdownMenuTrigger asChild>
                    <Button variant='ghost' size='icon-lg'>
                      <Icons.ellipsisVertical />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipWrapper>

                <DropdownMenuContent className='w-auto min-w-20' align='end'>
                  <CanView subject={PERMISSIONS_CODES.PALLETS} action={PERMISSIONS_ALLOWED_ACTIONS.CREATE}>
                    <DropdownMenuItem onClick={() => router.push('/pallets/add')}>
                      <Icons.plus /> Add
                    </DropdownMenuItem>
                  </CanView>

                  <CanView subject={PERMISSIONS_CODES.PALLETS} action={PERMISSIONS_ALLOWED_ACTIONS.VIEW}>
                    <DropdownMenuItem onClick={() => router.push(`/pallets/${encodeURIComponent(pallet.code)}/view`)}>
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
                  <ReadOnlyFieldHeader title='Details' description='Enter the details of the pallet' />
                  <Separator className='mt-4' />
                </Column>

                <Column md={6} lg={3}>
                  <InputField
                    control={form.control}
                    name='code'
                    label='Code'
                    description={isCreate ? 'A preview, the final code is given when you save' : 'Code cannot be changed'}
                    extendedProps={{ inputProps: { disabled: true } }}
                  />
                </Column>

                <Column md={6} lg={3}>
                  <ComboboxField
                    control={form.control}
                    type='Basic'
                    name='status'
                    label='Status'
                    data={STORAGE_UNIT_STATUS_OPTIONS}
                    description={isCreate ? 'New pallets start as Active' : undefined}
                    isRequired
                    extendedProps={{ comboboxInputProps: { disabled: isCreate } }}
                  />
                </Column>

                <Column>
                  <Separator className='mt-3 mb-4' />
                  <ReadOnlyFieldHeader
                    title='Location'
                    description={isCreate ? 'Where the pallet starts' : 'Can only change by moving the pallet'}
                  />
                </Column>

                <Column md={6} lg={4}>
                  <ComboboxField
                    control={form.control}
                    type='Basic'
                    name='locationCode'
                    label='Location'
                    data={locationOptions}
                    isLoading={locations.isLoading}
                    searchKeys={['value']}
                    renderItem={renderCodeItem}
                    description={isCreate ? 'Only locations that allow pallets' : undefined}
                    isRequired
                    extendedProps={{ comboboxInputProps: { disabled: !isCreate } }}
                  />
                </Column>

                <Column>
                  <Separator className='mt-3 mb-4' />
                  <ReadOnlyFieldHeader title='Project' description='Who the pallet is for, cannot be changed later' />
                </Column>

                <Column md={6} lg={3}>
                  <SwitchField
                    control={form.control}
                    name='isGeneralPurpose'
                    label='General Purpose'
                    layout='choice-card'
                    description='Not tied to a customer project'
                    extendedProps={{ switchProps: { disabled: !isCreate } }}
                    callback={({ value }: { value: boolean }) => {
                      if (!value) return
                      form.setValue('projectCategoryCode', '', { shouldValidate: true })
                      form.setValue('customerProjectCode', '', { shouldValidate: true })
                    }}
                  />
                </Column>

                {!isGeneralPurpose && (
                  <>
                    <Column md={6} lg={4}>
                      <ComboboxField
                        control={form.control}
                        type='Basic'
                        name='projectCategoryCode'
                        label='Project Category'
                        data={categoryOptions}
                        isLoading={projectCategories.isLoading}
                        searchKeys={['value']}
                        renderItem={renderCodeItem}
                        isRequired
                        //* a new category clears the project
                        callback={() => form.setValue('customerProjectCode', '')}
                        extendedProps={{ comboboxInputProps: { disabled: !isCreate } }}
                      />
                    </Column>

                    <Column md={6} lg={5}>
                      <ComboboxField
                        control={form.control}
                        type='Basic'
                        name='customerProjectCode'
                        label='Customer Project'
                        data={projectOptions}
                        isLoading={customerProjects.isLoading}
                        searchKeys={['value']}
                        renderItem={renderCodeItem}
                        isRequired
                        description={projectCategoryCode ? undefined : 'Pick a project category first'}
                        extendedProps={{ comboboxInputProps: { disabled: !isCreate || !projectCategoryCode } }}
                      />
                    </Column>
                  </>
                )}
              </Row>
            </FieldGroup>
          </ScrollArea>
        </ContentWrapper>
      </form>
    </FormProvider>
  )
}
