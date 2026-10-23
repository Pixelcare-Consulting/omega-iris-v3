'use client'

import { ChangeEvent } from 'react'
import { Control, Controller, FieldPath, FieldValues } from 'react-hook-form'

import { cn } from '@/lib/utils'
import { Field, FieldLabel, FieldDescription, FieldError } from '../ui/field'
import {
  FormExtendedProps,
  InputGroupAddonProps,
  InputGroupButtonProps,
  InputGroupInputProps,
  InputGroupProps,
  InputGroupTextProps,
  InputProps
} from '@/types/common'
import { Input } from '../ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '../ui/input-group'

type ExtendedProps = FormExtendedProps & {
  inputProps?: InputProps
  inputGroupProps?: InputGroupProps
  inputGroupAddonProps?: InputGroupAddonProps
  inputGroupButtonProps?: InputGroupButtonProps
  inputGroupTextProps?: InputGroupTextProps
  inputGroupInputProps?: InputGroupInputProps
}

type InputFieldProps<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>> = {
  control: Control<TFieldValues>
  name: TName
  label?: string
  placeholder?: string
  description?: string
  isRequired?: boolean
  isHideLabel?: boolean
  isWithAddon?: boolean
  //* rewrites each keystroke before it reaches the form state, so the user sees the stored value as they type
  transform?: (value: string) => string
  extendedProps?: ExtendedProps
}

export default function InputField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  description,
  isRequired,
  isHideLabel,
  isWithAddon,
  transform,
  extendedProps
}: InputFieldProps<T>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        //! must be spread AFTER {...field} to win, spreading it always would clobber field.onChange with undefined
        const transformProps = transform
          ? { onChange: (event: ChangeEvent<HTMLInputElement>) => field.onChange(transform(event.target.value)) }
          : {}

        return (
          <Field
            {...extendedProps?.fieldProps}
            data-disabled={extendedProps?.inputGroupInputProps?.disabled || extendedProps?.inputProps?.disabled}
            data-invalid={fieldState.invalid}
          >
            {!isHideLabel && label && (
              <FieldLabel
                {...extendedProps?.fieldLabelProps}
                isRequired={isRequired}
                isDisabled={extendedProps?.inputGroupInputProps?.disabled || extendedProps?.inputProps?.disabled}
                htmlFor={field.name}
              >
                {label}
              </FieldLabel>
            )}

            {isWithAddon ? (
              <InputGroup {...extendedProps?.inputGroupProps}>
                <InputGroupInput
                  {...field}
                  {...extendedProps?.inputGroupInputProps}
                  {...transformProps}
                  //* nullable columns arrive as null, React flips the input to uncontrolled unless it gets a string
                  value={field.value ?? ''}
                  id={field.name}
                  className={cn(extendedProps?.inputGroupInputProps?.className)}
                  aria-invalid={fieldState.invalid}
                  placeholder={placeholder}
                  autoComplete='off'
                />
                <InputGroupAddon {...extendedProps?.inputGroupAddonProps} />
              </InputGroup>
            ) : (
              <Input
                {...field}
                {...extendedProps?.inputProps}
                {...transformProps}
                value={field.value ?? ''}
                id={field.name}
                className={cn(extendedProps?.inputProps?.className)}
                aria-invalid={fieldState.invalid}
                placeholder={placeholder}
                autoComplete='off'
              />
            )}

            {description && <FieldDescription {...extendedProps?.fieldDescriptionProps}>{description}</FieldDescription>}
            {fieldState.invalid && <FieldError {...extendedProps?.fieldErrorProps} errors={[fieldState.error]} />}
          </Field>
        )
      }}
    />
  )
}
