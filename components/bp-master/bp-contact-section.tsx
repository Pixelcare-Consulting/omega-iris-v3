'use client'

import { useState } from 'react'
import { UseFieldArrayReturn, useFormContext, useFormState, useWatch } from 'react-hook-form'

import { BpMasterFormValues, isSameName } from '@/schema/bp-master'
import type { SapSyncStatus } from '@/prisma/generated/enums'
import { Row } from '@/components/row'
import { Column } from '@/components/column'
import InputField from '@/components/forms/input-field'
import EmptyState from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import BpRecordPager from './bp-record-pager'
import BpSectionError from './bp-section-error'

type BpContactSectionProps = {
  fieldArray: UseFieldArrayReturn<BpMasterFormValues, 'contacts', 'fieldKey'>
  statusById: Record<string, SapSyncStatus>
  isDisabled?: boolean
  isReadOnly?: boolean
}

export function toEmptyContact(): BpMasterFormValues['contacts'][number] {
  return {
    id: null,
    ContactName: '',
    FirstName: '',
    LastName: '',
    Title: '',
    Position: '',
    Phone1: '',
    Phone2: '',
    MobilePhone: '',
    Email: ''
  }
}

export default function BpContactSection({ fieldArray, statusById, isDisabled, isReadOnly }: BpContactSectionProps) {
  const { control } = useFormContext<BpMasterFormValues>()
  const { errors } = useFormState({ control, name: 'contacts' })

  const [position, setPosition] = useState(0)

  const cntctPrsn = useWatch({ control, name: 'CntctPrsn' })
  const contacts = useWatch({ control, name: 'contacts' }) ?? []

  const count = fieldArray.fields.length
  const index = Math.min(position, Math.max(count - 1, 0))
  const current = fieldArray.fields[index]
  const currentId = current ? contacts[index]?.id : null

  const handleAdd = () => {
    fieldArray.append(toEmptyContact(), { shouldFocus: false })
    setPosition(count)
  }

  const handleRemove = () => {
    if (!current) return
    fieldArray.remove(index)
    setPosition(Math.max(index - 1, 0))
  }

  const list = Array.isArray(errors.contacts) ? errors.contacts : []
  const errorNumbers = fieldArray.fields.flatMap((_, i) => (list[i] ? [i + 1] : []))

  return (
    <div className='flex flex-col gap-4'>
      <BpSectionError label='contacts' numbers={errorNumbers} />

      <BpRecordPager
        title='Contact'
        syncStatus={current ? ((currentId ? statusById[currentId] : null) ?? 'PENDING') : null}
        position={index}
        count={count}
        isDefault={!!current && isSameName(contacts[index]?.ContactName, cntctPrsn)}
        isDisabled={isDisabled || isReadOnly}
        onAdd={handleAdd}
        onRemove={handleRemove}
        onPrev={() => setPosition(index - 1)}
        onNext={() => setPosition(index + 1)}
      />

      {!current ? (
        <EmptyState title='No contacts' description='Add a contact person for this record.' icon={<Icons.contact />} className='min-h-48'>
          <Button type='button' variant='outline' size='sm' onClick={handleAdd} disabled={isDisabled || isReadOnly}>
            <Icons.plus /> Add Contact
          </Button>
        </EmptyState>
      ) : (
        //* a disabled fieldset locks every input inside it
        <fieldset key={current.fieldKey} disabled={isReadOnly} className='contents'>
          <Row gap={5}>
            <Column md={6} lg={3}>
              <InputField
                control={control}
                name={`contacts.${index}.ContactName`}
                label='Contact ID'
                description='Contact unique name'
                isRequired
              />
            </Column>

            <Column md={6} lg={3}>
              <InputField control={control} name={`contacts.${index}.FirstName`} label='First Name' />
            </Column>

            <Column md={6} lg={3}>
              <InputField control={control} name={`contacts.${index}.LastName`} label='Last Name' />
            </Column>

            <Column md={6} lg={3}>
              <InputField control={control} name={`contacts.${index}.Email`} label='Email' />
            </Column>

            <Column md={6} lg={3}>
              <InputField control={control} name={`contacts.${index}.Title`} label='Title' />
            </Column>

            <Column md={6} lg={3}>
              <InputField control={control} name={`contacts.${index}.Position`} label='Position' />
            </Column>

            <Column md={6} lg={3}>
              <InputField control={control} name={`contacts.${index}.Phone1`} label='Tel 1' />
            </Column>

            <Column md={6} lg={3}>
              <InputField control={control} name={`contacts.${index}.Phone2`} label='Tel 2' />
            </Column>

            <Column md={6} lg={3}>
              <InputField control={control} name={`contacts.${index}.MobilePhone`} label='Mobile Phone' />
            </Column>
          </Row>
        </fieldset>
      )}
    </div>
  )
}
