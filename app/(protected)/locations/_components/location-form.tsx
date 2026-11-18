'use client'

import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAction } from 'next-safe-action/hooks'
import { FormProvider, useForm, useWatch } from 'react-hook-form'
import { useEffect, useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'

import { LocationWithRelations, upsertLocation } from '@/actions/location'
import { PageMetadata } from '@/types/common'
import { type LocationForm, locationFormSchema } from '@/schema/location'
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
import { useSites } from '@/hooks/safe-actions/site'
import { useProcessZones } from '@/hooks/safe-actions/process-zone'
import { LOCATION_BAY_OPTIONS, LOCATION_LEVEL_OPTIONS, LOCATION_RACK_OPTIONS, LOCATION_TYPE_OPTIONS } from '@/constants/location'
import { buildLocationCode } from '@/lib/location'

type LocationFormProps = { pageMetaData: PageMetadata; location: LocationWithRelations | null }

const toValueOptions = (values: string[]) => values.map((value) => ({ label: value, value }))

const BAY_OPTIONS = toValueOptions(LOCATION_BAY_OPTIONS)
const LEVEL_OPTIONS = toValueOptions(LOCATION_LEVEL_OPTIONS)
const RACK_OPTIONS = toValueOptions(LOCATION_RACK_OPTIONS)

const DEFAULT_VALUES = {
  id: null,
  code: '',
  type: '',
  siteCode: '',
  processZoneCode: '',
  bayCode: '',
  levelCode: '',
  rackCode: '',
  name: '',
  isActive: true,
  isPalletAllowed: false
} as const

export default function LocationForm({ pageMetaData, location }: LocationFormProps) {
  const router = useRouter()

  const { code } = useParams() as { code: string }

  const isCreate = code === 'add' || !location

  const values = useMemo(() => {
    if (location) {
      const { id, code, type, siteCode, processZoneCode, bayCode, levelCode, rackCode, name, isActive, isPalletAllowed } = location
      return {
        id,
        code,
        type,
        siteCode,
        processZoneCode,
        bayCode,
        levelCode: levelCode ?? '',
        rackCode: rackCode ?? '',
        name,
        isActive,
        isPalletAllowed
      }
    }

    if (isCreate) return { ...DEFAULT_VALUES }
  }, [isCreate, location])

  const form = useForm({
    mode: 'onChange',
    values,
    resetOptions: { keepDirtyValues: true },
    resolver: zodResolver(locationFormSchema)
  })

  const [siteCode, processZoneCode, bayCode, levelCode, rackCode] = useWatch({
    control: form.control,
    name: ['siteCode', 'processZoneCode', 'bayCode', 'levelCode', 'rackCode']
  })

  const sites = useSites()
  const processZones = useProcessZones()
  const upsertLocationAction = useAction(upsertLocation)
  const { intent, setIntent, consumeIntent } = useSubmitIntent()

  //* pickers list active rows only, an old record keeps its own
  const siteOptions = useMemo(() => {
    const current = location?.site ? toFormOption(location.site) : null
    return withCurrentOption(toFormOptions(sites.data), current)
  }, [sites.data, location])

  const processZoneOptions = useMemo(() => {
    const current = location?.processZone ? toFormOption(location.processZone) : null
    return withCurrentOption(toFormOptions(processZones.data), current)
  }, [processZones.data, location])

  const handleSubmit = async (formValues: LocationForm) => {
    const submitIntent = consumeIntent()

    try {
      const response = await upsertLocationAction.executeAsync(formValues)
      const result = response?.data

      if (result?.error) {
        if (result.status === 401 && result.paths && result.paths.length > 0) {
          result.paths.forEach((path) => {
            const field = path.field as keyof LocationForm
            form.setError(field, { type: 'custom', message: path.message })
          })
        }

        toast.error(result.message)
        return
      }

      toast.success(result?.message)

      if (result?.data?.location) {
        router.refresh()

        if (submitIntent === 'save-new') {
          if (isCreate) form.reset(DEFAULT_VALUES, { keepDirtyValues: false })
          else router.push('/locations/add')

          return
        }

        await delay(1500)

        if (isCreate) router.push('/locations')
        else router.push(`/locations/${encodeURIComponent(result.data.location.code)}`)
      }
    } catch (err: any) {
      logger.error(err, '[LOCATION_FORM_HANDLE_SUBMIT_ERROR]:')
      toast.error('Something went wrong! Please try again later.')
    }
  }

  //* preview only, the server builds the real code
  useEffect(() => {
    if (!isCreate) return

    const codePreview =
      siteCode && processZoneCode && bayCode ? buildLocationCode({ siteCode, processZoneCode, bayCode, levelCode, rackCode }) : ''
    form.setValue('code', codePreview)
  }, [isCreate, form, siteCode, processZoneCode, bayCode, levelCode, rackCode])

  return (
    <FormProvider {...form}>
      <form className='flex h-full w-full flex-1 flex-col gap-5' onSubmit={form.handleSubmit(handleSubmit)}>
        <Header title={pageMetaData.title} description={pageMetaData.description}>
          <div className='ml-auto flex items-center gap-2'>
            <TooltipWrapper label='Back'>
              <Button type='button' variant='outline' onClick={() => router.push('/locations')}>
                <Icons.arrowLeft /> Back
              </Button>
            </TooltipWrapper>

            <CanView subject={PERMISSIONS_CODES.LOCATIONS} action={PERMISSIONS_ALLOWED_ACTIONS.CREATE}>
              <TooltipWrapper label='Save & New'>
                {/* //* not a submit button, it would become the form's default and take over the enter key */}
                <LoadingButton
                  type='button'
                  variant='outline-primary'
                  isLoading={upsertLocationAction.isExecuting && intent === 'save-new'}
                  disabled={upsertLocationAction.isExecuting}
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
                isLoading={upsertLocationAction.isExecuting && intent === 'save'}
                disabled={upsertLocationAction.isExecuting}
                onClick={() => setIntent('save')}
              >
                <Icons.save /> Save
              </LoadingButton>
            </TooltipWrapper>

            {location && (
              <DropdownMenu>
                <TooltipWrapper label='More Options'>
                  <DropdownMenuTrigger asChild>
                    <Button variant='ghost' size='icon-lg'>
                      <Icons.ellipsisVertical />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipWrapper>

                <DropdownMenuContent className='w-auto min-w-20' align='end'>
                  <CanView subject={PERMISSIONS_CODES.LOCATIONS} action={PERMISSIONS_ALLOWED_ACTIONS.CREATE}>
                    <DropdownMenuItem onClick={() => router.push('/locations/add')}>
                      <Icons.plus /> Add
                    </DropdownMenuItem>
                  </CanView>

                  <CanView subject={PERMISSIONS_CODES.LOCATIONS} action={PERMISSIONS_ALLOWED_ACTIONS.VIEW}>
                    <DropdownMenuItem onClick={() => router.push(`/locations/${encodeURIComponent(location.code)}/view`)}>
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
                  <ReadOnlyFieldHeader title='Details' description='Enter the details of the location' />
                  <Separator className='mt-4' />
                </Column>

                <Column md={6} lg={3}>
                  <InputField
                    control={form.control}
                    name='code'
                    label='Code'
                    description={isCreate ? 'Made from the site, zone, bay, level and rack you pick' : 'Code cannot be changed'}
                    extendedProps={{ inputProps: { disabled: true } }}
                  />
                </Column>

                <Column md={6} lg={3}>
                  <InputField control={form.control} name='name' label='Name' description='Leave blank to use the code' />
                </Column>

                <Column md={6} lg={3}>
                  <ComboboxField
                    control={form.control}
                    type='Basic'
                    name='type'
                    label='Type'
                    data={LOCATION_TYPE_OPTIONS}
                    description='Optional, can be set later'
                  />
                </Column>

                <Column>
                  <Separator className='mt-3 mb-4' />
                  <ReadOnlyFieldHeader title='Position' description='Where the location sits, cannot be changed later' />
                </Column>

                <Column md={6} lg={3}>
                  <ComboboxField
                    control={form.control}
                    type='Basic'
                    name='siteCode'
                    label='Site'
                    data={siteOptions}
                    isLoading={sites.isLoading}
                    searchKeys={['value']}
                    renderItem={renderCodeItem}
                    isRequired
                    extendedProps={{ comboboxInputProps: { disabled: !isCreate } }}
                  />
                </Column>

                <Column md={6} lg={3}>
                  <ComboboxField
                    control={form.control}
                    type='Basic'
                    name='processZoneCode'
                    label='Process Zone'
                    data={processZoneOptions}
                    isLoading={processZones.isLoading}
                    searchKeys={['value']}
                    renderItem={renderCodeItem}
                    isRequired
                    //* the zone decides the pallet default
                    callback={({ item }) => {
                      if (item) form.setValue('isPalletAllowed', !!item.isPalletEligible, { shouldDirty: true })
                    }}
                    extendedProps={{ comboboxInputProps: { disabled: !isCreate } }}
                  />
                </Column>

                <Column md={4} lg={2}>
                  <ComboboxField
                    control={form.control}
                    type='Basic'
                    name='bayCode'
                    label='Bay'
                    data={BAY_OPTIONS}
                    isRequired
                    extendedProps={{ comboboxInputProps: { disabled: !isCreate } }}
                  />
                </Column>

                <Column md={4} lg={2}>
                  <ComboboxField
                    control={form.control}
                    type='Basic'
                    name='levelCode'
                    label='Level'
                    data={LEVEL_OPTIONS}
                    extendedProps={{ comboboxInputProps: { disabled: !isCreate } }}
                  />
                </Column>

                <Column md={4} lg={2}>
                  <ComboboxField
                    control={form.control}
                    type='Basic'
                    name='rackCode'
                    label='Rack'
                    data={RACK_OPTIONS}
                    extendedProps={{ comboboxInputProps: { disabled: !isCreate } }}
                  />
                </Column>

                <Column>
                  <Separator className='mt-3 mb-4' />
                  <ReadOnlyFieldHeader title='Settings' description="Configure the location's setting" />
                </Column>

                <Column md={6} lg={3}>
                  <SwitchField
                    control={form.control}
                    name='isActive'
                    label='Active'
                    layout='choice-card'
                    description="Inactive locations don't show up in pickers"
                    extendedProps={{ switchProps: { disabled: isCreate } }}
                  />
                </Column>

                <Column md={6} lg={3}>
                  <SwitchField
                    control={form.control}
                    name='isPalletAllowed'
                    label='Pallet Allowed'
                    layout='choice-card'
                    description="Allows pallets here, starts with the process zone's setting"
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
