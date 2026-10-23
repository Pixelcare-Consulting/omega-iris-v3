import { Control, Controller, FieldPath, FieldValues } from 'react-hook-form'

import { cn } from '@/lib/utils'
import { Field, FieldLabel, FieldDescription, FieldError, FieldContent } from '../ui/field'
import { FormExtendedProps, CheckboxProps } from '@/types/common'
import { Checkbox } from '../ui/checkbox'

type ExtendedProps = FormExtendedProps & { checkboxProps?: CheckboxProps }

type CheckboxFieldProps<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>> = {
  control: Control<TFieldValues>
  name: TName
  label: string
  description?: string
  isRequired?: boolean
  extendedProps?: ExtendedProps
}

export default function CheckboxField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  isRequired,
  extendedProps
}: CheckboxFieldProps<T>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        return (
          <Field
            {...extendedProps?.fieldProps}
            orientation='vertical'
            data-disabled={extendedProps?.checkboxProps?.disabled}
            data-invalid={fieldState.invalid}
          >
            <FieldContent
              {...extendedProps?.fieldContentProps}
              className={cn('flex flex-row gap-2', extendedProps?.fieldContentProps?.className)}
            >
              <Checkbox
                {...extendedProps?.checkboxProps}
                id={name}
                name={name}
                checked={field.value}
                onCheckedChange={field.onChange}
                aria-invalid={fieldState.invalid}
              />
              <FieldLabel
                {...extendedProps?.fieldLabelProps}
                isRequired={isRequired}
                isDisabled={extendedProps?.checkboxProps?.disabled}
                htmlFor={name}
              >
                {label}
              </FieldLabel>
            </FieldContent>

            {description && <FieldDescription {...extendedProps?.fieldDescriptionProps}>{description}</FieldDescription>}
            {fieldState.invalid && <FieldError {...extendedProps?.fieldErrorProps} errors={[fieldState.error]} />}
          </Field>
        )
      }}
    />
  )
}
