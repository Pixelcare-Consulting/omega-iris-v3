'use client'

import { useMemo } from 'react'

import { Control, Controller, FieldPath, FieldValues, get, useFormContext, useWatch } from 'react-hook-form'
import { Field, FieldLabel, FieldDescription, FieldError } from '../ui/field'
import {
  FormExtendedProps,
  ComboboxValueProps,
  ComboboxTriggerProps,
  ComboboxClearProps,
  ComboboxInputProps,
  ComboboxContentProps,
  ComboboxListProps,
  ComboboxItemProps,
  ComboboxGroupProps,
  ComboboxLabelProps,
  ComboboxEmptyProps,
  ComboboxCollectionProps,
  ComboboxSeparatorProps,
  ComboboxChipsProps,
  ComboboxChipProps,
  ComboboxChipsInputProps,
  FormOptions,
  ComboboxPorps
} from '@/types/common'
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor
} from '@/components/ui/combobox'
import { InputGroup, InputGroupAddon, InputGroupInput } from '../ui/input-group'
import { Icons } from '../icons'

type ExtendedProps = FormExtendedProps & {
  comboboxPorps?: ComboboxPorps
  comboboxValueProps?: ComboboxValueProps
  comboboxTriggerProps?: ComboboxTriggerProps
  comboboxClearProps?: ComboboxClearProps
  comboboxInputProps?: ComboboxInputProps
  comboboxContentProps?: ComboboxContentProps
  comboboxListProps?: ComboboxListProps
  comboboxItemProps?: ComboboxItemProps
  comboboxGroupProps?: ComboboxGroupProps
  comboboxLabelProps?: ComboboxLabelProps
  comboboxEmptyProps?: ComboboxEmptyProps
  comboboxCollectionProps?: ComboboxCollectionProps
  comboboxSeparatorProps?: ComboboxSeparatorProps
  comboboxChipsProps?: ComboboxChipsProps
  comboboxChipProps?: ComboboxChipProps
  comboboxChipsInputProps?: ComboboxChipsInputProps
}

type ComboboxFieldProps<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>> = {
  control: Control<TFieldValues>
  name: TName
  label: string
  type: 'Basic' | 'Multiple' | 'Group-Collection'
  description?: string
  placeholder?: string
  isRequired?: boolean
  isHideLabel?: boolean
  data: FormOptions[]
  isLoading?: boolean
  searchKeys?: string[]
  renderItem?: (item: FormOptions) => React.ReactNode
  callback?: (...args: any[]) => void
  extendedProps?: ExtendedProps
}

