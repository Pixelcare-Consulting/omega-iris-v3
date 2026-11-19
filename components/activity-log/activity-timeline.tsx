'use client'

import { useState } from 'react'
import { ColumnDef, ColumnFiltersState, getCoreRowModel, useReactTable } from '@tanstack/react-table'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import ContentWrapper from '@/components/content-wrapper'
import ReadOnlyFieldHeader from '@/components/read-only-field-header'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Skeleton } from '@/components/ui/skeleton'
import { Icons } from '@/components/icons'
import { cn, formatDate } from '@/lib/utils'
import { useActivityTimeline } from '@/hooks/safe-actions/activity-log'
import { ACTIVITY_ACTIONS, ACTIVITY_SOURCE_LABELS, ACTIVITY_TIMELINE_PAGE_SIZE, ActivityModule } from '@/constants/activity-log'
import type { ActivityLog } from '@/prisma/generated/client'
import type { ActivityChanges as ActivityChangesData } from '@/types/activity-log'
import { WordsHighlighter } from '@/components/words-highlighter'
import DataTableGlobalSearch from '@/components/data-table/data-table-global-search'
import DataTableColumnFilter from '@/components/data-table/data-table-faceted-filter'
import DataTableColumnDateFilter from '@/components/data-table/data-table-column-date-filter'
import DataTableColumnFilterWrapper from '@/components/data-table/data-table-column-filter-wrapper'
import ActivityChanges, { changesMatch, toSearchKeywords } from './activity-changes'
import ActivityLegend from './activity-legend'
import { ACTIVITY_TONE_STYLES, getActionLabel, getActionTone } from './activity-tone'

const ACTION_OPTIONS = Object.entries(ACTIVITY_ACTIONS).map(([value, { label }]) => ({ label, value }))

//* only holds the search and filter state, the rows come from the server
const FILTER_COLUMNS: ColumnDef<ActivityLog>[] = [
  { accessorKey: 'action', meta: { title: 'Action', options: ACTION_OPTIONS } },
  { accessorKey: 'createdAt', meta: { title: 'Date' } }
]

//* added after the general search tips
const SEARCH_TIPS = (
  <>
    <li>Here it also looks inside the details, addresses and contacts included.</li>
    <li>Matching entries on the first page open on their own.</li>
  </>
)

function hasDetails(changes: ActivityChangesData | null) {
  return !!changes && (changes.fields.length > 0 || (changes.children ?? []).length > 0)
}

type ActivityEntryProps = { log: ActivityLog; isLast: boolean; highlight?: string; isAutoOpen: boolean }

function ActivityEntry({ log, isLast, highlight, isAutoOpen }: ActivityEntryProps) {
  const [isOpen, setIsOpen] = useState(isAutoOpen)

  const tone = ACTIVITY_TONE_STYLES[getActionTone(log.action)]
  const actionLabel = getActionLabel(log.action)
  const changes = log.changes as ActivityChangesData | null
  const canOpen = hasDetails(changes)
  const when = formatDate(new Date(log.createdAt), 'PP p')

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className='flex gap-4'>
      <div className='flex w-3.5 flex-col items-center'>
        <span className={cn('ring-border border-background mt-1.5 size-3 shrink-0 rounded-full border-2 ring-1', tone.dot)} />
        {!isLast && <span className='bg-border mt-1 w-px flex-1' />}
      </div>

      <div className='flex min-w-0 flex-1 flex-col gap-1.5 pb-6'>
        <div className='flex flex-wrap items-center gap-2.5'>
          <Badge variant={tone.badge}>{actionLabel}</Badge>
          {/* //* skip a summary that only repeats the badge */}
          {log.summary !== actionLabel && (
            <span className='text-sm font-medium'>
              <WordsHighlighter value={log.summary} highlight={highlight} />
            </span>
          )}

          {canOpen && (
            <CollapsibleTrigger asChild>
              <Button type='button' variant='ghost' size='sm' className='ml-auto'>
                {isOpen ? <Icons.down /> : <Icons.right />}
                {isOpen ? 'Hide details' : 'Show details'}
              </Button>
            </CollapsibleTrigger>
          )}
        </div>

        {/* //* who, where and when, a system row has no person */}
        <span className='text-muted-foreground text-sm'>
          {log.source === 'SYSTEM' ? (
            ACTIVITY_SOURCE_LABELS.SYSTEM
          ) : (
            <>
              <WordsHighlighter value={log.userName} highlight={highlight} /> · {ACTIVITY_SOURCE_LABELS[log.source]}
            </>
          )}{' '}
          · {when}
        </span>

        {canOpen && (
          <CollapsibleContent className='pt-2'>
            <ActivityChanges changes={changes} highlight={highlight} />
          </CollapsibleContent>
        )}
      </div>
    </Collapsible>
  )
}

