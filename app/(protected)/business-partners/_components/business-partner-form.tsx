'use client'

import { useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAction } from 'next-safe-action/hooks'
import { FieldErrors, FormProvider, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { upsertBusinessPartner } from '@/actions/business-partner'
import { PageMetadata } from '@/types/common'
import { SapBusinessPartner } from '@/types/sap'
import {
  type BusinessPartnerForm as BusinessPartnerFormValues,
  BPAddressForm,
  ContactEmployeeForm,
  businessPartnerFormSchema
} from '@/schema/business-partner'
import {
  ADDRESS_TYPE_OPTIONS,
  ALL_CURRENCIES,
  CARD_TYPE_OPTIONS,
  COMPANY_PRIVATE_OPTIONS,
  NO_SALES_EMPLOYEE_CODE,
  toGroupType,
  toOptionLabel
} from '@/constants/business-partner'
import { useBusinessPartnerLookups } from '@/hooks/safe-actions/business-partner'
import { useSubmitIntent } from '@/hooks/use-submit-intent'
import { withCurrentOption } from '@/lib/form'
import { toBusinessPartnerFormValues } from '@/lib/business-partner'
import { delay } from '@/lib/utils'
import { logger } from '@/lib/logger'
import Header from '@/components/header'
import SapLiveBadge from '@/components/sap-live-badge'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { TooltipWrapper } from '@/components/tooltip-wrapper'
import { FieldError, FieldGroup } from '@/components/ui/field'
import { Row } from '@/components/row'
import { Column } from '@/components/column'
import ReadOnlyFieldHeader from '@/components/read-only-field-header'
import ReadOnlyField from '@/components/read-only-field'
import InputField from '@/components/forms/input-field'
import ContentWrapper from '@/components/content-wrapper'
import LoadingButton from '@/components/forms/button-field'
import { ComboboxField } from '@/components/forms/combobox-field'
import SwitchField from '@/components/forms/switch-field'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import CanView from '@/components/rbac/can-view'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import BPAddressFormDialog from './bp-address-form-dialog'
import BPContactFormDialog from './bp-contact-form-dialog'

type BusinessPartnerFormProps = { pageMetaData: PageMetadata; businessPartner: SapBusinessPartner | null }

const DEFAULT_VALUES: BusinessPartnerFormValues = {
  CardCode: '',
  CardType: 'cCustomer',
  CardName: '',
  GroupCode: 0,
  Currency: '',
  FederalTaxID: '',
  CompanyPrivate: 'cCompany',
  SalesPersonCode: NO_SALES_EMPLOYEE_CODE,
  Phone1: '',
  Phone2: '',
  Cellular: '',
  EmailAddress: '',
  BilltoDefault: '',
  ShipToDefault: '',
  ContactPerson: '',
  isActive: true,
  BPAddresses: [],
  ContactEmployees: []
}

//* one line for a rows tab, the list rule first, else the first bad row
function toRowsError(error: any): string | undefined {
  if (!error) return undefined

  const listMessage = error.message ?? error.root?.message
  if (listMessage) return String(listMessage)

  if (!Array.isArray(error)) return undefined

  const index = error.findIndex(Boolean)
  const fieldError = index === -1 ? null : Object.values(error[index] ?? {}).find((e: any) => e?.message)

  return fieldError ? `Row ${index + 1}: ${(fieldError as any).message}` : undefined
}

//* which row a dialog is editing, index -1 is a new row
type RowEditor<T> = { isOpen: boolean; index: number; row: T | null }

const CLOSED_EDITOR = { isOpen: false, index: -1, row: null }

export default function BusinessPartnerForm({ pageMetaData, businessPartner }: BusinessPartnerFormProps) {
  const router = useRouter()

  const { code } = useParams() as { code: string }

  const isCreate = code === 'add' || !businessPartner

  const values = useMemo(() => {
    if (businessPartner) return toBusinessPartnerFormValues(businessPartner)
    if (isCreate) return DEFAULT_VALUES
  }, [isCreate, businessPartner])

  const form = useForm({
    mode: 'onChange',
    values,
    resetOptions: { keepDirtyValues: true },
    resolver: zodResolver(businessPartnerFormSchema)
  })

  const addresses = useFieldArray({ control: form.control, name: 'BPAddresses' })
  const contacts = useFieldArray({ control: form.control, name: 'ContactEmployees' })

  //* the dialogs mount only while open, so they start from the row's values like the page form does
  const [addressEditor, setAddressEditor] = useState<RowEditor<BPAddressForm>>(CLOSED_EDITOR)
  const [contactEditor, setContactEditor] = useState<RowEditor<ContactEmployeeForm>>(CLOSED_EDITOR)

  const [rowsTab, setRowsTab] = useState('addresses')

  const upsertBusinessPartnerAction = useAction(upsertBusinessPartner)

  const { intent, setIntent, consumeIntent } = useSubmitIntent()

  const lookups = useBusinessPartnerLookups()

  const cardType = useWatch({ control: form.control, name: 'CardType' })
  const addressRows = useWatch({ control: form.control, name: 'BPAddresses' }) ?? []
  const contactRows = useWatch({ control: form.control, name: 'ContactEmployees' }) ?? []

  const cardTypeOptions = useMemo(() => CARD_TYPE_OPTIONS.map((o) => ({ ...o })), [])
  const companyPrivateOptions = useMemo(() => COMPANY_PRIVATE_OPTIONS.map((o) => ({ ...o })), [])

  const groupOptions = useMemo(() => {
    const groupType = toGroupType(cardType ?? 'cCustomer')
    return lookups.data.groups.filter((g) => g.Type === groupType).map((g) => ({ value: String(g.Code), label: g.Name, code: g.Code }))
  }, [lookups.data.groups, cardType])

  const currencyOptions = useMemo(
    () =>
      [ALL_CURRENCIES, ...lookups.data.currencies].map((c) => ({
        value: c.Code,
        label: c.Code === ALL_CURRENCIES.Code ? c.Name : `${c.Code} - ${c.Name}`,
        code: c.Code
      })),
    [lookups.data.currencies]
  )

  //* the picker lists active sales employees only, a bp already on an inactive one keeps it selectable
  const salesPersonOptions = useMemo(() => {
    const toOption = (s: (typeof lookups.data.salesPersons)[number]) => ({
      value: String(s.SalesEmployeeCode),
      label: s.SalesEmployeeName,
      code: s.SalesEmployeeCode,
      isActive: s.Active === 'tYES'
    })

    const current = lookups.data.salesPersons.find((s) => s.SalesEmployeeCode === businessPartner?.SalesPersonCode)
    const active = lookups.data.salesPersons.filter((s) => s.Active === 'tYES').map(toOption)

    return withCurrentOption(active, current ? toOption(current) : null)
  }, [lookups.data.salesPersons, businessPartner])

  const toAddressOptions = (type: BPAddressForm['AddressType']) =>
    addressRows.filter((a) => a.AddressType === type).map((a) => ({ value: a.AddressName, label: a.AddressName, code: a.AddressName }))

  const billToOptions = toAddressOptions('bo_BillTo')
  const shipToOptions = toAddressOptions('bo_ShipTo')
  const contactOptions = contactRows.map((c) => ({ value: c.Name, label: c.Name, code: c.Name }))

  const countryNames = useMemo(() => new Map(lookups.data.countries.map((c) => [c.Code, c.Name])), [lookups.data.countries])

  //* a group of the other type is not valid once the bp type changes
  const handleCardTypeChange = (nextCardType?: string) => {
    if (!nextCardType) return

    const groupType = toGroupType(nextCardType as BusinessPartnerFormValues['CardType'])
    const group = lookups.data.groups.find((g) => g.Code === Number(form.getValues('GroupCode')))

    if (group && group.Type !== groupType) form.setValue('GroupCode', 0, { shouldValidate: true })
  }

  const defaultField = (type: BPAddressForm['AddressType']) => (type === 'bo_BillTo' ? 'BilltoDefault' : 'ShipToDefault')

  const handleSaveAddress = (address: BPAddressForm) => {
    const { index, row: previous } = addressEditor

    if (index === -1) addresses.append(address)
    else addresses.update(index, address)

    //* keep the defaults pointing at the right row
    if (previous && form.getValues(defaultField(previous.AddressType)) === previous.AddressName) {
      form.setValue(defaultField(previous.AddressType), previous.AddressType === address.AddressType ? address.AddressName : '')
    }

    //* the first address of a type becomes its default, same as sap
    if (!form.getValues(defaultField(address.AddressType))) form.setValue(defaultField(address.AddressType), address.AddressName)

    setAddressEditor(CLOSED_EDITOR)
    form.trigger(['BPAddresses', 'BilltoDefault', 'ShipToDefault'])
  }

  const handleRemoveAddress = (index: number) => {
    const removed = form.getValues(`BPAddresses.${index}`)

    addresses.remove(index)

    if (form.getValues(defaultField(removed.AddressType)) === removed.AddressName) form.setValue(defaultField(removed.AddressType), '')
    form.trigger(['BPAddresses', 'BilltoDefault', 'ShipToDefault'])
  }

  const handleSaveContact = (contact: ContactEmployeeForm) => {
    const { index, row: previous } = contactEditor

    if (index === -1) contacts.append(contact)
    else contacts.update(index, contact)

    if (previous && form.getValues('ContactPerson') === previous.Name) form.setValue('ContactPerson', contact.Name)
    if (!form.getValues('ContactPerson')) form.setValue('ContactPerson', contact.Name)

    setContactEditor(CLOSED_EDITOR)
    form.trigger(['ContactEmployees', 'ContactPerson'])
  }

  const handleRemoveContact = (index: number) => {
    const removed = form.getValues(`ContactEmployees.${index}`)

    contacts.remove(index)

    if (form.getValues('ContactPerson') === removed.Name) form.setValue('ContactPerson', '')
    form.trigger(['ContactEmployees', 'ContactPerson'])
  }

  const addressesError = toRowsError(form.formState.errors.BPAddresses)
  const contactsError = toRowsError(form.formState.errors.ContactEmployees)

  //* field errors show inline, row errors show above their table, so open the tab that has one
  const handleInvalid = (errors: FieldErrors) => {
    if (toRowsError(errors.BPAddresses)) setRowsTab('addresses')
    else if (toRowsError(errors.ContactEmployees)) setRowsTab('contacts')
  }

  const handleSubmit = async (formValues: BusinessPartnerFormValues) => {
    const submitIntent = consumeIntent()

    try {
      const response = await upsertBusinessPartnerAction.executeAsync(formValues)
      const result = response?.data

      if (!result || result.error) {
        toast.error(result?.message ?? 'Something went wrong! Please try again later.')
        return
      }

      toast.success(result.message)

      const savedCode = result.data?.businessPartner?.CardCode

      if (savedCode) {
        router.refresh()

        //* save and new stays on a blank form, editing hands off to the add page
        if (submitIntent === 'save-new') {
          //* overrides the form-level option so the fields clear
          if (isCreate) form.reset(DEFAULT_VALUES, { keepDirtyValues: false })
          else router.push('/business-partners/add')

          return
        }

        await delay(1500)

        if (isCreate) router.push('/business-partners')
        else router.push(`/business-partners/${encodeURIComponent(savedCode)}`)
      }
    } catch (err: any) {
      logger.error(err, '[BUSINESS_PARTNER_FORM_HANDLE_SUBMIT_ERROR]:')
      toast.error('Something went wrong! Please try again later.')
    }
  }

  const tabError = (message?: string) => (message ? <FieldError className='px-1' errors={[{ message }]} /> : null)

  return (
    <FormProvider {...form}>
      <form className='flex h-full w-full flex-1 flex-col gap-5' onSubmit={form.handleSubmit(handleSubmit, handleInvalid)}>
        <Header title={pageMetaData.title} description={pageMetaData.description} badge={<SapLiveBadge />}>
          <div className='ml-auto flex items-center gap-2'>
            <TooltipWrapper label='Back'>
              <Button type='button' variant='outline' onClick={() => router.push('/business-partners')}>
                <Icons.arrowLeft /> Back
              </Button>
            </TooltipWrapper>

            <CanView subject={PERMISSIONS_CODES.BUSINESS_PARTNERS} action={PERMISSIONS_ALLOWED_ACTIONS.CREATE}>
              <TooltipWrapper label='Save & New'>
                {/* //* not a submit button, it would become the form's default and take over the enter key */}
                <LoadingButton
                  type='button'
                  variant='outline-primary'
                  isLoading={upsertBusinessPartnerAction.isExecuting && intent === 'save-new'}
                  disabled={upsertBusinessPartnerAction.isExecuting}
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
                isLoading={upsertBusinessPartnerAction.isExecuting && intent === 'save'}
                disabled={upsertBusinessPartnerAction.isExecuting}
                onClick={() => setIntent('save')}
              >
                <Icons.save /> Save
              </LoadingButton>
            </TooltipWrapper>

            {businessPartner && (
              <DropdownMenu>
                <TooltipWrapper label='More Options'>
                  <DropdownMenuTrigger asChild>
                    <Button type='button' variant='ghost' size='icon-lg'>
                      <Icons.ellipsisVertical />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipWrapper>

                <DropdownMenuContent className='w-auto min-w-20' align='end'>
                  <CanView subject={PERMISSIONS_CODES.BUSINESS_PARTNERS} action={PERMISSIONS_ALLOWED_ACTIONS.CREATE}>
                    <DropdownMenuItem onClick={() => router.push('/business-partners/add')}>
                      <Icons.plus /> Add
                    </DropdownMenuItem>
                  </CanView>

                  <CanView subject={PERMISSIONS_CODES.BUSINESS_PARTNERS} action={PERMISSIONS_ALLOWED_ACTIONS.VIEW}>
                    <DropdownMenuItem
                      onClick={() => router.push(`/business-partners/${encodeURIComponent(businessPartner.CardCode)}/view`)}
                    >
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
                  <ReadOnlyFieldHeader title='General' description='Enter the details of the business partner' />
                  <Separator className='mt-4' />
                </Column>

                {!isCreate && (
                  <Column md={6} lg={3}>
                    <ReadOnlyField title='Code' value={businessPartner?.CardCode} />
                  </Column>
                )}

                <Column md={6} lg={3}>
                  <ComboboxField
                    control={form.control}
                    type='Basic'
                    name='CardType'
                    label='BP Type'
                    data={cardTypeOptions}
                    isRequired
                    description={isCreate ? 'Code comes from the default SAP series of this type' : undefined}
                    callback={(args) => handleCardTypeChange(args?.item?.value)}
                  />
                </Column>

                <Column md={6} lg={isCreate ? 6 : 3}>
                  <InputField control={form.control} name='CardName' label='Name' isRequired />
                </Column>

                <Column md={6} lg={3}>
                  <ComboboxField
                    control={form.control}
                    type='Basic'
                    name='GroupCode'
                    label='Group'
                    data={groupOptions}
                    isLoading={lookups.isLoading}
                    isRequired
                  />
                </Column>

                <Column md={6} lg={3}>
                  <ComboboxField
                    control={form.control}
                    type='Basic'
                    name='Currency'
                    label='Currency'
                    data={currencyOptions}
                    isLoading={lookups.isLoading}
                  />
                </Column>

                <Column md={6} lg={3}>
                  <InputField control={form.control} name='FederalTaxID' label='Federal Tax ID' />
                </Column>

                <Column md={6} lg={3}>
                  <ComboboxField
                    control={form.control}
                    type='Basic'
                    name='CompanyPrivate'
                    label='Type of Business'
                    data={companyPrivateOptions}
                    isRequired
                  />
                </Column>

                <Column md={6} lg={3}>
                  <ComboboxField
                    control={form.control}
                    type='Basic'
                    name='SalesPersonCode'
                    label='Sales Employee'
                    data={salesPersonOptions}
                    isLoading={lookups.isLoading}
                  />
                </Column>

                <Column>
                  <Separator className='mt-3 mb-4' />
                  <ReadOnlyFieldHeader title='Contact' description='Phone and e-mail of the business partner' />
                </Column>

                <Column md={6} lg={3}>
                  <InputField control={form.control} name='Phone1' label='Tel 1' />
                </Column>

                <Column md={6} lg={3}>
                  <InputField control={form.control} name='Phone2' label='Tel 2' />
                </Column>

                <Column md={6} lg={3}>
                  <InputField control={form.control} name='Cellular' label='Mobile Phone' />
                </Column>

                <Column md={6} lg={3}>
                  <InputField control={form.control} name='EmailAddress' label='E-Mail' />
                </Column>

                <Column>
                  <Separator className='mt-3 mb-4' />
                  <ReadOnlyFieldHeader title='Defaults' description='Picked from the addresses and contact persons below' />
                </Column>

                <Column md={6} lg={3}>
                  <ComboboxField control={form.control} type='Basic' name='BilltoDefault' label='Bill-to Default' data={billToOptions} />
                </Column>

                <Column md={6} lg={3}>
                  <ComboboxField control={form.control} type='Basic' name='ShipToDefault' label='Ship-to Default' data={shipToOptions} />
                </Column>

                <Column md={6} lg={3}>
                  <ComboboxField control={form.control} type='Basic' name='ContactPerson' label='Contact Person' data={contactOptions} />
                </Column>

                <Column md={6} lg={3}>
                  <SwitchField
                    control={form.control}
                    name='isActive'
                    label='Active'
                    layout='choice-card'
                    description='Inactive business partners are frozen in SAP'
                  />
                </Column>

                <Column>
                  <Separator className='mt-3 mb-4' />

                  <Tabs value={rowsTab} onValueChange={setRowsTab} className='w-full'>
                    <TabsList>
                      <TabsTrigger value='addresses'>Addresses ({addresses.fields.length})</TabsTrigger>
                      <TabsTrigger value='contacts'>Contact Persons ({contacts.fields.length})</TabsTrigger>
                    </TabsList>

                    <TabsContent value='addresses' className='flex flex-col gap-2 pt-2'>
                      <div className='flex items-center justify-between gap-2'>
                        {tabError(addressesError)}

                        <Button
                          type='button'
                          variant='outline'
                          className='ml-auto'
                          onClick={() => setAddressEditor({ isOpen: true, index: -1, row: null })}
                        >
                          <Icons.plus /> Add Address
                        </Button>
                      </div>

                      <div className='rounded-md border'>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Address ID</TableHead>
                              <TableHead>Address Type</TableHead>
                              <TableHead>Street / PO Box</TableHead>
                              <TableHead>City</TableHead>
                              <TableHead>Country/Region</TableHead>
                              <TableHead>State</TableHead>
                              <TableHead className='w-24 text-center'>Actions</TableHead>
                            </TableRow>
                          </TableHeader>

                          <TableBody>
                            {addresses.fields.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={7} className='text-muted-foreground h-16 text-center'>
                                  No addresses yet
                                </TableCell>
                              </TableRow>
                            ) : (
                              addresses.fields.map((field, index) => {
                                const row = addressRows[index] ?? field

                                return (
                                  <TableRow key={field.id}>
                                    <TableCell className='font-medium'>{row.AddressName}</TableCell>
                                    <TableCell>{toOptionLabel(ADDRESS_TYPE_OPTIONS, row.AddressType)}</TableCell>
                                    <TableCell>{row.Street || '—'}</TableCell>
                                    <TableCell>{row.City || '—'}</TableCell>
                                    <TableCell>{(row.Country && countryNames.get(row.Country)) || row.Country || '—'}</TableCell>
                                    <TableCell>{row.State || '—'}</TableCell>
                                    <TableCell className='text-center'>
                                      <Button
                                        type='button'
                                        variant='ghost'
                                        size='icon-sm'
                                        onClick={() => setAddressEditor({ isOpen: true, index, row })}
                                      >
                                        <Icons.pencil className='text-muted-foreground size-4' />
                                      </Button>

                                      <Button type='button' variant='ghost' size='icon-sm' onClick={() => handleRemoveAddress(index)}>
                                        <Icons.trash className='text-destructive size-4' />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                )
                              })
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>

                    <TabsContent value='contacts' className='flex flex-col gap-2 pt-2'>
                      <div className='flex items-center justify-between gap-2'>
                        {tabError(contactsError)}

                        <Button
                          type='button'
                          variant='outline'
                          className='ml-auto'
                          onClick={() => setContactEditor({ isOpen: true, index: -1, row: null })}
                        >
                          <Icons.plus /> Add Contact Person
                        </Button>
                      </div>

                      <div className='rounded-md border'>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Contact ID</TableHead>
                              <TableHead>Position</TableHead>
                              <TableHead>E-Mail</TableHead>
                              <TableHead>Tel 1</TableHead>
                              <TableHead>Mobile Phone</TableHead>
                              <TableHead>Active</TableHead>
                              <TableHead className='w-24 text-center'>Actions</TableHead>
                            </TableRow>
                          </TableHeader>

                          <TableBody>
                            {contacts.fields.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={7} className='text-muted-foreground h-16 text-center'>
                                  No contact persons yet
                                </TableCell>
                              </TableRow>
                            ) : (
                              contacts.fields.map((field, index) => {
                                const row = contactRows[index] ?? field

                                return (
                                  <TableRow key={field.id}>
                                    <TableCell className='font-medium'>{row.Name}</TableCell>
                                    <TableCell>{row.Position || '—'}</TableCell>
                                    <TableCell>{row.E_Mail || '—'}</TableCell>
                                    <TableCell>{row.Phone1 || '—'}</TableCell>
                                    <TableCell>{row.MobilePhone || '—'}</TableCell>
                                    <TableCell>{row.Active ? 'Yes' : 'No'}</TableCell>
                                    <TableCell className='text-center'>
                                      <Button
                                        type='button'
                                        variant='ghost'
                                        size='icon-sm'
                                        onClick={() => setContactEditor({ isOpen: true, index, row })}
                                      >
                                        <Icons.pencil className='text-muted-foreground size-4' />
                                      </Button>

                                      <Button type='button' variant='ghost' size='icon-sm' onClick={() => handleRemoveContact(index)}>
                                        <Icons.trash className='text-destructive size-4' />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                )
                              })
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>
                  </Tabs>
                </Column>
              </Row>
            </FieldGroup>
          </ScrollArea>
        </ContentWrapper>

        {addressEditor.isOpen && (
          <BPAddressFormDialog
            isOpen
            address={addressEditor.row}
            otherAddresses={addressRows.filter((_, index) => index !== addressEditor.index)}
            countries={lookups.data.countries}
            isCountriesLoading={lookups.isLoading}
            onClose={() => setAddressEditor(CLOSED_EDITOR)}
            onSave={handleSaveAddress}
          />
        )}

        {contactEditor.isOpen && (
          <BPContactFormDialog
            isOpen
            contact={contactEditor.row}
            otherContacts={contactRows.filter((_, index) => index !== contactEditor.index)}
            onClose={() => setContactEditor(CLOSED_EDITOR)}
            onSave={handleSaveContact}
          />
        )}
      </form>
    </FormProvider>
  )
}
