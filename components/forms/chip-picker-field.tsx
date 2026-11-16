'use client'

import { useRef } from 'react'
import { Control, Controller, FieldPath, FieldValues } from 'react-hook-form'

import { cn } from '@/lib/utils'
import { Field, FieldLabel, FieldDescription, FieldError } from '../ui/field'
import { Toggle } from '../ui/toggle'
import { Button } from '../ui/button'

type ChipPickerFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> = {
  control: Control<TFieldValues>
  name: TName
  label: string
  options: string[]
  description?: string
  isRequired?: boolean
  disabled?: boolean
}

//* toggle chips over a fixed list, shift-click picks a range
export default function ChipPickerField<T extends FieldValues>({
  control,
  name,
  label,
  options,
  description,
  isRequired,
  disabled
}: ChipPickerFieldProps<T>) {
  const lastClickedIndex = useRef<number | null>(null)

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        const picked: string[] = field.value ?? []

        //* emit in option order, not click order
        const setPicked = (values: Set<string>) => field.onChange(options.filter((option) => values.has(option)))

        const handleChipClick = (index: number, isShift: boolean) => {
          const next = new Set(picked)
          const isOn = !next.has(options[index])

          const anchor = lastClickedIndex.current
          const [from, to] = isShift && anchor !== null ? [Math.min(anchor, index), Math.max(anchor, index)] : [index, index]

          for (let i = from; i <= to; i++) {
            if (isOn) next.add(options[i])
            else next.delete(options[i])
          }

          lastClickedIndex.current = index
          setPicked(next)
        }

        return (
          <Field data-disabled={disabled} data-invalid={fieldState.invalid}>
            <div className='flex flex-wrap items-center gap-2'>
              <FieldLabel isRequired={isRequired} isDisabled={disabled}>
                {label}
              </FieldLabel>

              <span className='text-muted-foreground text-xs'>
                {picked.length} of {options.length}
              </span>

              <div className='ml-auto flex items-center gap-1'>
                <Button type='button' variant='ghost' size='sm' disabled={disabled} onClick={() => setPicked(new Set(options))}>
                  All
                </Button>
                <Button type='button' variant='ghost' size='sm' disabled={disabled} onClick={() => setPicked(new Set())}>
                  Clear
                </Button>
              </div>
            </div>

            <div className='flex flex-wrap gap-1.5' onBlur={field.onBlur}>
              {options.map((option, index) => (
                <Toggle
                  key={option}
                  type='button'
                  variant='outline'
                  size='sm'
                  pressed={picked.includes(option)}
                  disabled={disabled}
                  aria-invalid={fieldState.invalid}
                  aria-label={`${label} ${option}`}
                  className={cn(
                    'min-w-9 font-mono select-none',
                    'data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground'
                  )}
                  onClick={(event) => handleChipClick(index, event.shiftKey)}
                >
                  {option}
                </Toggle>
              ))}
            </div>

            {description && <FieldDescription>{description}</FieldDescription>}
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )
      }}
    />
  )
}