type ActivityTimelineProps = { module: ActivityModule; entityId: string }

export default function ActivityTimeline({ module, entityId }: ActivityTimelineProps) {
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const table = useReactTable({
    data: [] as ActivityLog[],
    columns: FILTER_COLUMNS,
    state: { globalFilter, columnFilters },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    manualFiltering: true
  })

  const { items, isLoading, hasMore, loadMore } = useActivityTimeline(module, entityId, { search: globalFilter, columnFilters })

  const keywords = toSearchKeywords(globalFilter)
  const isFiltered = keywords.length > 0 || columnFilters.length > 0
  const isFirstLoad = isLoading && items.length === 0

  //! only the first page opens on its own, a common word across many loaded pages would render thousands of cells
  const autoOpenIds = new Set(
    items
      .slice(0, ACTIVITY_TIMELINE_PAGE_SIZE)
      .flatMap((log) => (changesMatch(log.changes as ActivityChangesData | null, keywords) ? [log.id] : []))
  )

  return (
    //* same shell as the other tabs, the header stays put and the entries scroll
    <ContentWrapper className='h-full flex-col p-0'>
      <div className='flex shrink-0 flex-col gap-4 px-4 pt-4'>
        <div>
          <ReadOnlyFieldHeader title='Activity' description='Changes made to this record' actions={<ActivityLegend />} />
          <Separator className='mt-4' />
        </div>

        <DataTableColumnFilterWrapper>
          <DataTableGlobalSearch
            table={table}
            placeholder='Search summary, user, changes...'
            isLoading={isLoading}
            //! the filter wrapper sets lg:*:w-auto, so the width needs the important flag to win
            className='lg:w-96! lg:max-w-none'
            tips={SEARCH_TIPS}
          />
          <DataTableColumnFilter column={table.getColumn('action')} title='Action' isLoading={isLoading} />
          <DataTableColumnDateFilter column={table.getColumn('createdAt')} title='Date' isLoading={isLoading} />
        </DataTableColumnFilterWrapper>
      </div>

      {/* //* right padding keeps the tables off the scrollbar */}
      <ScrollArea className='min-h-0 flex-1 pt-5 pr-6 pb-1 pl-4' type='auto'>
        {isFirstLoad && (
          <div className='flex flex-col gap-4 pb-3'>
            {[0, 1, 2].map((key) => (
              <Skeleton key={key} className='h-12 w-full' />
            ))}
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <p className='text-muted-foreground pb-3 text-center text-sm'>
            {isFiltered ? 'No activity matches your search' : 'No activity yet'}
          </p>
        )}

        {items.map((log, index) => (
          //* the search is in the key, so a new search folds everything back before opening its matches
          <ActivityEntry
            key={`${log.id}|${globalFilter}`}
            log={log}
            isLast={index === items.length - 1 && !hasMore}
            highlight={globalFilter}
            isAutoOpen={autoOpenIds.has(log.id)}
          />
        ))}

        {hasMore && (
          <div className='flex justify-center pb-3'>
            <Button type='button' variant='outline' onClick={loadMore} disabled={isLoading}>
              {isLoading ? 'Loading...' : 'Load more'}
            </Button>
          </div>
        )}
      </ScrollArea>
    </ContentWrapper>
  )
}
