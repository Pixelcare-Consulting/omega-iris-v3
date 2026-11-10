'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAction } from 'next-safe-action/hooks'
import { FieldErrors, FormProvider, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { BpMasterWithRelations, upsertBpMaster } from '@/actions/bp-master'
import { PageMetadata, FormOptions } from '@/types/common'
import { type BpMasterForm as BpMasterFormOutput, BpMasterFormValues, bpMasterFormSchema, isSameName } from '@/schema/bp-master'
import { BP_ADDRESS_TYPES, BP_MASTER_CONFIG, BpAddressType, BpMasterType } from '@/constants/bp-master'
import { PERMISSIONS_ALLOWED_ACTIONS } from '@/constants/permission'
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
import { ComboboxField } from '@/components/forms/combobox-field'
import { useSubmitIntent } from '@/hooks/use-submit-intent'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import CanView from '@/components/rbac/can-view'
import { delay } from '@/lib/utils'
import { logger } from '@/lib/logger'
import BpAddressSection from './bp-address-section'
import BpContactSection from './bp-contact-section'

type BpMasterFormProps = {
  type: BpMasterType
  pageMetaData: PageMetadata
  bpMaster: BpMasterWithRelations | null
  countryOptions: FormOptions[]
}

type PickField = 'defaultBillingName' | 'defaultShippingName' | 'defaultContactName'

type NamedRecord = { key: string; name: string }

const toDefaultValues = (type: BpMasterType): BpMasterFormValues => ({
  id: null,
  code: null,
  type,
  name: '',
  defaultBillingName: '',
  defaultShippingName: '',
  defaultContactName: '',
  addresses: [],
  contacts: []
})

const findDefaultName = (rows: { name: string; isDefault: boolean }[]) => rows.find((row) => row.isDefault)?.name ?? ''

function toFormValues(bpMaster: BpMasterWithRelations, type: BpMasterType): BpMasterFormValues {
  const billing = bpMaster.addresses.filter((a) => a.type === BP_ADDRESS_TYPES.BILLING)
  const shipping = bpMaster.addresses.filter((a) => a.type === BP_ADDRESS_TYPES.SHIPPING)

  return {
    id: bpMaster.id,
    code: bpMaster.code,
    type,
    name: bpMaster.name,
    defaultBillingName: findDefaultName(billing),
    defaultShippingName: findDefaultName(shipping),
    defaultContactName: findDefaultName(bpMaster.contacts),
    addresses: bpMaster.addresses.map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      type: a.type as BpAddressType,
      line1: a.line1 ?? '',
      line2: a.line2 ?? '',
      line3: a.line3 ?? '',
      streetNo: a.streetNo ?? '',
      buildingFloorRoom: a.buildingFloorRoom ?? '',
      block: a.block ?? '',
      city: a.city ?? '',
      zipCode: a.zipCode ?? '',
      countryCode: a.countryCode ?? '',
      stateCode: a.stateCode ?? ''
    })),
    contacts: bpMaster.contacts.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      email: c.email ?? '',
      title: c.title ?? '',
      position: c.position ?? '',
      tel1: c.tel1 ?? '',
      tel2: c.tel2 ?? '',
      phone: c.phone ?? ''
    }))
  }
}

