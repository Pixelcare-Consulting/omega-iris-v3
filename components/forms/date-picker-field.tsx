'use client'

import { format, isValid } from 'date-fns'
import { Control, Controller, FieldPath, FieldValues, get } from 'react-hook-form'
import { Field, FieldLabel, FieldDescription, FieldError } from '../ui/field'

import { ButtonProps, CalendarProps, FormExtendedProps, PopoverContentProps, PopoverProps, PopoverTriggerProps } from '@/types/common'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Button } from '../ui/button'
import { cn } from '@/lib/utils'
import { Icons } from '../icons'
import { Calendar } from '../ui/calendar'
import { Input } from '../ui/input'

type ExtendedProps = FormExtendedProps & {
  popoverProps?: PopoverProps
  popoverTriggerProps?: PopoverTriggerProps
  popoverContentProps?: PopoverContentProps
  calendarProps?: CalendarProps
  buttonProps?: ButtonProps
  disabledFuture?: boolean
}

type DatePickerFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> = {
  control: Control<TFieldValues>
  name: TName
  label?: string
  description?: string
  isRequired?: boolean
  isHideLabel?: boolean
  isWithTime?: boolean //* adds a time input below the calendar, single mode only, a range has no one time to carry
  extendedProps?: ExtendedProps
}

export default function DatePickerField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  isRequired,
  isHideLabel,
  isWithTime,
  extendedProps
}: DatePickerFieldProps<T>) {
  const mode = extendedProps?.calendarProps?.mode ?? 'single'
  const captionLayout = extendedProps?.calendarProps?.captionLayout ?? 'dropdown'

  const isRangeMode = mode === 'range'
  const isTimeShown = !!isWithTime && !isRangeMode

  const dateFormat = isTimeShown ? 'PPp' : 'PP'

  function renderValue(value: Date | Date[] | { from: Date | undefined; to: Date | undefined } | undefined) {
    if (!value) return null

    if (Array.isArray(value)) return <time className='truncate'>{value.map((date) => format(date, dateFormat)).join(', ')}</time>

    if (typeof value === 'object' && 'from' in value && 'to' in value && value.from && value.to) {
      const range = value as { from: Date | undefined; to: Date }
      return <time>{`${range.from ? `${format(range.from, 'PP')} - ` : ''}${range.to ? format(range.to, 'PP') : ''}`}</time>
    }

    if (value instanceof Date && isValid(value)) return <time className='truncate'>{format(value, dateFormat)}</time>

    return null
  }

  //! `isValid` is shadowed inside the render, so the date check gets its own helper
  function isValidDate(value: unknown): value is Date {
    return value instanceof Date && isValid(value)
  }

  //* picking a day keeps the time already set, so the two inputs never fight over the same value
  function withKeptTime(nextDate: Date | undefined, currentValue: unknown) {
    if (!nextDate || !isTimeShown) return nextDate

    const current = currentValue instanceof Date && isValid(currentValue) ? currentValue : null

    if (!current) return nextDate

    const kept = new Date(nextDate)
    kept.setHours(current.getHours(), current.getMinutes(), 0, 0)

    return kept
  }

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState, formState: { errors } }) => {
        const fieldError = get(errors, name)
        const isValid = !!fieldError
        const fieldStateError = fieldState.error as Record<string, any>

        return (
          <Field {...extendedProps?.fieldProps} data-disabled={extendedProps?.buttonProps?.disabled} data-invalid={fieldState.invalid}>
            {!isHideLabel && label && (
              <FieldLabel
                {...extendedProps?.fieldLabelProps}
                isRequired={isRequired}
                isDisabled={extendedProps?.buttonProps?.disabled}
                htmlFor={field.name}
              >
                {label}
              </FieldLabel>
            )}

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  aria-invalid={isValid}
                  variant='outline'
                  className={cn(
                    'flex w-full justify-start pl-3 text-left font-normal',
                    extendedProps?.buttonProps?.className,
                    !field.value && 'text-muted-foreground'
                  )}
                  {...extendedProps?.buttonProps}
                >
                  <Icons.calendar className='mr-2 size-4' />
                  {field.value ? (renderValue(field.value) ?? <span>Pick a date</span>) : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                {...extendedProps?.popoverContentProps}
                className={cn('w-auto p-0', extendedProps?.popoverContentProps?.className)}
                align='start'
              >
                <div className='space-y-2 p-2'>
                  <Calendar
                    {...extendedProps?.calendarProps}
                    mode={mode as any}
                    captionLayout={captionLayout}
                    defaultMonth={isRangeMode ? (field.value?.from ?? new Date()) : (field.value ?? new Date())}
                    selected={field.value}
                    onSelect={(selected: any) => field.onChange(isTimeShown ? withKeptTime(selected, field.value) : selected)}
                    //* an explicit matcher wins, `disabledFuture` is only the default when none is given
                    disabled={
                      extendedProps?.calendarProps?.disabled ??
                      (extendedProps?.disabledFuture ? (date: Date) => date > new Date() || date < new Date('1900-01-01') : false)
                    }
                  />

                  {isTimeShown && (
                    <Input
                      type='time'
                      step={60}
                      className='bg-background w-full appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none'
                      disabled={extendedProps?.buttonProps?.disabled}
                      value={isValidDate(field.value) ? format(field.value, 'HH:mm') : ''}
                      onChange={(event) => {
                        const [hours, minutes] = event.target.value.split(':').map(Number)

                        //* typing a time before a date lands it on today
                        const base = isValidDate(field.value) ? new Date(field.value) : new Date()

                        if (Number.isNaN(hours) || Number.isNaN(minutes)) return

                        base.setHours(hours, minutes, 0, 0)
                        field.onChange(base)
                      }}
                    />
                  )}

                  <div className='flex justify-end'>
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      onClick={() => field.onChange(isRangeMode ? { from: new Date(), to: new Date() } : new Date())}
                    >
                      Today
                    </Button>

                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      disabled={!field.value}
                      onClick={() => field.onChange(isRangeMode ? { from: undefined, to: undefined } : undefined)}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {description && <FieldDescription {...extendedProps?.fieldDescriptionProps}>{description}</FieldDescription>}
            <FieldError
              {...extendedProps?.fieldErrorProps}
              errors={
                isRangeMode ? [fieldStateError?.from, fieldStateError?.to].filter(Boolean) : fieldState.error ? [fieldState.error] : []
              }
            />
          </Field>
        )
      }}
    />
  )
}
