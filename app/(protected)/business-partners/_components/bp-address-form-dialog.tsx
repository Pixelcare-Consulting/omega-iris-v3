'use client'

import { useMemo } from 'react'
import { FormProvider, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import Modal from '@/components/modal'
import { Row } from '@/components/row'
import { Column } from '@/components/column'
import InputField from '@/components/forms/input-field'
import { ComboboxField } from '@/components/forms/combobox-field'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { FieldGroup } from '@/components/ui/field'
import { ScrollArea } from '@/components/ui/scroll-area'
import { BPAddressForm, bpAddressFormSchema } from '@/schema/business-partner'
import { ADDRESS_TYPE_OPTIONS } from '@/constants/business-partner'
import { useStatesByCountry } from '@/hooks/safe-actions/business-partner'
import { SapCountry } from '@/types/sap'

type BPAddressFormDialogProps = {
  isOpen: boolean
  address: BPAddressForm | null
  otherAddresses: BPAddressForm[] //* every row except the one being edited, for the unique check
  countries: SapCountry[]
  isCountriesLoading?: boolean
  onClose: () => void
  onSave: (address: BPAddressForm) => void
}

const FORM_ID = 'bp-address-form'

const DEFAULT_VALUES: BPAddressForm = {
  AddressName: '',
  AddressName2: '',
  AddressName3: '',
  AddressType: 'bo_BillTo',
  Street: '',
  City: '',
  ZipCode: '',
  Country: '',
  State: ''
}

export default function BPAddressFormDialog({
  isOpen,
  address,
  otherAddresses,
  countries,
  isCountriesLoading,
  onClose,
  onSave
}: BPAddressFormDialogProps) {
  const isCreate = !address

  const values = useMemo(() => (address ? { ...DEFAULT_VALUES, ...address } : DEFAULT_VALUES), [address])

  const form = useForm({ mode: 'onChange', values, resolver: zodResolver(bpAddressFormSchema) })

  const country = useWatch({ control: form.control, name: 'Country' })

  const states = useStatesByCountry(country, [isOpen])

  const countryOptions = useMemo(() => countries.map((c) => ({ value: c.Code, label: c.Name, code: c.Code })), [countries])
  const stateOptions = useMemo(() => states.data.map((s) => ({ value: s.Code, label: s.Name, code: s.Code })), [states.data])
  const addressTypeOptions = useMemo(() => ADDRESS_TYPE_OPTIONS.map((o) => ({ ...o })), [])

  const handleSave = (formValues: BPAddressForm) => {
    const isDuplicate = otherAddresses.some(
      (other) => other.AddressType === formValues.AddressType && other.AddressName.toLowerCase() === formValues.AddressName.toLowerCase()
    )

    if (isDuplicate) {
      form.setError('AddressName', { type: 'custom', message: 'Address ID already exists for this Address Type' })
      return
    }

    onSave(formValues)
  }

  return (
    <Modal
      isOpen={isOpen}
      size='xl'
      isModal={false}
      isCloseOnEscape={false}
      isCloseOnOutsideClick={false}
      title={isCreate ? 'Add Address' : 'Edit Address'}
      description='Saved with the business partner'
      onClose={onClose}
      footer={
        <>
          <Button type='button' variant='outline' onClick={onClose}>
            Cancel
          </Button>

          {/* //* the footer sits outside the form, so `form` is what wires the submit back to it */}
          <Button type='submit' form={FORM_ID}>
            <Icons.check /> {isCreate ? 'Add' : 'Update'}
          </Button>
        </>
      }
    >
      <FormProvider {...form}>
        <form
          id={FORM_ID}
          onSubmit={(e) => {
            //* portals still bubble react events, stop the submit before it reaches the bp form
            e.stopPropagation()
            form.handleSubmit(handleSave)(e)
          }}
        >
          <ScrollArea viewPortClassName='max-h-[60vh] [&>div]:block!' type='auto'>
            <FieldGroup className='px-3 py-1'>
              <Row gap={5}>
                <Column md={6}>
                  <InputField control={form.control} name='AddressName' label='Address ID' isRequired />
                </Column>

                <Column md={6}>
                  <ComboboxField
                    control={form.control}
                    type='Basic'
                    name='AddressType'
                    label='Address Type'
                    data={addressTypeOptions}
                    isRequired
                  />
                </Column>

                <Column md={6}>
                  <InputField control={form.control} name='AddressName2' label='Address Name 2' />
                </Column>

                <Column md={6}>
                  <InputField control={form.control} name='AddressName3' label='Address Name 3' />
                </Column>

                <Column>
                  <InputField control={form.control} name='Street' label='Street / PO Box' />
                </Column>

                <Column md={6}>
                  <InputField control={form.control} name='City' label='City' />
                </Column>

                <Column md={6}>
                  <InputField control={form.control} name='ZipCode' label='Zip Code' />
                </Column>

                <Column md={6}>
                  <ComboboxField
                    control={form.control}
                    type='Basic'
                    name='Country'
                    label='Country/Region'
                    data={countryOptions}
                    isLoading={isCountriesLoading}
                    callback={() => form.setValue('State', '')} //* states belong to one country
                  />
                </Column>

                <Column md={6}>
                  <ComboboxField
                    key={`${country}-${stateOptions.length}`} //! remount once states arrive, the input keeps the text it mounted with
                    control={form.control}
                    type='Basic'
                    name='State'
                    label='State'
                    data={stateOptions}
                    isLoading={states.isLoading}
                  />
                </Column>
              </Row>
            </FieldGroup>
          </ScrollArea>
        </form>
      </FormProvider>
    </Modal>
  )
}
