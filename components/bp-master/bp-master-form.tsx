'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAction } from 'next-safe-action/hooks'
import { FieldErrors, FormProvider, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { BpMasterRow, getNextBpCodeClient, setBpMasterActive, upsertBpMaster } from '@/actions/bp-master'
import { PageMetadata } from '@/types/common'
import {
  type BpMasterForm as BpMasterFormOutput,
  BpMasterFormValues,
  bpMasterFormSchema,
  CARD_CODE_MAX_LENGTH,
  isSameName
} from '@/schema/bp-master'
import { BP_ADDRESS_TYPES, BP_MASTER_CONFIG, BpAddressType, BpMasterType } from '@/constants/bp-master'
import { COMPANY_PRIVATE_OPTIONS } from '@/constants/business-partner'
import { PERMISSIONS_ALLOWED_ACTIONS } from '@/constants/permission'
import type { SapSyncStatus } from '@/prisma/generated/enums'
import Header from '@/components/header'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { TooltipWrapper } from '@/components/tooltip-wrapper'
import { InputGroupButton } from '@/components/ui/input-group'
import { FieldGroup } from '@/components/ui/field'
import { Row } from '@/components/row'
import { Column } from '@/components/column'
import ReadOnlyFieldHeader from '@/components/read-only-field-header'
import InputField from '@/components/forms/input-field'
import SwitchField from '@/components/forms/switch-field'
import ContentWrapper from '@/components/content-wrapper'
import LoadingButton from '@/components/forms/button-field'
import { ComboboxField } from '@/components/forms/combobox-field'
import { renderCodeItem } from '@/components/forms/combobox-item-content'
import Alert from '@/components/alert'
import { useSubmitIntent } from '@/hooks/use-submit-intent'
import { useBpMasterLookups } from '@/hooks/safe-actions/bp-master'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import CanView from '@/components/rbac/can-view'
import { withCurrentOption } from '@/lib/form'
import { delay } from '@/lib/utils'
import { logger } from '@/lib/logger'
import BpAddressSection from './bp-address-section'
import BpContactSection from './bp-contact-section'

type BpMasterFormProps = {
  type: BpMasterType
  pageMetaData: PageMetadata
  bpMaster: BpMasterRow | null
}

type PickField = 'BillToDef' | 'ShipToDef' | 'CntctPrsn'

type NamedRecord = { key: string; name: string }

const toDefaultValues = (type: BpMasterType): BpMasterFormValues => ({
  id: null,
  CardType: type,
  CardCode: '',
  CardName: '',
  GroupCode: null,
  CurrCode: '',
  GroupNum: null,
  AcctType: '',
  CmpPrivate: '',
  BillToDef: '',
  ShipToDef: '',
  CntctPrsn: '',
  isActive: true,
  addresses: [],
  contacts: []
})

function toFormValues(bpMaster: BpMasterRow, type: BpMasterType): BpMasterFormValues {
  return {
    id: bpMaster.id,
    CardType: type,
    CardCode: bpMaster.CardCode,
    CardName: bpMaster.CardName,
    GroupCode: bpMaster.GroupCode,
    CurrCode: bpMaster.CurrCode ?? '',
    GroupNum: bpMaster.GroupNum,
    AcctType: bpMaster.AcctType ?? '',
    CmpPrivate: bpMaster.CmpPrivate ?? '',
    BillToDef: bpMaster.BillToDef ?? '',
    ShipToDef: bpMaster.ShipToDef ?? '',
    CntctPrsn: bpMaster.CntctPrsn ?? '',
    isActive: bpMaster.isActive,
    addresses: bpMaster.addresses.map((a) => ({
      id: a.id,
      AddressName: a.AddressName,
      AddrType: a.AddrType as BpAddressType,
      Street: a.Street ?? '',
      Address2: a.Address2 ?? '',
      Address3: a.Address3 ?? '',
      StreetNo: a.StreetNo ?? '',
      BuildingFloorRoom: a.BuildingFloorRoom ?? '',
      Block: a.Block ?? '',
      City: a.City ?? '',
      ZipCode: a.ZipCode ?? '',
      County: a.County ?? '',
      CountryCode: a.CountryCode ?? '',
      StateCode: a.StateCode ?? ''
    })),
    contacts: bpMaster.contacts.map((c) => ({
      id: c.id,
      ContactName: c.ContactName,
      FirstName: c.FirstName ?? '',
      LastName: c.LastName ?? '',
      Title: c.Title ?? '',
      Position: c.Position ?? '',
      Phone1: c.Phone1 ?? '',
      Phone2: c.Phone2 ?? '',
      MobilePhone: c.MobilePhone ?? '',
      Email: c.Email ?? ''
    }))
  }
}

//* a stored code sap no longer lists stays selectable under its saved name
function toCurrentOption(code: number | string | null | undefined, name: string | null | undefined) {
  if (code === null || code === undefined || code === '') return null
  return { value: String(code), label: `${name ?? code} (Not in SAP)` }
}

export default function BpMasterForm({ type, pageMetaData, bpMaster }: BpMasterFormProps) {
  const router = useRouter()

  const { code } = useParams() as { code: string }

  const isCreate = code === 'add' || !bpMaster

  //* sap owns every sap field once synced
  const isSynced = bpMaster?.syncStatus === 'SYNCED'

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

  const lookups = useBpMasterLookups(type)

  const groupOptions = useMemo(() => {
    const options = lookups.data.groups.map((g) => ({ value: String(g.Code), label: g.Name }))
    return lookups.isLoaded ? withCurrentOption(options, toCurrentOption(bpMaster?.GroupCode, bpMaster?.GroupName)) : options
  }, [lookups.data.groups, lookups.isLoaded, bpMaster])

  const currencyOptions = useMemo(() => {
    const options = lookups.data.currencies.map((c) => ({ value: c.Code, label: c.Name }))
    return lookups.isLoaded ? withCurrentOption(options, toCurrentOption(bpMaster?.CurrCode, bpMaster?.CurrName)) : options
  }, [lookups.data.currencies, lookups.isLoaded, bpMaster])

  const paymentTermOptions = useMemo(() => {
    const options = lookups.data.paymentTerms.map((p) => ({ value: String(p.GroupNumber), label: p.PaymentTermsGroupName }))
    return lookups.isLoaded ? withCurrentOption(options, toCurrentOption(bpMaster?.GroupNum, bpMaster?.PymntGroup)) : options
  }, [lookups.data.paymentTerms, lookups.isLoaded, bpMaster])

  const accountTypeOptions = useMemo(() => {
    const options = lookups.data.accountTypes.map((a) => ({ value: a.Value, label: a.Description }))
    return lookups.isLoaded ? withCurrentOption(options, toCurrentOption(bpMaster?.AcctType, bpMaster?.AcctType)) : options
  }, [lookups.data.accountTypes, lookups.isLoaded, bpMaster])

  const countryOptions = useMemo(() => lookups.data.countries.map((c) => ({ value: c.Code, label: c.Name })), [lookups.data.countries])

  //* row badges read the stored status, a new row has none yet
  const addressStatusById = useMemo(
    () => Object.fromEntries((bpMaster?.addresses ?? []).map((a) => [a.id, a.syncStatus])) as Record<string, SapSyncStatus>,
    [bpMaster]
  )

  const contactStatusById = useMemo(
    () => Object.fromEntries((bpMaster?.contacts ?? []).map((c) => [c.id, c.syncStatus])) as Record<string, SapSyncStatus>,
    [bpMaster]
  )

  //* a new record starts with the next free code, the user can still change it
  const nextCodeAction = useAction(getNextBpCodeClient)

  //* the page load fills an empty code only, the generate button always replaces it
  const fillNextCode = async (isReplace = false) => {
    const response = await nextCodeAction.executeAsync({ type })
    const nextCode = response?.data

    if (!nextCode) {
      toast.error('Could not get the next code from SAP, please type one.')
      return
    }

    if (isReplace || !form.getValues('CardCode')) form.setValue('CardCode', nextCode, { shouldDirty: true, shouldValidate: true })
  }

  useEffect(() => {
    if (isCreate) fillNextCode()
  }, [isCreate])

  //! keyName fieldKey, the default 'id' would override the record id
  const addressArray = useFieldArray({ control: form.control, name: 'addresses', keyName: 'fieldKey' })
  const contactArray = useFieldArray({ control: form.control, name: 'contacts', keyName: 'fieldKey' })

  const watchedAddresses = useWatch({ control: form.control, name: 'addresses' })
  const watchedContacts = useWatch({ control: form.control, name: 'contacts' })

  //* picker options, keyed by name since sap links defaults by name
  const toNameOptions = (names: (string | undefined)[] = []) =>
    names.flatMap((name) => (name?.trim() ? [{ value: name, label: name }] : []))

  const billToOptions = toNameOptions(watchedAddresses?.filter((a) => a.AddrType === BP_ADDRESS_TYPES.BILLING).map((a) => a.AddressName))
  const shipToOptions = toNameOptions(watchedAddresses?.filter((a) => a.AddrType === BP_ADDRESS_TYPES.SHIPPING).map((a) => a.AddressName))
  const contactOptions = toNameOptions(watchedContacts?.map((c) => c.ContactName))

  //* last seen names per field array key, used to follow renames and removals
  const previousRef = useRef<Record<PickField, NamedRecord[]> | null>(null)

  useEffect(() => {
    const toRecords = (keys: string[], names: (string | undefined)[] = []) => keys.map((key, i) => ({ key, name: names[i] ?? '' }))

    const addressNames = watchedAddresses?.map((a) => a.AddressName)
    const addressRecords = toRecords(
      addressArray.fields.map((f) => f.fieldKey),
      addressNames
    )
    const byType = (addrType: BpAddressType) => addressRecords.filter((_, i) => addressArray.fields[i]?.AddrType === addrType)

    const current: Record<PickField, NamedRecord[]> = {
      BillToDef: byType(BP_ADDRESS_TYPES.BILLING),
      ShipToDef: byType(BP_ADDRESS_TYPES.SHIPPING),
      CntctPrsn: toRecords(
        contactArray.fields.map((f) => f.fieldKey),
        watchedContacts?.map((c) => c.ContactName)
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
    if (!previous || isReset || isSynced) return

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
  const setBpMasterActiveAction = useAction(setBpMasterActive)

  const { intent, setIntent, consumeIntent } = useSubmitIntent()

  const isSaving = upsertBpMasterAction.isExecuting || setBpMasterActiveAction.isExecuting

  //* a synced partner saves only isActive, sap's data skips the form rules it may not meet
  const handleSyncedSave = async () => {
    const submitIntent = consumeIntent()

    if (!bpMaster) return

    try {
      const response = await setBpMasterActiveAction.executeAsync({ id: bpMaster.id, type, isActive: form.getValues('isActive') })
      const result = response?.data

      if (!result || result.error) {
        toast.error(result?.message ?? 'Something went wrong! Please try again later.')
        return
      }

      toast.success(result.message)

      if (submitIntent === 'save-new') router.push(`${route}/add`)
      else {
        await delay(1500)
        router.push(`${route}/${encodeURIComponent(bpMaster.CardCode)}`)
      }

      router.refresh()
    } catch (err: any) {
      logger.error(err, '[BP_MASTER_FORM_HANDLE_SYNCED_SAVE_ERROR]:')
      toast.error('Something went wrong! Please try again later.')
    }
  }

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

        if (isCreate) {
          form.reset(toDefaultValues(type), { keepDirtyValues: false })
          fillNextCode()
        } else router.push(`${route}/add`)

        return
      }

      //! reset from the saved record, keepDirtyValues off or new rows keep id null and the next save creates them again
      if (!isCreate) form.reset(toFormValues(saved, type), { keepDirtyValues: false })

      await delay(1500)

      //! navigate before refresh, refreshing here 404s when the code was renamed
      if (isCreate) router.push(route)
      else router.push(`${route}/${encodeURIComponent(saved.CardCode)}`)

      router.refresh()
    } catch (err: any) {
      logger.error(err, '[BP_MASTER_FORM_HANDLE_SUBMIT_ERROR]:')
      toast.error('Something went wrong! Please try again later.')
    }
  }

  const handleInvalid = (errors: FieldErrors<BpMasterFormValues>) => {
    if (errors.addresses || errors.contacts) toast.error('Please fix the issues in the addresses or contacts.')
  }

  const submitForm = () => (isSynced ? handleSyncedSave() : form.handleSubmit(handleSubmit, handleInvalid)())

  const pickerProps = { isLoading: lookups.isLoading, searchKeys: ['value'], renderItem: renderCodeItem }

  return (
    <FormProvider {...form}>
      <form
        className='flex h-full w-full flex-1 flex-col gap-5'
        onSubmit={(event) => {
          event.preventDefault()
          submitForm()
        }}
      >
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
                    submitForm()
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
                    <DropdownMenuItem onClick={() => router.push(`${route}/${encodeURIComponent(bpMaster.CardCode)}/view`)}>
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

                {isSynced && (
                  <Column>
                    <Alert message={`This ${label.toLowerCase()} is synced with SAP. Its details, addresses and contacts come from SAP.`} />
                  </Column>
                )}

                {/* //* a disabled fieldset locks every sap field */}
                <fieldset disabled={isSynced} className='contents'>
                  <Column md={6} lg={3}>
                    <InputField
                      control={form.control}
                      name='CardCode'
                      label='Code'
                      description={isCreate ? 'Next free code, you can change it' : 'Must be unique'}
                      isRequired
                      isWithAddon
                      extendedProps={{
                        inputGroupInputProps: {
                          maxLength: CARD_CODE_MAX_LENGTH,
                          placeholder: nextCodeAction.isExecuting ? 'Loading...' : undefined
                        },
                        inputGroupAddonProps: {
                          align: 'inline-end',
                          children: (
                            <TooltipWrapper label='Generate code'>
                              <InputGroupButton
                                variant='default'
                                size='icon-xs'
                                aria-label='Generate code'
                                disabled={nextCodeAction.isExecuting}
                                onClick={() => fillNextCode(true)}
                              >
                                <Icons.refreshCw className={nextCodeAction.isExecuting ? 'animate-spin' : undefined} />
                              </InputGroupButton>
                            </TooltipWrapper>
                          )
                        }
                      }}
                    />
                  </Column>

                  <Column md={6} lg={9}>
                    <InputField control={form.control} name='CardName' label='Name' isRequired />
                  </Column>

                  <Column md={6} lg={4}>
                    <ComboboxField
                      control={form.control}
                      type='Basic'
                      name='GroupCode'
                      label='Group'
                      data={groupOptions}
                      {...pickerProps}
                    />
                  </Column>

                  <Column md={6} lg={4}>
                    <ComboboxField
                      control={form.control}
                      type='Basic'
                      name='CurrCode'
                      label='Currency'
                      data={currencyOptions}
                      {...pickerProps}
                    />
                  </Column>

                  <Column md={6} lg={4}>
                    <ComboboxField
                      control={form.control}
                      type='Basic'
                      name='GroupNum'
                      label='Payment Terms'
                      data={paymentTermOptions}
                      {...pickerProps}
                    />
                  </Column>

                  <Column md={6} lg={4}>
                    <ComboboxField
                      control={form.control}
                      type='Basic'
                      name='AcctType'
                      label='Account Type'
                      data={accountTypeOptions}
                      isLoading={lookups.isLoading}
                    />
                  </Column>

                  <Column md={6} lg={4}>
                    <ComboboxField
                      control={form.control}
                      type='Basic'
                      name='CmpPrivate'
                      label='Type of Business'
                      data={COMPANY_PRIVATE_OPTIONS}
                    />
                  </Column>

                  <Column md={6} lg={4}>
                    <ComboboxField control={form.control} type='Basic' name='CntctPrsn' label='Contact Person' data={contactOptions} />
                  </Column>

                  <Column md={6} lg={4}>
                    <ComboboxField control={form.control} type='Basic' name='BillToDef' label='Default Bill-To' data={billToOptions} />
                  </Column>

                  <Column md={6} lg={4}>
                    <ComboboxField control={form.control} type='Basic' name='ShipToDef' label='Default Ship-To' data={shipToOptions} />
                  </Column>
                </fieldset>

                <Column>
                  <Separator className='mt-3 mb-4' />
                  <ReadOnlyFieldHeader title='Contacts' description='Contact person details' />
                </Column>

                <Column>
                  <BpContactSection fieldArray={contactArray} statusById={contactStatusById} isDisabled={isSaving} isReadOnly={isSynced} />
                </Column>

                <Column>
                  <Separator className='mt-3 mb-4' />
                  <ReadOnlyFieldHeader title='Addresses' description='Billing & shipping address details' />
                </Column>

                <Column>
                  <BpAddressSection
                    fieldArray={addressArray}
                    countryOptions={countryOptions}
                    statusById={addressStatusById}
                    isDisabled={isSaving}
                    isReadOnly={isSynced}
                  />
                </Column>

                <Column>
                  <Separator className='mt-3 mb-4' />
                  <ReadOnlyFieldHeader title='Settings' description={`Configure the ${label.toLowerCase()}'s setting`} />
                </Column>

                <Column md={6} lg={3}>
                  <SwitchField
                    control={form.control}
                    name='isActive'
                    label='Active'
                    layout='choice-card'
                    description={`Inactive ${label.toLowerCase()}s are hidden from selection`}
                    extendedProps={{ switchProps: { disabled: isCreate } }}
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
