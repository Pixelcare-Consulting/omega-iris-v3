'use client'

import { FormProvider, useForm, useWatch } from 'react-hook-form'

import { type ExampleForm, exampleFormSchema, FAVORITE_COLORS, FRAMEWORK, GENDER, ITEMS } from '@/schema/examples'
import { zodResolver } from '@hookform/resolvers/zod'
import { FieldGroup } from '@/components/ui/field'
import InputField from '@/components/forms/input-field'
import LoadingButton from '@/components/forms/button-field'
import { Row } from '@/components/row'
import { Column } from '@/components/column'
import { Button } from '@/components/ui/button'
import { useEffect, useMemo, useState } from 'react'
import { FormDebug } from '@/components/forms/form-debug'
import { Icons } from '@/components/icons'
import TextareaField from '@/components/forms/textarea-field'
import { ComboboxField } from '@/components/forms/combobox-field'
import ComboboxItemContent from '@/components/forms/combobox-item-content'
import { ColorPickerField } from '@/components/forms/color-picker-field'
import { Badge } from '@/components/ui/badge'
import { BadgeColor } from '@/constants/color'
import DatePickerField from '@/components/forms/date-picker-field'
import TimeInputField from '@/components/forms/time-input-field'
import SwitchField from '@/components/forms/switch-field'
import CheckboxField from '@/components/forms/checkbox-field'
import CheckboxGroupField from '@/components/forms/checkbox-group-field'
import RadioGroupField from '@/components/forms/radio-group-field'
import FileUploaderField from '@/components/forms/file-uploader-field'
import ImageUploaderField from '@/components/forms/image-uploader-field'
import ReadOnlyField from '@/components/read-only-field'
import ReadOnlyFieldHeader from '@/components/read-only-field-header'
import Copy from '@/components/copy'
import { formatBadgeColorLabel } from '@/lib/color'

