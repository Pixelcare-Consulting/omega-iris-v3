'use client'

import { useState } from 'react'

import { Control, Controller, FieldPath, FieldValues } from 'react-hook-form'

import { Field, FieldLabel, FieldDescription, FieldError } from '../ui/field'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { badgeVariants } from '../ui/badge'
import { Icons } from '../icons'
import { TooltipWrapper } from '../tooltip-wrapper'
import { cn } from '@/lib/utils'
import {
  FormExtendedProps,
  PopoverProps,
  PopoverContentProps,
  PopoverTriggerProps,
  TabsProps,
  TabsListProps,
  TabsTriggerProps,
  TabsContentProps
} from '@/types/common'
import { BADGE_COLOR_FAMILIES, BadgeColor, BadgeColorFamily, DEFAULT_BADGE_COLOR_FAMILY } from '@/constants/color'
import { formatBadgeColorLabel, getBadgeColorFamily } from '@/lib/color'

type ExtendedProps = FormExtendedProps & {
  popoverProps?: PopoverProps
  popoverTriggerProps?: PopoverTriggerProps
  popoverContentProps?: PopoverContentProps
  tabsProps?: TabsProps
  tabsListProps?: TabsListProps
  tabsTriggerProps?: TabsTriggerProps
  tabsContentProps?: TabsContentProps
}

type ColorPickerFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> = {
  control: Control<TFieldValues>
  name: TName
  label: string
  description?: string
  placeholder?: string
  isRequired?: boolean
  isHideLabel?: boolean
  disabled?: boolean
  colorFamilies?: BadgeColorFamily[] //* which swatch families to offer, blank shows them all
  callback?: (...args: any[]) => void
  extendedProps?: ExtendedProps
}

export function ColorPickerField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  description,
  isRequired,
  isHideLabel,
  disabled,
  colorFamilies,
  callback,
  extendedProps
}: ColorPickerFieldProps<T>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        const value = (field.value ?? '') as string

        return (
          <Field {...extendedProps?.fieldProps} data-disabled={disabled} data-invalid={fieldState.invalid}>
            {!isHideLabel && label && (
              <FieldLabel {...extendedProps?.fieldLabelProps} isDisabled={disabled} isRequired={isRequired} htmlFor={field.name}>
                {label}
              </FieldLabel>
            )}

            <ColorPicker
              id={field.name}
              value={value}
              placeholder={placeholder ?? `Select a ${label.toLowerCase()}`}
              disabled={disabled}
              isInvalid={fieldState.invalid}
              colorFamilies={colorFamilies}
              onBlur={field.onBlur}
              onValueChange={(color) => {
                field.onChange(color)
                if (callback) callback({ value, color })
              }}
              extendedProps={extendedProps}
            />

            {description && <FieldDescription {...extendedProps?.fieldDescriptionProps}>{description}</FieldDescription>}
            {fieldState.invalid && <FieldError {...extendedProps?.fieldErrorProps} errors={[fieldState.error]} />}
          </Field>
        )
      }}
    />
  )
}

type ColorPickerProps = {
  id: string
  value: string
  placeholder: string
  disabled?: boolean
  isInvalid?: boolean
  colorFamilies?: BadgeColorFamily[]
  onBlur?: () => void
  onValueChange: (color: string) => void
  extendedProps?: ExtendedProps
}

