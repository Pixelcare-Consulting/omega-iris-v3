'use client'

import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAction } from 'next-safe-action/hooks'
import { FormProvider, useForm, useWatch } from 'react-hook-form'
import { useEffect, useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'

import { ContainerWithRelations, previewContainerCodesClient, upsertContainer } from '@/actions/container'
import { PageMetadata } from '@/types/common'
import { type ContainerForm, containerFormSchema } from '@/schema/container'
import Header from '@/components/header'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { TooltipWrapper } from '@/components/tooltip-wrapper'
import { FieldGroup } from '@/components/ui/field'
import { Row } from '@/components/row'
import { Column } from '@/components/column'
import ReadOnlyFieldHeader from '@/components/read-only-field-header'
import ReadOnlyField from '@/components/read-only-field'
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
import { useActiveLocations, useActivePallets } from '@/hooks/safe-actions/container'
import { STORAGE_UNIT_STATUS_OPTIONS } from '@/constants/storage-unit'
import { CONTAINER_TYPE_OPTIONS } from '@/constants/container'
import { formatContainerCode, getContainerPrefixParts } from '@/lib/container'
import { LOCATION_SEARCH_KEYS, renderLocationItem, toLocationOptions } from './location-item'

type ContainerFormProps = { pageMetaData: PageMetadata; container: ContainerWithRelations | null }

const DEFAULT_VALUES = {
  id: null,
  code: '',
  locationCode: '',
  palletCode: '',
  type: '',
  status: 'ACTIVE',
  isGeneralPurpose: false,
  projectCategoryCode: '',
  customerProjectCode: ''
} as const

//* pallets have no name, so the code is the label
const toPalletOption = (pallet: { code: string }) => toFormOption(pallet, (row) => row.code)

export default function ContainerForm({ pageMetaData, container }: ContainerFormProps) {
  const router = useRouter()

  const { code } = useParams() as { code: string }

  const isCreate = code === 'add' || !container

  const values = useMemo(() => {
    if (container) {
      const { id, code, locationCode, palletCode, type, status, isGeneralPurpose, projectCategoryCode, customerProjectCode } = container
      return {
        id,
        code,
        locationCode,
        palletCode: palletCode ?? '',
        type,
        status,
        isGeneralPurpose,
        projectCategoryCode: projectCategoryCode ?? '',
        customerProjectCode: customerProjectCode ?? ''
      }
    }

    if (isCreate) return { ...DEFAULT_VALUES }
  }, [isCreate, container])

  const form = useForm({
    mode: 'onChange',
    values,
    resetOptions: { keepDirtyValues: true },
    resolver: zodResolver(containerFormSchema)
  })

  const [isGeneralPurpose, projectCategoryCode, customerProjectCode, locationCode] = useWatch({
    control: form.control,
    name: ['isGeneralPurpose', 'projectCategoryCode', 'customerProjectCode', 'locationCode']
  })

  const locations = useActiveLocations()
  const pallets = useActivePallets()
  const projectCategories = useProjectCategories()
  const customerProjects = useCustomerProjects()
  const upsertContainerAction = useAction(upsertContainer)
  const previewCodesAction = useAction(previewContainerCodesClient)
  const { intent, setIntent, consumeIntent } = useSubmitIntent()

  const categoryOptions = useMemo(() => {
    const current = container?.projectCategory ? toFormOption(container.projectCategory) : null
    return withCurrentOption(toFormOptions(projectCategories.data), current)
  }, [projectCategories.data, container])

  //* only the picked category's projects
  const projectOptions = useMemo(() => {
    const current = container?.customerProject ? toFormOption(container.customerProject) : null
    const options = toFormOptions(customerProjects.data.filter((project) => project.categoryCode === projectCategoryCode))
    return withCurrentOption(options, current)
  }, [customerProjects.data, projectCategoryCode, container])

  //* every active location, pallet allowed or not
  const locationOptions = useMemo(() => {
    const current = container?.location ? toFormOption(container.location) : null
    return toLocationOptions(withCurrentOption(toFormOptions(locations.data), current))
  }, [locations.data, container])

  //! pallets at the picked location that match the project, general purpose only sees general purpose pallets
  const palletOptions = useMemo(() => {
    const current = container?.pallet ? toPalletOption(container.pallet) : null
    const matching = pallets.data
      .filter((pallet) => pallet.locationCode === locationCode)
      .filter((pallet) =>
        isGeneralPurpose
          ? pallet.isGeneralPurpose
          : pallet.projectCategoryCode === projectCategoryCode && pallet.customerProjectCode === customerProjectCode
      )
    return withCurrentOption(matching.map(toPalletOption), current)
  }, [pallets.data, locationCode, isGeneralPurpose, projectCategoryCode, customerProjectCode, container])

  const isPalletAllowed = useMemo(
    () => !!locationOptions.find((option) => option.value === locationCode)?.isPalletAllowed,
    [locationOptions, locationCode]
  )

  //* why the pallet picker is off, or what it lists
  const palletNote = useMemo(() => {
    if (!locationCode) return 'Pick a location first'
    if (!isPalletAllowed) return "This location doesn't allow pallets"
    if (!isGeneralPurpose && !customerProjectCode) return 'Pick a customer project first'
    if (isGeneralPurpose) return 'Optional, general purpose pallets at this location'
    return "Optional, this project's pallets at this location"
  }, [locationCode, isPalletAllowed, isGeneralPurpose, customerProjectCode])

  const isPalletDisabled = !isCreate || !locationCode || !isPalletAllowed || (!isGeneralPurpose && !customerProjectCode)

  const handleSubmit = async (formValues: ContainerForm) => {
    const submitIntent = consumeIntent()

    try {
      const response = await upsertContainerAction.executeAsync(formValues)
      const result = response?.data

      if (result?.error) {
        toast.error(result.message)
        return
      }

      toast.success(result?.message)

      if (result?.data?.container) {
        router.refresh()

        if (submitIntent === 'save-new') {
          if (isCreate) form.reset(DEFAULT_VALUES, { keepDirtyValues: false })
          else router.push('/containers/add')

          return
        }

        await delay(1500)

        if (isCreate) router.push('/containers')
        else router.push(`/containers/${encodeURIComponent(result.data.container.code)}`)
      }
    } catch (err: any) {
      logger.error(err, '[CONTAINER_FORM_HANDLE_SUBMIT_ERROR]:')
      toast.error('Something went wrong! Please try again later.')
    }
  }

  //! a picked pallet may not fit the new location or project, so it is cleared
  const handleClearPallet = () => form.setValue('palletCode', '', { shouldValidate: true })

  //* estimated only, the server assigns the real number on save
  useEffect(() => {
    if (!isCreate) return

    const project = { isGeneralPurpose, projectCategoryCode, customerProjectCode }

    if (!isGeneralPurpose && (!projectCategoryCode || !customerProjectCode)) {
      form.setValue('code', '')
      return
    }

    previewCodesAction.executeAsync({ prefixes: [getContainerPrefixParts(project)] }).then((response) => {
      const preview = response?.data?.[0]
      form.setValue('code', preview ? formatContainerCode(preview.scope, preview.value) : '')
    })
  }, [isCreate, isGeneralPurpose, projectCategoryCode, customerProjectCode])

  return (
    <FormProvider {...form}>
      <form className='flex h-full w-full flex-1 flex-col gap-5' onSubmit={form.handleSubmit(handleSubmit)}>
        <Header title={pageMetaData.title} description={pageMetaData.description}>
          <div className='ml-auto flex items-center gap-2'>
            <TooltipWrapper label='Back'>
              <Button type='button' variant='outline' onClick={() => router.push('/containers')}>
                <Icons.arrowLeft /> Back
              </Button>
            </TooltipWrapper>

            <CanView subject={PERMISSIONS_CODES.CONTAINERS} action={PERMISSIONS_ALLOWED_ACTIONS.CREATE}>
              <TooltipWrapper label='Save & New'>
                {/* //* not a submit button, it would become the form's default and take over the enter key */}
                <LoadingButton
                  type='button'
                  variant='outline-primary'
                  isLoading={upsertContainerAction.isExecuting && intent === 'save-new'}
                  disabled={upsertContainerAction.isExecuting}
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
                isLoading={upsertContainerAction.isExecuting && intent === 'save'}
                disabled={upsertContainerAction.isExecuting}
                onClick={() => setIntent('save')}
              >
                <Icons.save /> Save
              </LoadingButton>
            </TooltipWrapper>

            {container && (
              <DropdownMenu>
                <TooltipWrapper label='More Options'>
                  <DropdownMenuTrigger asChild>
                    <Button variant='ghost' size='icon-lg'>
                      <Icons.ellipsisVertical />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipWrapper>

                <DropdownMenuContent className='w-auto min-w-20' align='end'>
                  <CanView subject={PERMISSIONS_CODES.CONTAINERS} action={PERMISSIONS_ALLOWED_ACTIONS.CREATE}>
                    <DropdownMenuItem onClick={() => router.push('/containers/add')}>
                      <Icons.plus /> Add
                    </DropdownMenuItem>
                  </CanView>

                  <CanView subject={PERMISSIONS_CODES.CONTAINERS} action={PERMISSIONS_ALLOWED_ACTIONS.VIEW}>
                    <DropdownMenuItem onClick={() => router.push(`/containers/${encodeURIComponent(container.code)}/view`)}>
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
                  <ReadOnlyFieldHeader title='Details' description='Enter the details of the container' />
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
                    description={isCreate ? 'New containers start as Active' : undefined}
                    isRequired
                    extendedProps={{ comboboxInputProps: { disabled: isCreate } }}
                  />
                </Column>

                <Column md={6} lg={3}>
                  <ComboboxField
                    control={form.control}
                    type='Basic'
                    name='type'
                    label='Type'
                    data={CONTAINER_TYPE_OPTIONS}
                    isRequired
                    extendedProps={{ comboboxInputProps: { disabled: !isCreate } }}
                  />
                </Column>

                <Column>
                  <Separator className='mt-3 mb-4' />
                  <ReadOnlyFieldHeader
                    title='Location'
                    description={isCreate ? 'Where the container starts' : 'Can only change by moving the container'}
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
                    searchKeys={LOCATION_SEARCH_KEYS}
                    renderItem={renderLocationItem}
                    description={isCreate ? 'Any active location, a container can sit without a pallet' : undefined}
                    isRequired
                    //* a new location clears the pallet
                    callback={handleClearPallet}
                    extendedProps={{ comboboxInputProps: { disabled: !isCreate } }}
                  />
                </Column>

                {locationCode && (
                  <Column md={6} lg={3}>
                    <ReadOnlyField title='Pallet Allowed' value={isPalletAllowed ? 'Yes' : 'No'} description='From the picked location' />
                  </Column>
                )}

                <Column>
                  <Separator className='mt-3 mb-4' />
                  <ReadOnlyFieldHeader title='Project' description='Who the container is for, cannot be changed later' />
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
                      //* either way the pallet list changes
                      handleClearPallet()
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
                        //* a new category clears the project and the pallet
                        callback={() => {
                          form.setValue('customerProjectCode', '')
                          handleClearPallet()
                        }}
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
                        //* a new project clears the pallet
                        callback={handleClearPallet}
                        extendedProps={{ comboboxInputProps: { disabled: !isCreate || !projectCategoryCode } }}
                      />
                    </Column>
                  </>
                )}

                <Column>
                  <Separator className='mt-3 mb-4' />
                  <ReadOnlyFieldHeader
                    title='Pallet'
                    description={isCreate ? 'Optional, the pallet the container sits on' : 'Can only change by moving the container'}
                  />
                </Column>

                <Column md={6} lg={4}>
                  <ComboboxField
                    control={form.control}
                    type='Basic'
                    name='palletCode'
                    label='Pallet'
                    data={palletOptions}
                    isLoading={pallets.isLoading}
                    description={isCreate ? palletNote : undefined}
                    extendedProps={{ comboboxInputProps: { disabled: isPalletDisabled } }}
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
