'use client'

import { useState } from 'react'
import { UseFieldArrayReturn, useFormContext, useFormState, useWatch } from 'react-hook-form'

import { BpMasterFormValues, isSameName } from '@/schema/bp-master'
import { BP_ADDRESS_TYPE_LABELS, BP_ADDRESS_TYPES, BpAddressType } from '@/constants/bp-master'
import { FormOptions } from '@/types/common'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Row } from '@/components/row'
import { Column } from '@/components/column'
import InputField from '@/components/forms/input-field'
import { ComboboxField } from '@/components/forms/combobox-field'
import { renderCodeItem } from '@/components/forms/combobox-item-content'
import { useStateOptions } from '@/hooks/safe-actions/country-state'
import EmptyState from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import BpRecordPager from './bp-record-pager'
import BpSectionError from './bp-section-error'

type BpAddressSectionProps = {
  fieldArray: UseFieldArrayReturn<BpMasterFormValues, 'addresses', 'fieldKey'>
  countryOptions: FormOptions[]
  isDisabled?: boolean
}

const ADDRESS_TABS = [BP_ADDRESS_TYPES.BILLING, BP_ADDRESS_TYPES.SHIPPING]

export function toEmptyAddress(type: BpAddressType): BpMasterFormValues['addresses'][number] {
  return {
    id: null,
    code: null,
    name: '',
    type,
    line1: '',
    line2: '',
    line3: '',
    streetNo: '',
    buildingFloorRoom: '',
    block: '',
    city: '',
    zipCode: '',
    countryCode: '',
    stateCode: ''
  }
}

export default function BpAddressSection({ fieldArray, countryOptions, isDisabled }: BpAddressSectionProps) {
  const { control, setValue } = useFormContext<BpMasterFormValues>()
  const { errors } = useFormState({ control, name: 'addresses' })

  const [tab, setTab] = useState<BpAddressType>(BP_ADDRESS_TYPES.BILLING)
  const [positions, setPositions] = useState<Record<BpAddressType, number>>({ B: 0, S: 0 })

  const [defaultBillingName, defaultShippingName] = useWatch({ control, name: ['defaultBillingName', 'defaultShippingName'] })
  const addresses = useWatch({ control, name: 'addresses' }) ?? []

  //* each tab is a view over one array, entries keep their real index
  const entries = fieldArray.fields.map((field, index) => ({ field, index })).filter(({ field }) => field.type === tab)
  const position = Math.min(positions[tab], Math.max(entries.length - 1, 0))
  const current = entries[position]

  const currentIndex = current?.index
  const countryCode = currentIndex !== undefined ? addresses[currentIndex]?.countryCode : null
  const stateOptions = useStateOptions(countryCode)

  const setPosition = (value: number) => setPositions((prev) => ({ ...prev, [tab]: value }))

  const handleAdd = () => {
    fieldArray.append(toEmptyAddress(tab), { shouldFocus: false })
    setPosition(entries.length)
  }

  const handleRemove = () => {
    if (!current) return
    fieldArray.remove(current.index)
    setPosition(Math.max(position - 1, 0))
  }

  const errorNumbers = (type: BpAddressType) => {
    const list = Array.isArray(errors.addresses) ? errors.addresses : []
    return fieldArray.fields
      .map((field, index) => ({ field, index }))
      .filter(({ field }) => field.type === type)
      .flatMap(({ index }, n) => (list[index] ? [n + 1] : []))
  }

  const pick = tab === BP_ADDRESS_TYPES.BILLING ? defaultBillingName : defaultShippingName
  const isDefault = currentIndex !== undefined && isSameName(addresses[currentIndex]?.name, pick)

  return (
    <div className='flex flex-col gap-4'>
      {ADDRESS_TABS.map((type) => (
        <BpSectionError key={type} label={`${BP_ADDRESS_TYPE_LABELS[type].toLowerCase()} addresses`} numbers={errorNumbers(type)} />
      ))}

      <Tabs value={tab} onValueChange={(value) => setTab(value as BpAddressType)}>
        <TabsList>
          {ADDRESS_TABS.map((type) => (
            <TabsTrigger key={type} value={type}>
              {BP_ADDRESS_TYPE_LABELS[type]} ({fieldArray.fields.filter((f) => f.type === type).length})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <BpRecordPager
        title={`${BP_ADDRESS_TYPE_LABELS[tab]} Address`}
        code={current ? addresses[current.index]?.code : null}
        position={position}
        count={entries.length}
        isDefault={isDefault}
        isDisabled={isDisabled}
        onAdd={handleAdd}
        onRemove={handleRemove}
        onPrev={() => setPosition(position - 1)}
        onNext={() => setPosition(position + 1)}
      />

      {!current ? (
        <EmptyState
          title={`No ${BP_ADDRESS_TYPE_LABELS[tab].toLowerCase()} addresses`}
          description={`Add a ${BP_ADDRESS_TYPE_LABELS[tab].toLowerCase()} address for this record.`}
          icon={<Icons.mapPin />}
          className='min-h-48'
        >
          <Button type='button' variant='outline' size='sm' onClick={handleAdd} disabled={isDisabled}>
            <Icons.plus /> Add {BP_ADDRESS_TYPE_LABELS[tab]} Address
          </Button>
        </EmptyState>
      ) : (
        <Row key={current.field.fieldKey} gap={5}>
          <Column md={6} lg={3}>
            <InputField
              control={control}
              name={`addresses.${current.index}.name`}
              label='Name'
              description='Address unique name'
              isRequired
            />
          </Column>

          <Column>
            <InputField control={control} name={`addresses.${current.index}.line1`} label='Line 1' />
          </Column>

          <Column>
            <InputField control={control} name={`addresses.${current.index}.line2`} label='Line 2' />
          </Column>

          <Column>
            <InputField control={control} name={`addresses.${current.index}.line3`} label='Line 3' />
          </Column>

          <Column md={6} lg={3}>
            <InputField control={control} name={`addresses.${current.index}.streetNo`} label='Street No.' />
          </Column>

          <Column md={6} lg={3}>
            <InputField control={control} name={`addresses.${current.index}.buildingFloorRoom`} label='Building/Floor/Room' />
          </Column>

          <Column md={6} lg={3}>
            <InputField control={control} name={`addresses.${current.index}.block`} label='Block' />
          </Column>

          <Column md={6} lg={3}>
            <InputField control={control} name={`addresses.${current.index}.city`} label='City' />
          </Column>

          <Column md={6} lg={3}>
            <InputField control={control} name={`addresses.${current.index}.zipCode`} label='Zip Code' />
          </Column>

          <Column md={6} lg={3}>
            <ComboboxField
              control={control}
              type='Basic'
              name={`addresses.${current.index}.countryCode`}
              label='Country'
              data={countryOptions}
              searchKeys={['value']}
              renderItem={renderCodeItem}
              callback={({ value, item }) => {
                //* a state only means something within its country
                if ((item?.value ?? '') !== (value ?? '')) setValue(`addresses.${current.index}.stateCode`, '', { shouldDirty: true })
              }}
            />
          </Column>

          <Column md={6} lg={3}>
            <ComboboxField
              key={String(stateOptions.isLoading)}
              control={control}
              type='Basic'
              name={`addresses.${current.index}.stateCode`}
              label='State/Province'
              data={stateOptions.data}
              isLoading={stateOptions.isLoading}
              searchKeys={['value']}
              renderItem={renderCodeItem}
              placeholder={countryCode ? undefined : 'Select a country first'}
              extendedProps={{ comboboxInputProps: { disabled: !countryCode } }}
            />
          </Column>
        </Row>
      )}
    </div>
  )
}
