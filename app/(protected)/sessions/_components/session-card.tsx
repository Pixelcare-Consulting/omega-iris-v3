'use client'

import Link from 'next/link'
import { useMemo } from 'react'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Icons } from '@/components/icons'
import { WordsHighlighter } from '@/components/words-highlighter'
import { TooltipWrapper } from '@/components/tooltip-wrapper'
import DataTableRowActions, { DataTableRowAction } from '@/components/data-table/data-table-row-actions'
import { SessionWithInclude } from '@/actions/session'
import { SESSION_STATUS_CONFIG, SESSION_TYPE_CONFIG } from '@/constants/session'
import { formatActiveTime, getActiveSeconds } from '@/lib/session'
import { formatDate } from '@/lib/utils'

type SessionCardProps = {
  session: SessionWithInclude
  actions: DataTableRowAction[]
  highlight?: string
}

//* e.g. Nov 19, 08:12 – 10:40, an open one shows its start only
function toSessionTimeText({ startedAt, endedAt }: Pick<SessionWithInclude, 'startedAt' | 'endedAt'>) {
  const start = formatDate(new Date(startedAt), 'MMM dd, hh:mm a')
  return endedAt ? `${start} – ${formatDate(new Date(endedAt), 'hh:mm a')}` : start
}

export default function SessionCard({ session, actions, highlight }: SessionCardProps) {
  const { code, type, status, site, user, employeeId, cancelReason } = session

  const typeConfig = SESSION_TYPE_CONFIG[type]
  const statusConfig = SESSION_STATUS_CONFIG[status]
  const timeText = toSessionTimeText(session)

  //* an open session counts up to when the list loaded
  const activeText = useMemo(() => formatActiveTime(getActiveSeconds(session, new Date())), [session])

  return (
    <Link href={`/sessions/${encodeURIComponent(code)}/view`} className='block h-full no-underline'>
      <Card className='group hover:border-primary hover:ring-primary relative flex h-full cursor-pointer flex-col gap-3 border p-4 shadow-sm ring-0 transition-all hover:ring-1'>
        {/* //* stacked and centered on xs, side by side from sm */}
        <div className='flex flex-col items-center gap-1 px-8 text-center sm:flex-row sm:justify-between sm:gap-3 sm:px-0 sm:text-left'>
          <div className='flex w-full min-w-0 flex-col sm:w-auto sm:flex-1'>
            <span className='truncate text-base font-semibold' title={code}>
              <WordsHighlighter value={code} highlight={highlight} />
            </span>

            <span className='text-muted-foreground truncate text-xs' title={site.name}>
              <WordsHighlighter value={site.name} highlight={highlight} />
            </span>
          </div>

          <div className='flex w-full min-w-0 items-center justify-center gap-1 sm:w-auto sm:shrink-0'>
            <TooltipWrapper label={timeText}>
              <span className='text-muted-foreground max-w-full min-w-0 truncate text-[11px] sm:shrink-0'>{timeText}</span>
            </TooltipWrapper>

            {/* //* pinned top right on xs, inline from sm */}
            <div
              className='absolute top-3 right-3 sm:static sm:shrink-0'
              onClick={(e) => {
                //* stop the link from navigating
                e.preventDefault()
                e.stopPropagation()
              }}
            >
              <DataTableRowActions actions={actions} />
            </div>
          </div>
        </div>

        <div className='flex flex-col items-center gap-2 sm:flex-row sm:justify-between'>
          <span className='text-muted-foreground max-w-full min-w-0 truncate text-center text-sm sm:flex-1 sm:text-left'>
            By{' '}
            <span className='text-foreground'>
              <WordsHighlighter value={user.name} highlight={highlight} />
            </span>
            {employeeId && (
              <>
                {' · '}
                <WordsHighlighter value={employeeId} highlight={highlight} />
              </>
            )}
          </span>

          <Badge variant='default' className='shrink-0'>
            <typeConfig.icon /> {typeConfig.label}
          </Badge>
        </div>

        {/* //* status leads the badge block, a badge too wide to sit beside its neighbour wraps instead of squeezing it */}
        <div className='flex flex-wrap items-center justify-center gap-2 sm:justify-start'>
          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>

          <Badge variant='outline' title='Active time, pauses not counted'>
            <Icons.clock /> <span suppressHydrationWarning>{activeText}</span>
          </Badge>

          <Badge variant='outline' title='Transactions'>
            <Icons.fileText /> {session._count.inbounds}
          </Badge>

          {cancelReason && (
            <TooltipWrapper label={cancelReason} labelClassName='max-w-80 wrap-break-word'>
              <span className='text-destructive truncate text-xs'>{cancelReason}</span>
            </TooltipWrapper>
          )}
        </div>
      </Card>
    </Link>
  )
}