export function ComboboxField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  description,
  isRequired,
  isHideLabel,
  data,
  isLoading,
  type,
  searchKeys = [],
  renderItem,
  callback,
  extendedProps
}: ComboboxFieldProps<T>) {
  const anchor = useComboboxAnchor()

  const items = useMemo(() => {
    if (isLoading || data.length < 1) return []
    return data
  }, [isLoading, data])

  const handleFilter = (itemValue: any, query: string, _itemToString: ((itemValue: any) => string) | undefined): boolean => {
    const keys = ['label', ...searchKeys]
    const search = query.toLowerCase()

    //* filter items based on search query and search keys specified
    //* `get` reads dot paths, so a search key can point inside a nested object (e.g. 'position.name')
    return keys.some((key) => {
      const value = get(itemValue, key)

      if (value === null || value === undefined) return false

      //* an array key (e.g. 'tags') matches when any of its entries does
      if (Array.isArray(value)) return value.some((entry) => String(entry ?? '').toLowerCase().includes(search)) // prettier-ignore

      return String(value).toLowerCase().includes(search)
    })
  }

  if (type === 'Basic') {
    return (
      <Controller
        name={name}
        control={control}
        render={({ field, fieldState, formState: { errors } }) => {
          const value = field.value
          const fieldError = get(errors, name)
          const isValid = !!fieldError

          const selectedItem = items.find((item) => item.value == value) ?? ''

          return (
            <Field
              {...extendedProps?.fieldProps}
              data-disabled={extendedProps?.comboboxInputProps?.disabled}
              data-invalid={fieldState.invalid}
            >
              {!isHideLabel && label && (
                <FieldLabel
                  {...extendedProps?.fieldLabelProps}
                  isDisabled={extendedProps?.comboboxInputProps?.disabled}
                  isRequired={isRequired}
                  htmlFor={field.name}
                >
                  {label}
                </FieldLabel>
              )}

              <Combobox
                {...extendedProps?.comboboxPorps}
                items={items}
                itemToStringValue={(item: any) => item?.label}
                value={selectedItem}
                onValueChange={(item: any) => {
                  field.onChange(item?.value ?? '')
                  if (callback) callback({ value, item })
                }}
                filter={handleFilter}
              >
                {!isLoading ? (
                  <ComboboxInput
                    {...extendedProps?.comboboxInputProps}
                    placeholder={placeholder ?? `Select a ${label.toLowerCase()}`}
                    aria-invalid={isValid}
                    showClear
                  />
                ) : (
                  <InputGroup>
                    <InputGroupInput placeholder='Loading...' disabled />
                    <InputGroupAddon align='inline-end'>
                      <Icons.spinner className='size-4 animate-spin' />
                    </InputGroupAddon>
                  </InputGroup>
                )}

                <ComboboxContent {...extendedProps?.comboboxContentProps}>
                  {isLoading ? (
                    <ComboboxEmpty>Loading...</ComboboxEmpty>
                  ) : (
                    <ComboboxEmpty {...extendedProps?.comboboxEmptyProps}>No {label.toLowerCase()} found.</ComboboxEmpty>
                  )}

                  <ComboboxList {...extendedProps?.comboboxListProps}>
                    {(items) => (
                      <ComboboxItem {...extendedProps?.comboboxItemProps} key={items.value} value={items}>
                        {/* //* min-w-0 lets long children shrink instead of pushing past the popover */}
                        {renderItem ? <div className='flex w-full min-w-0 items-center gap-2'>{renderItem(items)}</div> : items.label}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>

              {description && <FieldDescription {...extendedProps?.fieldDescriptionProps}>{description}</FieldDescription>}
              {fieldState.invalid && <FieldError {...extendedProps?.fieldErrorProps} errors={[fieldState.error]} />}
            </Field>
          )
        }}
      />
    )
  }

  if (type === 'Multiple') {
    return (
      <Controller
        name={name}
        control={control}
        render={({ field, fieldState, formState: { errors } }) => {
          const value = field.value as any[]
          const fieldError = get(errors, name)
          const isValid = !!fieldError

          //* mapped from the value, not filtered from the options, the field keeps the order it was given
          const selectedItems = value
            .map((selected) => items.find((item) => item.value === selected))
            .filter((item): item is FormOptions => Boolean(item))

          return (
            <Field
              {...extendedProps?.fieldProps}
              data-disabled={extendedProps?.comboboxChipsInputProps?.disabled}
              data-invalid={fieldState.invalid}
            >
              {!isHideLabel && label && (
                <FieldLabel
                  {...extendedProps?.fieldLabelProps}
                  isRequired={isRequired}
                  isDisabled={extendedProps?.comboboxChipsInputProps?.disabled}
                  htmlFor={field.name}
                >
                  {label}
                </FieldLabel>
              )}

              <Combobox
                {...extendedProps?.comboboxPorps}
                multiple
                items={items}
                itemToStringValue={(item: any) => item?.label}
                value={selectedItems as unknown[]}
                defaultValue={[]}
                onValueChange={(items: any[]) => field.onChange(items.map((i) => i?.value).filter(Boolean))}
                filter={handleFilter}
              >
                {!isLoading ? (
                  <ComboboxChips {...extendedProps?.comboboxChipsProps} ref={anchor}>
                    <ComboboxValue {...extendedProps?.comboboxValueProps}>
                      {() => (
                        <>
                          {selectedItems.map((item: any, i) => (
                            <ComboboxChip key={`${item?.value}-${i}-${item?.label}`}>{item?.label}</ComboboxChip>
                          ))}
                          <ComboboxChipsInput
                            {...extendedProps?.comboboxChipsInputProps}
                            placeholder={placeholder ?? `Select a ${label.toLowerCase()}`}
                            aria-invalid={isValid}
                          />
                        </>
                      )}
                    </ComboboxValue>
                  </ComboboxChips>
                ) : (
                  <InputGroup>
                    <InputGroupInput placeholder='Loading...' disabled />
                    <InputGroupAddon align='inline-end'>
                      <Icons.spinner className='size-4 animate-spin' />
                    </InputGroupAddon>
                  </InputGroup>
                )}

                <ComboboxContent {...extendedProps?.comboboxContentProps} anchor={anchor}>
                  {isLoading ? (
                    <ComboboxEmpty>Loading...</ComboboxEmpty>
                  ) : (
                    <ComboboxEmpty {...extendedProps?.comboboxEmptyProps}>No {label.toLowerCase()} found.</ComboboxEmpty>
                  )}

                  <ComboboxList {...extendedProps?.comboboxListProps}>
                    {(items) => (
                      <ComboboxItem {...extendedProps?.comboboxItemProps} key={items.value} value={items}>
                        {/* //* min-w-0 lets long children shrink instead of pushing past the popover */}
                        {renderItem ? <div className='flex w-full min-w-0 items-center gap-2'>{renderItem(items)}</div> : items.label}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>

              {description && <FieldDescription {...extendedProps?.fieldDescriptionProps}>{description}</FieldDescription>}
              {fieldState.invalid && <FieldError {...extendedProps?.fieldErrorProps} errors={[fieldState.error]} />}
            </Field>
          )
        }}
      />
    )
  }
}
