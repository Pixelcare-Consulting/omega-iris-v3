'use client'

import { ChangeEvent } from 'react'
import { Control, Controller, FieldPath, FieldValues } from 'react-hook-form'

import { cn } from '@/lib/utils'
import { Field, FieldLabel, FieldDescription, FieldError } from '../ui/field'
import { FormExtendedProps, TextAreaProps } from '@/types/common'
import { Textarea } from '@/components/ui/textarea'

type ExtendedProps = FormExtendedProps & {
  textareaProps?: TextAreaProps
}

type TextreaProps<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>> = {
  control: Control<TFieldValues>
  name: TName
  label?: string
  placeholder?: string
  description?: string
  isRequired?: boolean
  isHideLabel?: boolean
  isAutoGrow?: boolean
  //* rewrites each keystroke before it reaches the form state, so the user sees the stored value as they type
  transform?: (value: string) => string
  extendedProps?: ExtendedProps
}

export default function TextareaField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  description,
  isRequired,
  isHideLabel,
  isAutoGrow,
  transform,
  extendedProps
}: TextreaProps<T>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        //! must be spread AFTER {...field} to win, spreading it always would clobber field.onChange with undefined
        const transformProps = transform
          ? { onChange: (event: ChangeEvent<HTMLTextAreaElement>) => field.onChange(transform(event.target.value)) }
          : {}

        return (
          <Field {...extendedProps?.fieldProps} data-disabled={extendedProps?.textareaProps?.disabled} data-invalid={fieldState.invalid}>
            {!isHideLabel && label && (
              <FieldLabel
                {...extendedProps?.fieldLabelProps}
                isRequired={isRequired}
                isDisabled={extendedProps?.textareaProps?.disabled}
                htmlFor={field.name}
              >
                {label}
              </FieldLabel>
            )}

            <Textarea
              {...field}
              {...extendedProps?.textareaProps}
              {...transformProps}
              value={field.value ?? ''}
              id={field.name}
              className={cn(
                'resize-none',
                extendedProps?.textareaProps?.className,
                isAutoGrow ? 'field-sizing-content' : 'field-sizing-fixed'
              )}
              aria-invalid={fieldState.invalid}
              placeholder={placeholder}
              autoComplete='off'
            />

            {description && <FieldDescription {...extendedProps?.fieldDescriptionProps}>{description}</FieldDescription>}
            {fieldState.invalid && <FieldError {...extendedProps?.fieldErrorProps} errors={[fieldState.error]} />}
          </Field>
        )
      }}
    />
  )
}
