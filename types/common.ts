import { type VariantProps } from 'class-variance-authority'
import { Combobox as ComboboxPrimitive } from '@base-ui/react'
import { Popover as PopoverPrimitive } from 'radix-ui'
import { Switch as SwitchPrimitive } from 'radix-ui'
import { Checkbox as CheckboxPrimitive } from 'radix-ui'
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui'
import { Tabs as TabsPrimitive } from 'radix-ui'

import { Button, buttonVariants } from '@/components/ui/button'
import { fieldVariants } from '@/components/ui/field'
import { inputGroupAddonVariants, inputGroupButtonVariants } from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'
import { tabsListVariants } from '@/components/ui/tabs'
import { DayPicker } from 'react-day-picker'
import { FileUploadProps } from '@/components/ui/file-upload'

export type PageMetadata = { title: string; description: string }

export type CodeName = { code: string; name: string } //* reference data common shape
export type DuplicateFields = { field: string; name: string; message: string }[]

export type FieldSetProps = React.ComponentProps<'fieldset'>
export type FieldLegendProps = React.ComponentProps<'legend'> & { variant?: 'legend' | 'label' }
export type FieldGroupProps = React.ComponentProps<'div'>
export type FieldProps = React.ComponentProps<'div'> & VariantProps<typeof fieldVariants>
export type FieldContentProps = React.ComponentProps<'div'>
export type FieldLabelProps = React.ComponentProps<typeof Label> & { isRequired?: boolean; isDisabled?: boolean }
export type FieldTitleProps = React.ComponentProps<'div'> & { isRequired?: boolean; isDisabled?: boolean }
export type FieldDescriptionProps = React.ComponentProps<'p'>
export type FieldSeparatorProps = React.ComponentProps<'div'> & { children?: React.ReactNode }
export type FieldErrorProps = React.ComponentProps<'div'> & { errors?: Array<{ message?: string } | undefined> }

export type FormExtendedProps = {
  fieldSetProps?: FieldSetProps
  fieldLegendProps?: FieldLegendProps
  fieldGroupProps?: FieldGroupProps
  fieldProps?: FieldProps
  fieldContentProps?: FieldContentProps
  fieldLabelProps?: FieldLabelProps
  fieldTitleProps?: FieldTitleProps
  fieldDescriptionProps?: FieldDescriptionProps
  fieldSeparatorProps?: FieldSeparatorProps
  fieldErrorProps?: FieldErrorProps
}

export type FormOptions = { value: string; label: string; keywords?: string } & Record<string, any>

export type InputProps = React.ComponentProps<'input'>
export type InputGroupProps = React.ComponentProps<'div'>
export type InputGroupAddonProps = React.ComponentProps<'div'> & VariantProps<typeof inputGroupAddonVariants>
export type InputGroupButtonProps = Omit<React.ComponentProps<typeof Button>, 'size'> & VariantProps<typeof inputGroupButtonVariants>
export type InputGroupTextProps = React.ComponentProps<'span'>
export type InputGroupInputProps = React.ComponentProps<'input'>
export type InputGroupTextareaProps = React.ComponentProps<'textarea'>

export type TextAreaProps = React.ComponentProps<'textarea'>
export type ButtonProps = React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }

export type ComboboxPorps = React.ComponentPropsWithRef<typeof ComboboxPrimitive.Root>
export type ComboboxValueProps = ComboboxPrimitive.Value.Props
export type ComboboxTriggerProps = ComboboxPrimitive.Trigger.Props
export type ComboboxClearProps = ComboboxPrimitive.Clear.Props
export type ComboboxInputProps = ComboboxPrimitive.Input.Props & { showTrigger?: boolean; showClear?: boolean }
export type ComboboxContentProps = ComboboxPrimitive.Popup.Props & Pick<ComboboxPrimitive.Positioner.Props, 'side' | 'align' | 'sideOffset' | 'alignOffset' | 'anchor'> // prettier-ignore
export type ComboboxListProps = ComboboxPrimitive.List.Props
export type ComboboxItemProps = ComboboxPrimitive.Item.Props
export type ComboboxGroupProps = ComboboxPrimitive.Group.Props
export type ComboboxLabelProps = ComboboxPrimitive.GroupLabel.Props
export type ComboboxEmptyProps = ComboboxPrimitive.Empty.Props
export type ComboboxCollectionProps = ComboboxPrimitive.Collection.Props
export type ComboboxSeparatorProps = ComboboxPrimitive.Separator.Props
export type ComboboxChipsProps = React.ComponentPropsWithRef<typeof ComboboxPrimitive.Chips> & ComboboxPrimitive.Chips.Props
export type ComboboxChipProps = ComboboxPrimitive.Chip.Props & { showRemove?: boolean }
export type ComboboxChipsInputProps = ComboboxPrimitive.Input.Props

export type PopoverProps = React.ComponentProps<typeof PopoverPrimitive.Root>
export type PopoverTriggerProps = React.ComponentProps<typeof PopoverPrimitive.Trigger>
export type PopoverContentProps = React.ComponentProps<typeof PopoverPrimitive.Content>
export type PopoverAnchorProps = React.ComponentProps<typeof PopoverPrimitive.Anchor>
export type PopoverHeaderProps = React.ComponentProps<'div'>
export type PopoverTitleProps = React.ComponentProps<'h2'>
export type PopoverDescriptionProps = React.ComponentProps<'p'>

export type TabsProps = React.ComponentProps<typeof TabsPrimitive.Root>
export type TabsListProps = React.ComponentProps<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>
export type TabsTriggerProps = React.ComponentProps<typeof TabsPrimitive.Trigger>
export type TabsContentProps = React.ComponentProps<typeof TabsPrimitive.Content>

export type CalendarProps = React.ComponentProps<typeof DayPicker> & { buttonVariant?: React.ComponentProps<typeof Button>['variant'] }

export type SwitchProps = React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: 'sm' | 'default'
  icon?: React.ReactNode
  thumbClassName?: string
}
export type CheckboxProps = React.ComponentProps<typeof CheckboxPrimitive.Root>
export type RadioGroupProps = React.ComponentProps<typeof RadioGroupPrimitive.Root>
export type RadioGroupItemProps = React.ComponentProps<typeof RadioGroupPrimitive.Item>

export type FileUploaderProps = FileUploadProps