function ColorPicker({
  id,
  value,
  placeholder,
  disabled,
  isInvalid,
  colorFamilies,
  onBlur,
  onValueChange,
  extendedProps
}: ColorPickerProps) {
  // prettier-ignore
  //! an empty list would leave nothing to pick from, so it falls back to every family
  const families = colorFamilies?.length ? BADGE_COLOR_FAMILIES.filter((item) => colorFamilies.includes(item.key)) : BADGE_COLOR_FAMILIES

  //! the value's own family may be one the caller left out, so it lands on the first one offered
  const resolveFamily = (color: string) => {
    const current = getBadgeColorFamily(color) ?? DEFAULT_BADGE_COLOR_FAMILY
    return families.some((item) => item.key === current) ? current : families[0].key
  }

  const [isOpen, setIsOpen] = useState(false)
  const [family, setFamily] = useState<BadgeColorFamily>(() => resolveFamily(value))

  //* point the tabs at the family of the current value every time the popup opens
  const handleOpenChange = (open: boolean) => {
    if (open) setFamily(resolveFamily(value))
    else onBlur?.()

    setIsOpen(open)
  }

  const handleSelect = (color: BadgeColor) => {
    onValueChange(color)
    setIsOpen(false)
  }

  return (
    <div className='relative w-full'>
      <Popover {...extendedProps?.popoverProps} open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger
          {...extendedProps?.popoverTriggerProps}
          id={id}
          type='button'
          disabled={disabled}
          aria-invalid={isInvalid}
          className={cn(
            'border-input focus-visible:border-ring focus-visible:ring-ring/50 disabled:bg-input/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 flex h-8 w-full min-w-0 items-center gap-2 rounded-lg border bg-transparent py-1 pr-14 pl-2.5 text-left text-base transition-colors outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 md:text-sm',
            extendedProps?.popoverTriggerProps?.className
          )}
        >
          {value ? (
            <>
              <span className={cn(badgeVariants({ variant: value as BadgeColor }), 'size-4 shrink-0 rounded-sm')} />
              <span className='truncate'>{formatBadgeColorLabel(value)}</span>
            </>
          ) : (
            <span className='text-muted-foreground truncate'>{placeholder}</span>
          )}

          <Icons.upDown className='text-muted-foreground pointer-events-none absolute right-2.5 size-4 shrink-0' />
        </PopoverTrigger>

        <PopoverContent
          {...extendedProps?.popoverContentProps}
          align='start'
          className={cn('gap-3', extendedProps?.popoverContentProps?.className)}
        >
          <Tabs
            {...extendedProps?.tabsProps}
            value={family}
            onValueChange={(value) => setFamily(value as BadgeColorFamily)}
            className={cn('gap-3', extendedProps?.tabsProps?.className)}
          >
            {/* //* a lone tab is just noise, the swatches speak for themselves */}
            {families.length > 1 && (
              <TabsList {...extendedProps?.tabsListProps} className={cn('w-full', extendedProps?.tabsListProps?.className)}>
                {families.map((colorFamily) => (
                  <TabsTrigger {...extendedProps?.tabsTriggerProps} key={colorFamily.key} value={colorFamily.key}>
                    {colorFamily.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            )}

            {families.map((colorFamily) => (
              <TabsContent {...extendedProps?.tabsContentProps} key={colorFamily.key} value={colorFamily.key}>
                <div className='grid grid-cols-10 gap-1.5'>
                  {colorFamily.colors.map((color) => {
                    const isSelected = color === value

                    return (
                      //* the swatch is 20px, the name only fits in a tooltip
                      <TooltipWrapper key={color} label={formatBadgeColorLabel(color)} delayDuration={200}>
                        <button
                          type='button'
                          aria-pressed={isSelected}
                          onClick={() => handleSelect(color)}
                          className={cn(
                            badgeVariants({ variant: color }),
                            'ring-offset-popover focus-visible:ring-ring size-5 cursor-pointer rounded-md transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-offset-2',
                            isSelected && 'ring-ring ring-2 ring-offset-2'
                          )}
                        >
                          {isSelected && <Icons.check />}
                        </button>
                      </TooltipWrapper>
                    )
                  })}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </PopoverContent>
      </Popover>

      {value && !disabled && (
        <button
          type='button'
          aria-label='Clear color'
          onClick={() => onValueChange('')}
          className='text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-1/2 right-7 size-4 -translate-y-1/2 cursor-pointer rounded-sm outline-none focus-visible:ring-2'
        >
          <Icons.x className='size-4' />
        </button>
      )}
    </div>
  )
}
