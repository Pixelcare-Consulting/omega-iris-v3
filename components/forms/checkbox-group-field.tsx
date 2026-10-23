import { Control, Controller, FieldPath, FieldValues } from 'react-hook-form'

import { cn } from '@/lib/utils'
import { Field, FieldLabel, FieldDescription, FieldError, FieldContent, FieldGroup } from '../ui/field'
import { FormExtendedProps, CheckboxProps, FormOptions } from '@/types/common'
import { Checkbox } from '../ui/checkbox'
import { Icons } from '../icons'

type ExtendedProps = FormExtendedProps & { checkboxProps?: CheckboxProps }

type CheckboxGroupFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> = {
  control: Control<TFieldValues>
  name: TName
  label: string
  description?: string
  direction?: 'horizontal' | 'vertical'
  isRequired?: boolean
  isHideLabel?: boolean
  data: FormOptions[]
  isLoading?: boolean
  extendedProps?: ExtendedProps
}

export default function CheckboxGroupField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  direction = 'horizontal',
  data,
  isLoading,
  isRequired,
  isHideLabel,
  extendedProps
}: CheckboxGroupFieldProps<T>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        return (
          <Field {...extendedProps?.fieldProps} data-disabled={extendedProps?.checkboxProps?.disabled} data-invalid={fieldState.invalid}>
            {!isHideLabel && label && (
              <FieldLabel
                {...extendedProps?.fieldLabelProps}
                isRequired={isRequired}
                isDisabled={extendedProps?.checkboxProps?.disabled}
                htmlFor={field.name}
              >
                {label}
              </FieldLabel>
            )}

            <FieldGroup
              {...extendedProps?.fieldGroupProps}
              className={cn(
                extendedProps?.fieldGroupProps?.className,
                direction === 'horizontal' ? 'flex flex-row flex-wrap gap-2.5' : 'gap-2',
                'mb-1.5'
              )}
            >
              {!isLoading &&
                data &&
                data.length > 0 &&
                data.map((item, i) => (
                  <Field
                    {...extendedProps?.fieldProps}
                    className={cn(extendedProps?.fieldProps?.className, 'w-fit')}
                    key={`${name}-${item.value}-${i}`}
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
                        id={`${name}-${item.label}-${item.value}-${i}`}
                        checked={field.value?.includes(item.value)}
                        onCheckedChange={(checked) => {
                          return checked
                            ? field.onChange([...field.value, item.value])
                            : field.onChange(field.value?.filter((value: string) => value !== item.value))
                        }}
                        disabled={extendedProps?.checkboxProps?.disabled || item?.isDisabled}
                        aria-invalid={fieldState.invalid}
                      />
                      <FieldLabel
                        {...extendedProps?.fieldLabelProps}
                        isDisabled={extendedProps?.checkboxProps?.disabled}
                        htmlFor={`${name}-${item.label}-${item.value}-${i}`}
                      >
                        {item?.label}
                      </FieldLabel>

                      {item?.description && (
                        <FieldDescription {...extendedProps?.fieldDescriptionProps}>{item?.description}</FieldDescription>
                      )}
                    </FieldContent>
                  </Field>
                ))}

              {isLoading ? (
                <div className='mx-3 my-2 flex w-full items-center justify-center text-sm'>
                  <Icons.spinner className='mr-1.5 size-4 animate-spin' />
                  <span>Loading...</span>
                </div>
              ) : null}
            </FieldGroup>

            {description && <FieldDescription {...extendedProps?.fieldDescriptionProps}>{description}</FieldDescription>}
            {fieldState.invalid && <FieldError {...extendedProps?.fieldErrorProps} errors={[fieldState.error]} />}
          </Field>
        )
      }}
    />
  )
}
