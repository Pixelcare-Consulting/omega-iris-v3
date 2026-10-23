'use client'

import { Control, Controller, FieldPath, FieldValues } from 'react-hook-form'

import { Field, FieldLabel, FieldDescription, FieldError, FieldContent, FieldTitle, FieldGroup } from '../ui/field'
import { FormExtendedProps, SwitchProps } from '@/types/common'
import { Switch } from '../ui/switch'
import { cn } from '@/lib/utils'

type ExtendedProps = FormExtendedProps & { switchProps?: SwitchProps }

type SwitchFieldProps<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>> = {
  control: Control<TFieldValues>
  name: TName
  label: string
  description?: string
  isRequired?: boolean
  layout?: 'default' | 'wide' | 'choice-card'
  callback?: (...args: any[]) => void
  extendedProps?: ExtendedProps
}

export default function SwitchField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  isRequired,
  layout = 'default',
  callback,
  extendedProps
}: SwitchFieldProps<T>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        const handleCheckedChange = (checked: boolean) => {
          field.onChange(checked)
          if (callback) callback({ value: checked })
        }

        switch (layout) {
          case 'wide':
            return (
              <Field
                {...extendedProps?.fieldProps}
                orientation='horizontal'
                data-disabled={extendedProps?.switchProps?.disabled}
                data-invalid={fieldState.invalid}
              >
                <FieldContent {...extendedProps?.fieldContentProps}>
                  <FieldLabel
                    {...extendedProps?.fieldLabelProps}
                    isRequired={isRequired}
                    isDisabled={extendedProps?.switchProps?.disabled}
                    htmlFor={name}
                  >
                    {label}
                  </FieldLabel>
                  {description && <FieldDescription {...extendedProps?.fieldDescriptionProps}>{description}</FieldDescription>}
                  {fieldState.invalid && <FieldError {...extendedProps?.fieldErrorProps} errors={[fieldState.error]} />}
                </FieldContent>

                <Switch
                  {...extendedProps?.switchProps}
                  checked={field.value}
                  onCheckedChange={handleCheckedChange}
                  id={name}
                  aria-invalid={fieldState.invalid}
                />
              </Field>
            )

          case 'choice-card':
            return (
              <FieldGroup className='h-full'>
                <FieldLabel htmlFor={name} className='flex-1 cursor-pointer'>
                  <Field
                    {...extendedProps?.fieldProps}
                    orientation='horizontal'
                    data-disabled={extendedProps?.switchProps?.disabled}
                    data-invalid={fieldState.invalid}
                  >
                    <FieldContent {...extendedProps?.fieldContentProps}>
                      <FieldTitle
                        {...extendedProps?.fieldTitleProps}
                        isRequired={isRequired}
                        isDisabled={extendedProps?.switchProps?.disabled}
                      >
                        {label}
                      </FieldTitle>
                      {description && <FieldDescription {...extendedProps?.fieldDescriptionProps}>{description}</FieldDescription>}
                      {fieldState.invalid && <FieldError {...extendedProps?.fieldErrorProps} errors={[fieldState.error]} />}
                    </FieldContent>

                    <Switch
                      {...extendedProps?.switchProps}
                      checked={field.value}
                      onCheckedChange={handleCheckedChange}
                      id={name}
                      aria-invalid={fieldState.invalid}
                    />
                  </Field>
                </FieldLabel>
              </FieldGroup>
            )

          default:
            return (
              <Field
                {...extendedProps?.fieldProps}
                orientation='vertical'
                data-disabled={extendedProps?.switchProps?.disabled}
                data-invalid={fieldState.invalid}
              >
                <FieldContent
                  {...extendedProps?.fieldContentProps}
                  className={cn('flex flex-row gap-2', extendedProps?.fieldContentProps?.className)}
                >
                  <Switch
                    {...extendedProps?.switchProps}
                    checked={field.value}
                    onCheckedChange={handleCheckedChange}
                    id={name}
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldLabel
                    {...extendedProps?.fieldLabelProps}
                    isRequired={isRequired}
                    isDisabled={extendedProps?.switchProps?.disabled}
                    htmlFor={name}
                  >
                    {label}
                  </FieldLabel>
                </FieldContent>

                {description && <FieldDescription {...extendedProps?.fieldDescriptionProps}>{description}</FieldDescription>}
                {fieldState.invalid && <FieldError {...extendedProps?.fieldErrorProps} errors={[fieldState.error]} />}
              </Field>
            )
        }
      }}
    />
  )
}