export default function BpMasterForm({ type, pageMetaData, bpMaster, countryOptions }: BpMasterFormProps) {
  const router = useRouter()

  const { code } = useParams() as { code: string }

  const isCreate = code === 'add' || !bpMaster

  const { label, route, permission } = BP_MASTER_CONFIG[type]

  const values = useMemo<BpMasterFormValues | undefined>(() => {
    if (bpMaster) return toFormValues(bpMaster, type)
    if (isCreate) return toDefaultValues(type)
  }, [isCreate, bpMaster, type])

  const form = useForm<BpMasterFormValues, unknown, BpMasterFormOutput>({
    mode: 'onChange',
    values,
    resetOptions: { keepDirtyValues: true },
    resolver: zodResolver(bpMasterFormSchema)
  })

  //! keyName fieldKey, the default 'id' would override the record id
  const addressArray = useFieldArray({ control: form.control, name: 'addresses', keyName: 'fieldKey' })
  const contactArray = useFieldArray({ control: form.control, name: 'contacts', keyName: 'fieldKey' })

  const watchedAddresses = useWatch({ control: form.control, name: 'addresses' })
  const watchedContacts = useWatch({ control: form.control, name: 'contacts' })

  //* picker options, keyed by name since a new record has no code yet
  const toNameOptions = (rows: { name?: string }[] = []) =>
    rows.flatMap((row) => (row.name?.trim() ? [{ value: row.name, label: row.name }] : []))

  const billingOptions = toNameOptions(watchedAddresses?.filter((a) => a.type === BP_ADDRESS_TYPES.BILLING))
  const shippingOptions = toNameOptions(watchedAddresses?.filter((a) => a.type === BP_ADDRESS_TYPES.SHIPPING))
  const contactOptions = toNameOptions(watchedContacts)

  //* last seen names per field array key, used to follow renames and removals
  const previousRef = useRef<Record<PickField, NamedRecord[]> | null>(null)

  useEffect(() => {
    const toRecords = (keys: string[], rows: { name?: string }[] = []) => keys.map((key, i) => ({ key, name: rows[i]?.name ?? '' }))

    const addressKeys = addressArray.fields.map((f) => f.fieldKey)
    const addressRecords = toRecords(addressKeys, watchedAddresses)
    const byType = (type: BpAddressType) => addressRecords.filter((_, i) => addressArray.fields[i]?.type === type)

    const current: Record<PickField, NamedRecord[]> = {
      defaultBillingName: byType(BP_ADDRESS_TYPES.BILLING),
      defaultShippingName: byType(BP_ADDRESS_TYPES.SHIPPING),
      defaultContactName: toRecords(
        contactArray.fields.map((f) => f.fieldKey),
        watchedContacts
      )
    }

    const previous = previousRef.current
    previousRef.current = current

    //* first run or a full reset, every key is new so there is nothing to follow
    const previousKeys = previous
      ? Object.values(previous)
          .flat()
          .map((r) => r.key)
      : []
    const currentKeys = new Set(
      Object.values(current)
        .flat()
        .map((r) => r.key)
    )
    //! an empty form is a removal, not a reset, so the last picked record still clears its picker
    const isReset = previousKeys.length > 0 && currentKeys.size > 0 && !previousKeys.some((key) => currentKeys.has(key))
    if (!previous || isReset) return

    ;(Object.keys(current) as PickField[]).forEach((field) => {
      const pick = form.getValues(field) ?? ''
      const records = current[field]
      const before = previous[field]

      const setPick = (value: string) => form.setValue(field, value, { shouldDirty: true, shouldValidate: true })

      if (pick) {
        const picked = before.find((r) => isSameName(r.name, pick))
        if (!picked) return

        const now = records.find((r) => r.key === picked.key)

        if (!now) setPick('')
        else if (now.name !== picked.name) setPick(now.name)

        return
      }

      //* the first named record fills an empty picker
      const hadNamed = before.some((r) => r.name.trim())
      const firstNamed = records.find((r) => r.name.trim())

      if (!hadNamed && firstNamed) setPick(firstNamed.name)
    })
  }, [watchedAddresses, watchedContacts, addressArray.fields, contactArray.fields])

  const upsertBpMasterAction = useAction(upsertBpMaster)

  const { intent, setIntent, consumeIntent } = useSubmitIntent()

  const isSaving = upsertBpMasterAction.isExecuting

  const handleSubmit = async (formValues: BpMasterFormOutput) => {
    const submitIntent = consumeIntent()

    try {
      const response = await upsertBpMasterAction.executeAsync(formValues)
      const result = response?.data

      if (result?.error) {
        if (result.status === 401 && result.paths && result.paths.length > 0) {
          result.paths.forEach((path) => {
            form.setError(path.field as keyof BpMasterFormValues, { type: 'custom', message: path.message })
          })
        }

        toast.error(result.message)
        return
      }

      const saved = result?.data?.bpMaster

      if (!saved) return

      toast.success(result?.message)

      //* save and new stays on a blank form, editing hands off to the add page
      if (submitIntent === 'save-new') {
        router.refresh()

        if (isCreate) form.reset(toDefaultValues(type), { keepDirtyValues: false })
        else router.push(`${route}/add`)

        return
      }

      //! reset from the saved record, keepDirtyValues off or new rows keep id null and the next save creates them again
      if (!isCreate) form.reset(toFormValues(saved, type), { keepDirtyValues: false })

      await delay(1500)

      if (isCreate) router.push(route)
      else router.push(`${route}/${saved.code}`)

      router.refresh()
    } catch (err: any) {
      logger.error(err, '[BP_MASTER_FORM_HANDLE_SUBMIT_ERROR]:')
      toast.error('Something went wrong! Please try again later.')
    }
  }

  const handleInvalid = (errors: FieldErrors<BpMasterFormValues>) => {
    if (errors.addresses || errors.contacts) toast.error('Please fix the issues in the addresses or contacts.')
  }

  return (
    <FormProvider {...form}>
      <form className='flex h-full w-full flex-1 flex-col gap-5' onSubmit={form.handleSubmit(handleSubmit, handleInvalid)}>
        <Header title={pageMetaData.title} description={pageMetaData.description}>
          <div className='ml-auto flex items-center gap-2'>
            <TooltipWrapper label='Back'>
              <Button type='button' variant='outline' onClick={() => router.push(route)}>
                <Icons.arrowLeft /> Back
              </Button>
            </TooltipWrapper>

            <CanView subject={permission} action={PERMISSIONS_ALLOWED_ACTIONS.CREATE}>
              <TooltipWrapper label='Save & New'>
                {/* //* not a submit button, it would become the form's default and take over the enter key */}
                <LoadingButton
                  type='button'
                  variant='outline-primary'
                  isLoading={isSaving && intent === 'save-new'}
                  disabled={isSaving}
                  onClick={() => {
                    setIntent('save-new')
                    form.handleSubmit(handleSubmit, handleInvalid)()
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
                isLoading={isSaving && intent === 'save'}
                disabled={isSaving}
                onClick={() => setIntent('save')}
              >
                <Icons.save /> Save
              </LoadingButton>
            </TooltipWrapper>

            {bpMaster && (
              <DropdownMenu>
                <TooltipWrapper label='More Options'>
                  <DropdownMenuTrigger asChild>
                    <Button variant='ghost' size='icon-lg'>
                      <Icons.ellipsisVertical />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipWrapper>

                <DropdownMenuContent className='w-auto min-w-20' align='end'>
                  <CanView subject={permission} action={PERMISSIONS_ALLOWED_ACTIONS.CREATE}>
                    <DropdownMenuItem onClick={() => router.push(`${route}/add`)}>
                      <Icons.plus /> Add
                    </DropdownMenuItem>
                  </CanView>

                  <CanView subject={permission} action={PERMISSIONS_ALLOWED_ACTIONS.VIEW}>
                    <DropdownMenuItem onClick={() => router.push(`${route}/${bpMaster.code}/view`)}>
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
                  <ReadOnlyFieldHeader title='Details' description={`Enter the details of the ${label.toLowerCase()}`} />
                  <Separator className='mt-4' />
                </Column>

                <Column md={6} lg={3}>
                  <InputField
                    control={form.control}
                    name='code'
                    label='Code'
                    placeholder='Auto-generated'
                    extendedProps={{ inputProps: { disabled: true } }}
                  />
                </Column>

                <Column md={6} lg={9}>
                  <InputField control={form.control} name='name' label='Name' description='Name must be unique' isRequired />
                </Column>

                <Column md={6} lg={4}>
                  <ComboboxField
                    control={form.control}
                    type='Basic'
                    name='defaultBillingName'
                    label='Default Bill-To'
                    data={billingOptions}
                  />
                </Column>

                <Column md={6} lg={4}>
                  <ComboboxField
                    control={form.control}
                    type='Basic'
                    name='defaultShippingName'
                    label='Default Ship-To'
                    data={shippingOptions}
                  />
                </Column>

                <Column md={6} lg={4}>
                  <ComboboxField
                    control={form.control}
                    type='Basic'
                    name='defaultContactName'
                    label='Contact Person'
                    data={contactOptions}
                  />
                </Column>

                <Column>
                  <Separator className='mt-3 mb-4' />
                  <ReadOnlyFieldHeader title='Contacts' description='Contact person details' />
                </Column>

                <Column>
                  <BpContactSection fieldArray={contactArray} isDisabled={isSaving} />
                </Column>

                <Column>
                  <Separator className='mt-3 mb-4' />
                  <ReadOnlyFieldHeader title='Addresses' description='Billing & shipping address details' />
                </Column>

                <Column>
                  <BpAddressSection fieldArray={addressArray} countryOptions={countryOptions} isDisabled={isSaving} />
                </Column>
              </Row>
            </FieldGroup>
          </ScrollArea>
        </ContentWrapper>
      </form>
    </FormProvider>
  )
}
