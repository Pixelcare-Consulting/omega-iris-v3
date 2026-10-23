'use client'

import { Icons } from '../icons'

import { cn, formatDate } from '@/lib/utils'
import { Badge, BadgeVariants } from '@/components/ui/badge'
import Link from 'next/link'
import { WordsHighlighter } from '../words-highlighter'
import { TooltipWrapper } from '../tooltip-wrapper'

type DataTableTextCellProps = {
  value: string | null | undefined
  className?: string
  muted?: boolean
  highlight?: string
  //* wraps instead of clipping, for text too long to read on one line
  isWrap?: boolean
}

//* plain text, truncates with an ellipsis, the tooltip carries the whole value
export function DataTableTextCell({ value, className, muted, highlight, isWrap }: DataTableTextCellProps) {
  if (!value) return <span className='text-muted-foreground text-sm'>—</span>

  const text = (
    <span
      className={cn(
        'block text-sm',
        isWrap ? 'wrap-break-word whitespace-normal' : 'max-w-50 truncate',
        muted && 'text-muted-foreground',
        className
      )}
    >
      <WordsHighlighter value={value} highlight={highlight} />
    </span>
  )

  //* a wrapped cell already shows every word, so a tooltip would only repeat it
  if (isWrap) return text

  return <TooltipWrapper label={value}>{text}</TooltipWrapper>
}

type DataTableNumberCellProps = {
  value?: number | null
  prefix?: string
  suffix?: string
  className?: string
  highlight?: string

  //* formatting options
  locale?: string
  minimumFractionDigits?: number
  maximumFractionDigits?: number
  notation?: Intl.NumberFormatOptions['notation']
  compactDisplay?: Intl.NumberFormatOptions['compactDisplay']
  isFormatValue?: boolean
}
//* numeric value, right-aligned, mono font, optional prefix and suffix
export function DataTableNumberCell({
  value,
  prefix,
  suffix,
  className,
  highlight,
  locale = 'en-US',
  minimumFractionDigits,
  maximumFractionDigits,
  notation,
  compactDisplay,
  isFormatValue = true
}: DataTableNumberCellProps) {
  if (value === null || value === undefined) return <span className='text-muted-foreground text-sm'>—</span>

  const formattedValue = new Intl.NumberFormat(locale, {
    minimumFractionDigits,
    maximumFractionDigits,
    notation,
    compactDisplay
  }).format(value)

  const displayed = isFormatValue ? formattedValue : String(value)

  return (
    <TooltipWrapper label={[prefix, displayed, suffix].filter(Boolean).join(' ')}>
      <span className={cn('space-x-1 text-right font-mono text-sm tabular-nums', className)}>
        <span>{prefix}</span>
        <span>
          <WordsHighlighter value={displayed} highlight={highlight} />
        </span>
        <span>{suffix}</span>
      </span>
    </TooltipWrapper>
  )
}

type DataTableDateCellProps = {
  value: Date | string | null | undefined
  formatStr?: string
  className?: string
}

//* date cell, the tooltip carries the same stamp in full
export function DataTableDateCell({ value, formatStr = 'MMM d, yyyy, h:mm a', className }: DataTableDateCellProps) {
  const formatted = formatDate(value, formatStr)

  return (
    <TooltipWrapper label={formatted}>
      <span className={cn('block truncate text-sm tabular-nums', className)}>{formatted}</span>
    </TooltipWrapper>
  )
}

type DataTableBadgeCellProps = {
  value: string | null | undefined
  variant?: BadgeVariants['variant']
  variantMap?: Record<string, BadgeVariants['variant']>
  className?: string
  highlight?: string
}

//* badge cell, maps a string value to a badge variant
//* `variant` wins over `variantMap` so a row carrying its own colour can pass it straight through
export function DataTableBadgeCell({ value, variant: ownVariant, variantMap, className, highlight }: DataTableBadgeCellProps) {
  if (!value) return <span className='text-muted-foreground text-sm'>—</span>

  const variant = ownVariant ?? variantMap?.[value] ?? ('secondary' as BadgeVariants['variant'])

  return (
    <TooltipWrapper label={value}>
      <Badge variant={variant} className={cn('max-w-50 truncate capitalize', className)}>
        <WordsHighlighter value={value} highlight={highlight} />
      </Badge>
    </TooltipWrapper>
  )
}

type BooleanDisplay = { type: 'icon'; true: React.ReactNode; false: React.ReactNode } | { type: 'text'; true: string; false: string }

type DataTableBooleanCellProps = {
  value: boolean | null | undefined
  display?: BooleanDisplay
  className?: string
  highlight?: string
}

const defaultDisplay: BooleanDisplay = {
  type: 'icon',
  true: <Icons.check className='size-4 text-emerald-500' />,
  false: <Icons.x className='text-muted-foreground size-4' />
}

//* boolean cell, a check or cross icon by default, custom icons or text also work
export function DataTableBooleanCell({ value, display = defaultDisplay, className, highlight }: DataTableBooleanCellProps) {
  if (display.type === 'text')
    return (
      <TooltipWrapper label={value ? display.true : display.false}>
        <span className={cn('block truncate text-sm', className)}>
          <WordsHighlighter value={value ? display.true : display.false} highlight={highlight} />
        </span>
      </TooltipWrapper>
    )
  return <span className={cn('inline-flex', className)}>{value ? display.true : display.false}</span>
}

type DataTableLinkCellProps = {
  href: string | null | undefined
  label?: string
  external?: boolean
  className?: string
  isExternal?: boolean
  highlight?: string
}

//* link cell, renders a clickable anchor
export function DataTableLinkCell({ href, label, external, className, highlight }: DataTableLinkCellProps) {
  if (!href) return <span className='text-muted-foreground text-sm'>—</span>

  return (
    <TooltipWrapper label={label ?? href}>
      {external ? (
        <a
          href={href}
          target='_blank'
          rel='noopener noreferrer'
          className={cn(
            'text-primary inline-flex max-w-50 items-center gap-1 truncate text-sm underline-offset-4 hover:underline',
            className
          )}
        >
          <WordsHighlighter value={label} highlight={highlight} />
          <Icons.externalLink className='size-4' />
        </a>
      ) : (
        <Link
          href={href}
          className={cn(
            'text-primary inline-flex max-w-50 items-center gap-1 truncate text-sm underline-offset-4 hover:underline',
            className
          )}
        >
          <WordsHighlighter value={label} highlight={highlight} />
        </Link>
      )}
    </TooltipWrapper>
  )
}

type DataTableActionsCellWrapperProps = {
  isVisible?: boolean
  children: React.ReactNode
  className?: string
}

export function DataTableActionsCellWrapper({ isVisible = true, className, children }: DataTableActionsCellWrapperProps) {
  if (!isVisible) return null
  return <div className={cn('flex flex-wrap items-center justify-center gap-0.5', className)}>{children}</div>
}
