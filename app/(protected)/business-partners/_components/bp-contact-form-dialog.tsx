'use client'

import { useMemo } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import Modal from '@/components/modal'
import { Row } from '@/components/row'
import { Column } from '@/components/column'
import InputField from '@/components/forms/input-field'
import TextareaField from '@/components/forms/textarea-field'
import SwitchField from '@/components/forms/switch-field'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { FieldGroup } from '@/components/ui/field'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ContactEmployeeForm, contactEmployeeFormSchema } from '@/schema/business-partner'

type BPContactFormDialogProps = {
  isOpen: boolean
  contact: ContactEmployeeForm | null
  otherContacts: ContactEmployeeForm[] //* every row except the one being edited, for the unique check
  onClose: () => void
  onSave: (contact: ContactEmployeeForm) => void
}

const FORM_ID = 'bp-contact-form'

const DEFAULT_VALUES: ContactEmployeeForm = {
  Name: '',
  Title: '',
  Position: '',
  E_Mail: '',
  Address: '',
  Phone1: '',
  Phone2: '',
  MobilePhone: '',
  Active: true
}

export default function BPContactFormDialog({ isOpen, contact, otherContacts, onClose, onSave }: BPContactFormDialogProps) {
  const isCreate = !contact

  const values = useMemo(() => (contact ? { ...DEFAULT_VALUES, ...contact } : DEFAULT_VALUES), [contact])

  const form = useForm({ mode: 'onChange', values, resolver: zodResolver(contactEmployeeFormSchema) })

  const handleSave = (formValues: ContactEmployeeForm) => {
    if (otherContacts.some((other) => other.Name.toLowerCase() === formValues.Name.toLowerCase())) {
      form.setError('Name', { type: 'custom', message: 'Contact ID already exists' })
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
      title={isCreate ? 'Add Contact Person' : 'Edit Contact Person'}
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
                  <InputField control={form.control} name='Name' label='Contact ID' isRequired />
                </Column>

                <Column md={6}>
                  <InputField control={form.control} name='Title' label='Title' />
                </Column>

                <Column md={6}>
                  <InputField control={form.control} name='Position' label='Position' />
                </Column>

                <Column md={6}>
                  <InputField control={form.control} name='E_Mail' label='E-Mail' />
                </Column>

                <Column md={4}>
                  <InputField control={form.control} name='Phone1' label='Tel 1' />
                </Column>

                <Column md={4}>
                  <InputField control={form.control} name='Phone2' label='Tel 2' />
                </Column>

                <Column md={4}>
                  <InputField control={form.control} name='MobilePhone' label='Mobile Phone' />
                </Column>

                <Column>
                  <TextareaField control={form.control} name='Address' label='Address' />
                </Column>

                <Column md={6}>
                  <SwitchField
                    control={form.control}
                    name='Active'
                    label='Active'
                    layout='choice-card'
                    description='Is this contact active?'
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
