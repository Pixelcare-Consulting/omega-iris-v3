'use client'

import { Control, Controller, FieldPath, FieldValues } from 'react-hook-form'

import { cn } from '@/lib/utils'
import { Field, FieldLabel, FieldDescription, FieldError } from '../ui/field'
import { FormExtendedProps, InputProps } from '@/types/common'
import { Input } from '../ui/input'

type ExtendedProps = FormExtendedProps & { inputProps?: InputProps }

type TimeInputFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> = {
  control: Control<TFieldValues>
  name: TName
  label?: string
  description?: string
  isRequired?: boolean
  isHideLabel?: boolean
  extendedProps?: ExtendedProps
}

export default function TimeInputField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  isRequired,
  isHideLabel,
  extendedProps
}: TimeInputFieldProps<T>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field {...extendedProps?.fieldProps} data-disabled={extendedProps?.inputProps?.disabled} data-invalid={fieldState.invalid}>
          {!isHideLabel && label && (
            <FieldLabel {...extendedProps?.fieldLabelProps} isRequired={isRequired} htmlFor={field.name}>
              {label}
            </FieldLabel>
          )}

          <Input
            {...field}
            {...extendedProps?.inputProps}
            id={field.name}
            type='time'
            step={60}
            className={cn(
              'bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none',
              extendedProps?.inputProps?.className
            )}
            aria-invalid={fieldState.invalid}
            autoComplete='off'
          />

          {description && <FieldDescription {...extendedProps?.fieldDescriptionProps}>{description}</FieldDescription>}
          {fieldState.invalid && <FieldError {...extendedProps?.fieldErrorProps} errors={[fieldState.error]} />}
        </Field>
      )}
    />
  )
}