export default function ExampleForm() {
  const [showFormDebug, setShowFormDebug] = useState(false)

  const values = useMemo(() => {
    return {
      name: '',
      search: '',
      price: '',
      body: '',
      framework: '',
      item1: '',
      item2: '',
      item3: '',
      items: [],
      color: [],
      badgeColor: '',
      badgeColor2: 'soft-blue',
      date1: new Date(),
      date2: null,
      rangeDate1: {
        from: new Date(),
        to: new Date()
      },
      rangeDate2: {
        from: null,
        to: null
      },
      time: '',
      isAllowed: false,
      isAgree: false,
      isAccept: false,
      favoriteColors: [],
      gender: '',
      files: [],
      excelFiles: [],
      images: [],
      coverImage: null
    }
  }, [])

  const form = useForm({
    mode: 'onChange',
    values,
    resolver: zodResolver(exampleFormSchema)
  })

  const badgeColor = useWatch({ control: form.control, name: 'badgeColor' })

  const handleReset = () => {
    form.reset()
  }

  const handleOnSubmit = (formValues: ExampleForm) => {
    console.log({ formValues })
  }

  return (
    <FormProvider {...form}>
      <form className='rounded-lg border p-4 shadow-sm' onSubmit={form.handleSubmit(handleOnSubmit)}>
        {showFormDebug && <FormDebug form={form} />}

        <FieldGroup>
          <Row>
            <Column>
              <h1 className='col-span-12 text-lg font-bold'>Input Fields</h1>
            </Column>

            <Column md={4}>
              <InputField control={form.control} name='name' label='Name' placeholder='Enter name' />
            </Column>

            <Column md={4}>
              <InputField
                control={form.control}
                name='search'
                label='Search'
                placeholder='Search...'
                isWithAddon
                description='Search is optional'
                extendedProps={{
                  inputGroupAddonProps: {
                    align: 'inline-start',
                    children: <Icons.search className='text-muted-foreground' />
                  }
                }}
              />
            </Column>

            <Column md={4}>
              <InputField
                control={form.control}
                name='price'
                label='Price'
                placeholder='XX.XX'
                isWithAddon
                description='Price is optional'
                extendedProps={{
                  inputGroupInputProps: { type: 'number', step: 'any' },
                  inputGroupAddonProps: {
                    align: 'inline-end',
                    children: 'PHP'
                  }
                }}
              />
            </Column>

            <Column md={4}>
              <InputField
                control={form.control}
                name='name'
                label='Name'
                placeholder='Enter name'
                description='This is a disabled input field'
                extendedProps={{ inputProps: { disabled: true } }}
              />
            </Column>

            <Column>
              <h1 className='col-span-12 text-lg font-bold'>Textarea Fields</h1>
            </Column>

            <Column md={6}>
              <TextareaField
                control={form.control}
                name='body'
                label='Body'
                isRequired
                placeholder='Type your message here...'
                description='This textrea is not auto grow'
              />
            </Column>

            <Column md={6}>
              <TextareaField
                control={form.control}
                name='body'
                label='Body'
                isAutoGrow
                isRequired
                placeholder='Type your message here...'
                description='This textrea is auto grow'
                extendedProps={{ textareaProps: { className: 'max-h-40' } }}
              />
            </Column>

            <Column md={6}>
              <TextareaField
                control={form.control}
                name='body'
                label='Body'
                isRequired
                placeholder='Type your message here...'
                description='This textrea is disabled'
                extendedProps={{ textareaProps: { disabled: true } }}
              />
            </Column>

            <Column>
              <h1 className='col-span-12 text-lg font-bold'>Combobox</h1>
            </Column>

            <Column md={6}>
              <ComboboxField control={form.control} type='Basic' name='framework' label='Framework' data={FRAMEWORK} isRequired />
            </Column>

            <Column md={6}>
              <ComboboxField
                control={form.control}
                type='Basic'
                name='item1'
                label='Item 1'
                data={ITEMS}
                isRequired
                searchKeys={['itemName', 'itemDescription']}
                description='Combobox with search keys'
              />
            </Column>

            <Column md={6}>
              <ComboboxField
                control={form.control}
                type='Basic'
                name='item2'
                label='Item 2'
                description='Combobox with custom render item'
                data={ITEMS}
                isRequired
                searchKeys={['itemName', 'itemDescription']}
                renderItem={(item) => (
                  <ComboboxItemContent
                    label={item.label}
                    description={item?.itemDescription}
                    trailing={<span className='text-xs font-semibold'>#{item.value}</span>}
                  />
                )}
              />
            </Column>

            <Column md={6}>
              <ComboboxField
                control={form.control}
                type='Multiple'
                name='color'
                label='Favorite Color'
                data={FAVORITE_COLORS}
                isRequired
                description='Combobox with multiple selection'
              />
            </Column>

            <Column md={6}>
              <ComboboxField
                control={form.control}
                type='Multiple'
                name='items'
                label='Items'
                description='Combobox with multiple selection and with custom render item'
                data={ITEMS}
                searchKeys={['itemName', 'itemDescription']}
                isRequired
                renderItem={(item) => (
                  <ComboboxItemContent
                    label={item.label}
                    description={item?.itemDescription}
                    trailing={<span className='text-xs font-semibold'>#{item.value}</span>}
                  />
                )}
              />
            </Column>

            <Column md={6}>
              <ComboboxField
                control={form.control}
                type='Basic'
                name='item3'
                label='Item 3'
                description='Custom render item with extra lines and a badge'
                data={ITEMS}
                isRequired
                searchKeys={['itemName', 'itemDescription']}
                renderItem={(item) => (
                  <ComboboxItemContent
                    label={item.itemName}
                    description={item?.itemDescription}
                    //* any extra row goes in `lines`, the component needs no new prop for it
                    lines={[
                      <span key='price' className='text-muted-foreground text-xs'>
                        ₱{item.unitPrice?.toLocaleString()} · qty {item.quantity}
                      </span>
                    ]}
                    trailing={<Badge variant='soft-slate'>{item.label}</Badge>}
                  />
                )}
              />
            </Column>

            <Column md={6}>
              <ComboboxField
                control={form.control}
                type='Basic'
                name='item1'
                label='Item 1'
                data={ITEMS}
                isRequired
                searchKeys={['itemName', 'itemDescription']}
                description='This combobox is disabled'
                extendedProps={{ comboboxInputProps: { disabled: true } }}
              />
            </Column>

            <Column>
              <h1 className='col-span-12 text-lg font-bold'>Color Picker</h1>
            </Column>

            <Column md={6}>
              <ColorPickerField
                control={form.control}
                name='badgeColor'
                label='Badge Color'
                isRequired
                description='Single select color picker, tabbed by badge color family — resolves to a badge variant (e.g. soft-blue)'
              />
            </Column>

            <Column md={6}>
              <ColorPickerField
                control={form.control}
                name='badgeColor2'
                label='Badge Color'
                description='Pre-selected with soft-blue, so the popup opens on the Soft tab'
              />
            </Column>

            <Column md={6}>
              <ColorPickerField
                control={form.control}
                name='badgeColor2'
                label='Badge Color'
                description='This color picker is disabled'
                disabled
              />
            </Column>

            <Column md={6}>
              <ColorPickerField
                control={form.control}
                name='badgeColor'
                label='Badge Color'
                isRequired
                description='With a callback and a preview of the selected badge variant'
                callback={(args: { value: string; color: string }) => console.log(args)}
                extendedProps={{
                  fieldDescriptionProps: { className: 'flex items-center gap-1.5' },
                  popoverContentProps: { align: 'end' }
                }}
              />
            </Column>

            <Column md={6}>
              <div className='flex items-center gap-2'>
                <span className='text-sm font-medium'>Preview:</span>

                {badgeColor ? (
                  <Badge variant={badgeColor as BadgeColor}>{formatBadgeColorLabel(badgeColor)}</Badge>
                ) : (
                  <span className='text-muted-foreground text-sm'>No color selected</span>
                )}
              </div>
            </Column>

            <Column>
              <h1 className='col-span-12 text-lg font-bold'>Date Picker & Time Picker</h1>
            </Column>

            <Column md={6}>
              <DatePickerField
                control={form.control}
                name='date1'
                label='Date 1'
                isRequired
                description='Date is required'
                extendedProps={{
                  calendarProps: {
                    mode: 'single',
                    startMonth: new Date(1800, 0),
                    captionLayout: 'dropdown'
                  }
                }}
              />
            </Column>

            <Column md={6}>
              <DatePickerField
                control={form.control}
                name='date2'
                label='Date 2'
                description='Date is optional'
                extendedProps={{
                  calendarProps: {
                    mode: 'single',
                    startMonth: new Date(1800, 0),
                    captionLayout: 'dropdown'
                  }
                }}
              />
            </Column>

            <Column md={6}>
              <DatePickerField
                control={form.control}
                name='rangeDate1'
                label='Range'
                description='Range Date 1 is required'
                isRequired
                extendedProps={{
                  calendarProps: {
                    mode: 'range',
                    startMonth: new Date(1800, 0),
                    captionLayout: 'dropdown',
                    numberOfMonths: 2
                  }
                }}
              />
            </Column>

            <Column md={6}>
              <DatePickerField
                control={form.control}
                name='rangeDate2'
                label='Range'
                description='Range Date 2 is optional'
                extendedProps={{
                  calendarProps: {
                    mode: 'range',
                    startMonth: new Date(1800, 0),
                    captionLayout: 'dropdown',
                    numberOfMonths: 2
                  }
                }}
              />
            </Column>

            <Column md={6}>
              <DatePickerField
                control={form.control}
                name='date1'
                label='Date 1'
                isRequired
                description='This date picker is disabled'
                extendedProps={{
                  calendarProps: {
                    mode: 'single',
                    startMonth: new Date(1800, 0),
                    captionLayout: 'dropdown'
                  },
                  buttonProps: { disabled: true }
                }}
              />
            </Column>

            <Column md={6}>
              <DatePickerField
                control={form.control}
                name='date2'
                label='Date & Time'
                isWithTime
                description='This date picker carries a time, set from the input below the calendar'
                extendedProps={{
                  calendarProps: {
                    mode: 'single',
                    startMonth: new Date(1800, 0),
                    captionLayout: 'dropdown'
                  }
                }}
              />
            </Column>

            <Column md={4}>
              <TimeInputField control={form.control} name='time' label='Time' isRequired />
            </Column>

            <Column>
              <h1 className='col-span-12 text-lg font-bold'>Switch</h1>
            </Column>

            <Column md={6}>
              <SwitchField
                control={form.control}
                name='isAllowed'
                label='Is Allowed'
                description='This is an optional switch field (Default Layout)'
              />
            </Column>

            <Column md={6}>
              <SwitchField
                control={form.control}
                name='isAllowed'
                layout='wide'
                label='Is Allowed'
                description='This is an optional switch field (Wide Layout)'
              />
            </Column>

            <Column md={6}>
              <SwitchField
                control={form.control}
                name='isAllowed'
                layout='choice-card'
                label='Is Allowed'
                description='This is an optional switch field (choice-card Layout)'
              />
            </Column>

            <Column md={6}>
              <SwitchField
                control={form.control}
                name='isAgree'
                layout='default'
                label='Agree to the terms'
                isRequired
                description='This is an required switch field (default Layout)'
              />
            </Column>

            <Column md={6}>
              <SwitchField
                control={form.control}
                name='isAgree'
                layout='default'
                label='Agree to the terms'
                isRequired
                description='This is an required switch field (default Layout), disabled'
                extendedProps={{ switchProps: { disabled: true } }}
              />
            </Column>

            <Column>
              <h1 className='col-span-12 text-lg font-bold'>Checkbox</h1>
            </Column>

            <Column md={6}>
              <CheckboxField
                control={form.control}
                name='isAccept'
                label='Accept the agreement'
                description='This is an optional checkbox field'
              />
            </Column>

            <Column md={6}>
              <CheckboxField
                control={form.control}
                name='isAgree'
                label='Agree to the terms'
                isRequired
                description='This is an required checkbox field'
              />
            </Column>

            <Column md={6}>
              <CheckboxField
                control={form.control}
                name='isAccept'
                label='Accept the agreement'
                description='This is an optional checkbox field (disabled)'
                extendedProps={{ checkboxProps: { disabled: true } }}
              />
            </Column>

            <Column>
              <h1 className='col-span-12 text-lg font-bold'>Checkbox Group</h1>
            </Column>

            <Column>
              <CheckboxGroupField
                control={form.control}
                name='favoriteColors'
                label='Favorite Colors'
                description='This is required checkbox group field (horizontal)'
                isRequired
                data={FAVORITE_COLORS}
              />
            </Column>

            <Column>
              <CheckboxGroupField
                control={form.control}
                name='favoriteColors'
                label='Favorite Colors'
                description='This is required checkbox group field (vertical)'
                direction='vertical'
                isRequired
                data={FAVORITE_COLORS}
              />
            </Column>

            <Column>
              <CheckboxGroupField
                control={form.control}
                name='favoriteColors'
                label='Favorite Colors'
                description='This is required checkbox group field (horizontal)(disabled)'
                isRequired
                data={FAVORITE_COLORS}
                extendedProps={{ checkboxProps: { disabled: true } }}
              />
            </Column>

            <Column>
              <h1 className='col-span-12 text-lg font-bold'>Radio Group</h1>
            </Column>

            <Column>
              <RadioGroupField
                control={form.control}
                name='gender'
                label='Gender'
                description='This is required radio group field (horizontal)'
                isRequired
                data={GENDER}
              />
            </Column>

            <Column>
              <RadioGroupField
                control={form.control}
                name='gender'
                label='Gender'
                direction='vertical'
                description='This is required radio group field (vertical)'
                isRequired
                data={GENDER}
              />
            </Column>

            <Column>
              <RadioGroupField
                control={form.control}
                name='gender'
                label='Gender'
                direction='horizontal'
                description='This is required radio group field (horizontal) (disabled)'
                isRequired
                data={GENDER}
                extendedProps={{ radioGroupProps: { disabled: true } }}
              />
            </Column>

            <Column>
              <h1 className='col-span-12 text-lg font-bold'>File Uploader</h1>
            </Column>

            <Column>
              <FileUploaderField
                control={form.control}
                name='files'
                label='Files'
                description='This is required file uploader field (vertical)'
                direction='vertical'
                isRequired
                listContainerClassName='max-h-80'
                maxSize={4}
              />
            </Column>

            <Column>
              <FileUploaderField
                control={form.control}
                name='excelFiles'
                label='Excel Files'
                description='This is required file uploader field, with custom onFileValidate, allow only xlsx or xls and limit 5 files, max size is 5MB (horizontal)'
                direction='horizontal'
                isRequired
                listContainerClassName='max-h-80'
                maxSize={5}
                extendedProps={{
                  fileUploaderProps: {
                    accept: 'application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    onFileValidate: (file) => {
                      const LIMIT = 5 * 1024 * 1024 //* 5 MB
                      const ALLOWED_TYPES = [
                        'application/vnd.ms-excel',
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                      ]

                      if (file.size > LIMIT) return 'File size must be less than 5MB'
                      if (!ALLOWED_TYPES.includes(file.type)) return 'Only .xlsx or .xls file is supported!'

                      return null
                    }
                  }
                }}
              />
            </Column>

            <Column>
              <FileUploaderField
                control={form.control}
                name='excelFiles'
                label='Excel Files'
                description='This is required file uploader field, with custom onFileValidate, allow only xlsx or xls and limit 5 files, max size is 5MB (horizontal) (disabled)'
                direction='horizontal'
                isRequired
                listContainerClassName='max-h-80'
                maxSize={5}
                extendedProps={{ fileUploaderProps: { disabled: true } }}
              />
            </Column>

            <Column>
              <h1 className='col-span-12 text-lg font-bold'>Image Uploader</h1>
            </Column>

            <Column>
              <ImageUploaderField
                control={form.control}
                name='images'
                label='Images'
                description='This is required image uploader field (vertical) (multiple) only support image type, image uploader is almost the same with file uploader'
                direction='vertical'
                isRequired
                listContainerClassName='max-h-80'
                maxSize={5}
                isMultiple
                extendedProps={{
                  fileUploaderProps: {
                    onFileValidate: (file) => {
                      const LIMIT = 5 * 1024 * 1024 //* 5 MB

                      if (file.size > LIMIT) return 'File size must be less than 5MB'
                      if (!file.type.includes('image/')) return 'Only image file is supported!'

                      return null
                    }
                  }
                }}
              />
            </Column>

            <Column>
              <ImageUploaderField
                control={form.control}
                name='coverImage'
                label='Cover Image'
                description='This is required image uploader field (not multiple) only support image type, image uploader is almost the same with file uploader'
                direction='vertical'
                isRequired
                triggerContainerClassName='h-80'
                maxSize={5}
                extendedProps={{
                  fileUploaderProps: {
                    onFileValidate: (file) => {
                      const LIMIT = 5 * 1024 * 1024 //* 5 MB

                      if (file.size > LIMIT) return 'File size must be less than 5MB'
                      if (!file.type.includes('image/')) return 'Only image file is supported!'

                      return null
                    }
                  }
                }}
              />
            </Column>

            <Column>
              <ReadOnlyFieldHeader title='Read Only Fields' description='This is a read only field header' />
            </Column>

            <Column md={6}>
              <ReadOnlyField title='Name' value='John Doe' description='This is a read only field' />
            </Column>

            <Column md={6}>
              <ReadOnlyField title='Relation' value='John Doe' description='This is a read only field' isLoading />
            </Column>

            <ReadOnlyField title='ID' value='1234567890' description='This is a read only field, with copy button'>
              <Copy value='1234567890' />
            </ReadOnlyField>

            <Column className='flex items-center justify-end gap-2.5'>
              <Button type='button' size='lg' variant='outline' onClick={() => setShowFormDebug(!showFormDebug)}>
                {showFormDebug ? 'Hide' : 'Show'}
              </Button>

              <Button type='button' size='lg' variant='outline' onClick={handleReset}>
                Reset
              </Button>

              <LoadingButton type='submit' size='lg'>
                Submit
              </LoadingButton>
            </Column>
          </Row>
        </FieldGroup>
      </form>
    </FormProvider>
  )
}
