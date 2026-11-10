'use client'

import { useState } from 'react'
import { UseFieldArrayReturn, useFormContext, useFormState, useWatch } from 'react-hook-form'

import { BpMasterFormValues, isSameName } from '@/schema/bp-master'
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
  isDisabled?: boolean
}

export function toEmptyContact(): BpMasterFormValues['contacts'][number] {
  return { id: null, code: null, name: '', email: '', title: '', position: '', tel1: '', tel2: '', phone: '' }
}

export default function BpContactSection({ fieldArray, isDisabled }: BpContactSectionProps) {
  const { control } = useFormContext<BpMasterFormValues>()
  const { errors } = useFormState({ control, name: 'contacts' })

  const [position, setPosition] = useState(0)

  const defaultContactName = useWatch({ control, name: 'defaultContactName' })
  const contacts = useWatch({ control, name: 'contacts' }) ?? []

  const count = fieldArray.fields.length
  const index = Math.min(position, Math.max(count - 1, 0))
  const current = fieldArray.fields[index]

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
        code={current ? contacts[index]?.code : null}
        position={index}
        count={count}
        isDefault={!!current && isSameName(contacts[index]?.name, defaultContactName)}
        isDisabled={isDisabled}
        onAdd={handleAdd}
        onRemove={handleRemove}
        onPrev={() => setPosition(index - 1)}
        onNext={() => setPosition(index + 1)}
      />

      {!current ? (
        <EmptyState title='No contacts' description='Add a contact person for this record.' icon={<Icons.contact />} className='min-h-48'>
          <Button type='button' variant='outline' size='sm' onClick={handleAdd} disabled={isDisabled}>
            <Icons.plus /> Add Contact
          </Button>
        </EmptyState>
      ) : (
        <Row key={current.fieldKey} gap={5}>
          <Column md={6} lg={3}>
            <InputField control={control} name={`contacts.${index}.name`} label='Name' description='Contact unique name' isRequired />
          </Column>

          <Column md={6} lg={3}>
            <InputField control={control} name={`contacts.${index}.email`} label='Email' />
          </Column>

          <Column md={6} lg={3}>
            <InputField control={control} name={`contacts.${index}.title`} label='Title' />
          </Column>

          <Column md={6} lg={3}>
            <InputField control={control} name={`contacts.${index}.position`} label='Position' />
          </Column>

          <Column md={6} lg={3}>
            <InputField control={control} name={`contacts.${index}.tel1`} label='Tel 1' />
          </Column>

          <Column md={6} lg={3}>
            <InputField control={control} name={`contacts.${index}.tel2`} label='Tel 2' />
          </Column>

          <Column md={6} lg={3}>
            <InputField control={control} name={`contacts.${index}.phone`} label='Mobile Phone' />
          </Column>
        </Row>
      )}
    </div>
  )
}
