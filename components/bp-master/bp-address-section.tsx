'use client'

import { useState } from 'react'
import { UseFieldArrayReturn, useFormContext, useFormState, useWatch } from 'react-hook-form'

import { BpMasterFormValues, isSameName } from '@/schema/bp-master'
import { BP_ADDRESS_TYPE_LABELS, BP_ADDRESS_TYPES, BpAddressType } from '@/constants/bp-master'
import { FormOptions } from '@/types/common'
import type { SapSyncStatus } from '@/prisma/generated/enums'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Row } from '@/components/row'
import { Column } from '@/components/column'
import InputField from '@/components/forms/input-field'
import { ComboboxField } from '@/components/forms/combobox-field'
import { renderCodeItem } from '@/components/forms/combobox-item-content'
import { useStatesByCountry } from '@/hooks/safe-actions/bp-master'
import EmptyState from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import BpRecordPager from './bp-record-pager'
import BpSectionError from './bp-section-error'

type BpAddressSectionProps = {
  fieldArray: UseFieldArrayReturn<BpMasterFormValues, 'addresses', 'fieldKey'>
  countryOptions: FormOptions[]
  statusById: Record<string, SapSyncStatus>
  isDisabled?: boolean
  isReadOnly?: boolean
}

const ADDRESS_TABS = [BP_ADDRESS_TYPES.BILLING, BP_ADDRESS_TYPES.SHIPPING]

export function toEmptyAddress(type: BpAddressType): BpMasterFormValues['addresses'][number] {
  return {
    id: null,
    AddressName: '',
    AddrType: type,
    Street: '',
    Address2: '',
    Address3: '',
    StreetNo: '',
    BuildingFloorRoom: '',
    Block: '',
    City: '',
    ZipCode: '',
    County: '',
    CountryCode: '',
    StateCode: ''
  }
}

export default function BpAddressSection({ fieldArray, countryOptions, statusById, isDisabled, isReadOnly }: BpAddressSectionProps) {
  const { control, setValue } = useFormContext<BpMasterFormValues>()
  const { errors } = useFormState({ control, name: 'addresses' })

  const [tab, setTab] = useState<BpAddressType>(BP_ADDRESS_TYPES.BILLING)
  const [positions, setPositions] = useState<Record<BpAddressType, number>>({ B: 0, S: 0 })

  const [billToDef, shipToDef] = useWatch({ control, name: ['BillToDef', 'ShipToDef'] })
  const addresses = useWatch({ control, name: 'addresses' }) ?? []

  //* each tab is a view over one array, entries keep their real index
  const entries = fieldArray.fields.map((field, index) => ({ field, index })).filter(({ field }) => field.AddrType === tab)
  const position = Math.min(positions[tab], Math.max(entries.length - 1, 0))
  const current = entries[position]

  const currentIndex = current?.index
  const countryCode = currentIndex !== undefined ? addresses[currentIndex]?.CountryCode : null
  const states = useStatesByCountry(countryCode)
  const stateOptions = states.data.map((state) => ({ value: state.Code, label: state.Name }))

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
      .filter(({ field }) => field.AddrType === type)
      .flatMap(({ index }, n) => (list[index] ? [n + 1] : []))
  }

  const pick = tab === BP_ADDRESS_TYPES.BILLING ? billToDef : shipToDef
  const isDefault = currentIndex !== undefined && isSameName(addresses[currentIndex]?.AddressName, pick)
  const currentId = currentIndex !== undefined ? addresses[currentIndex]?.id : null

  return (
    <div className='flex flex-col gap-4'>
      {ADDRESS_TABS.map((type) => (
        <BpSectionError key={type} label={`${BP_ADDRESS_TYPE_LABELS[type].toLowerCase()} addresses`} numbers={errorNumbers(type)} />
      ))}

      <Tabs value={tab} onValueChange={(value) => setTab(value as BpAddressType)}>
        <TabsList>
          {ADDRESS_TABS.map((type) => (
            <TabsTrigger key={type} value={type}>
              {BP_ADDRESS_TYPE_LABELS[type]} ({fieldArray.fields.filter((f) => f.AddrType === type).length})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <BpRecordPager
        title={`${BP_ADDRESS_TYPE_LABELS[tab]} Address`}
        syncStatus={current ? ((currentId ? statusById[currentId] : null) ?? 'PENDING') : null}
        position={position}
        count={entries.length}
        isDefault={isDefault}
        isDisabled={isDisabled || isReadOnly}
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
          <Button type='button' variant='outline' size='sm' onClick={handleAdd} disabled={isDisabled || isReadOnly}>
            <Icons.plus /> Add {BP_ADDRESS_TYPE_LABELS[tab]} Address
          </Button>
        </EmptyState>
      ) : (
        //* a disabled fieldset locks every input inside it
        <fieldset key={current.field.fieldKey} disabled={isReadOnly} className='contents'>
          <Row gap={5}>
            <Column md={6} lg={3}>
              <InputField
                control={control}
                name={`addresses.${current.index}.AddressName`}
                label='Name'
                description='Address unique name'
                isRequired
              />
            </Column>

            <Column>
              <InputField control={control} name={`addresses.${current.index}.Street`} label='Street / PO Box' />
            </Column>

            <Column>
              <InputField control={control} name={`addresses.${current.index}.Address2`} label='Address 2' />
            </Column>

            <Column>
              <InputField control={control} name={`addresses.${current.index}.Address3`} label='Address 3' />
            </Column>

            <Column md={6} lg={3}>
              <InputField control={control} name={`addresses.${current.index}.StreetNo`} label='Street No.' />
            </Column>

            <Column md={6} lg={3}>
              <InputField control={control} name={`addresses.${current.index}.BuildingFloorRoom`} label='Building/Floor/Room' />
            </Column>

            <Column md={6} lg={3}>
              <InputField control={control} name={`addresses.${current.index}.Block`} label='Block' />
            </Column>

            <Column md={6} lg={3}>
              <InputField control={control} name={`addresses.${current.index}.City`} label='City' />
            </Column>

            <Column md={6} lg={3}>
              <InputField control={control} name={`addresses.${current.index}.ZipCode`} label='Zip Code' />
            </Column>

            <Column md={6} lg={3}>
              <InputField control={control} name={`addresses.${current.index}.County`} label='County' />
            </Column>

            <Column md={6} lg={3}>
              <ComboboxField
                control={control}
                type='Basic'
                name={`addresses.${current.index}.CountryCode`}
                label='Country'
                data={countryOptions}
                searchKeys={['value']}
                renderItem={renderCodeItem}
                callback={({ value, item }) => {
                  //* a state only means something within its country
                  if ((item?.value ?? '') !== (value ?? '')) setValue(`addresses.${current.index}.StateCode`, '', { shouldDirty: true })
                }}
              />
            </Column>

            <Column md={6} lg={3}>
              <ComboboxField
                key={String(states.isLoading)}
                control={control}
                type='Basic'
                name={`addresses.${current.index}.StateCode`}
                label='State/Province'
                data={stateOptions}
                isLoading={states.isLoading}
                searchKeys={['value']}
                renderItem={renderCodeItem}
                placeholder={countryCode ? undefined : 'Select a country first'}
                extendedProps={{ comboboxInputProps: { disabled: !countryCode || isReadOnly } }}
              />
            </Column>
          </Row>
        </fieldset>
      )}
    </div>
  )
}
