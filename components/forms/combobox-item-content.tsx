import { cn } from '@/lib/utils'
import { FormOptions } from '@/types/common'

type ComboboxItemContentProps = {
  label: React.ReactNode
  description?: React.ReactNode
  lines?: React.ReactNode[]
  trailing?: React.ReactNode
  isWrap?: boolean
  className?: string
  extendedProps?: {
    labelProps?: React.ComponentProps<'span'>
    descriptionProps?: React.ComponentProps<'span'>
    trailingProps?: React.ComponentProps<'div'>
  }
}

//* the option row layout for ComboboxField's renderItem
//! returns a fragment, ComboboxField already wraps renderItem in the row
export default function ComboboxItemContent({
  label,
  description,
  lines,
  trailing,
  isWrap,
  className,
  extendedProps
}: ComboboxItemContentProps) {
  return (
    <>
      {/* //* min-w-0 is what lets long text shrink instead of widening the popover */}
      <div className={cn('flex min-w-0 flex-col gap-0.5', className)}>
        <span
          {...extendedProps?.labelProps}
          className={cn('font-semibold', isWrap ? 'wrap-anywhere' : 'truncate', extendedProps?.labelProps?.className)}
        >
          {label}
        </span>

        {description && (
          <span
            {...extendedProps?.descriptionProps}
            //* a long title stays readable over three lines instead of being cut at one
            className={cn(
              'text-muted-foreground line-clamp-3 text-xs',
              isWrap && 'wrap-anywhere',
              extendedProps?.descriptionProps?.className
            )}
          >
            {description}
          </span>
        )}

        {/* //* any extra row goes here, so a new field needs no new prop */}
        {lines}
      </div>

      {trailing && (
        <div {...extendedProps?.trailingProps} className={cn('ml-auto shrink-0', extendedProps?.trailingProps?.className)}>
          {trailing}
        </div>
      )}
    </>
  )
}

//* name with the code below it, the right side stays free for badges
//* pass as renderItem with searchKeys={['value']} so the code is searchable
export function renderCodeItem(item: FormOptions) {
  return <ComboboxItemContent label={item.label} description={item.value} />
}
