'use client'

import { formatDistanceToNow } from 'date-fns'

import { TooltipWrapper } from './tooltip-wrapper'
import { formatDate } from '@/lib/utils'

type RelativeDateProps = { value?: Date | string | null; formatStr?: string }

//* the full stamp sits in the tooltip
export default function RelativeDate({ value, formatStr = 'PPpp' }: RelativeDateProps) {
  if (!value) return '—'

  const date = new Date(value)

  return (
    <TooltipWrapper label={formatDate(date, formatStr)}>
      <span>{formatDistanceToNow(date, { addSuffix: true })}</span>
    </TooltipWrapper>
  )
}
