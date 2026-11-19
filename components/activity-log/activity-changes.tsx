'use client'

import { Fragment, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Icons } from '@/components/icons'
import { WordsHighlighter } from '@/components/words-highlighter'
import { splitGlobalFilterKeywords } from '@/lib/data-table'
import { ACTIVITY_OP_LABELS, ACTIVITY_OP_TONES } from '@/constants/activity-log'
import { ACTIVITY_TONE_STYLES } from './activity-tone'
import type { ActivityChanges as ActivityChangesData, ActivityChildGroup, ActivityChildOp, ActivityFieldChange } from '@/types/activity-log'

const OPS: ActivityChildOp[] = ['added', 'changed', 'removed']

//* the same text the server search reads, label, from and to, ignoring case
const hasKeyword = (text: string | null, keywords: string[]) => !!text && keywords.some((k) => text.toLowerCase().includes(k))

const fieldsMatch = (fields: ActivityFieldChange[], keywords: string[]) =>
  fields.some((field) => hasKeyword(field.label, keywords) || hasKeyword(field.from, keywords) || hasKeyword(field.to, keywords))

function groupMatches(group: ActivityChildGroup, keywords: string[]) {
  return (
    hasKeyword(group.label, keywords) || group.items.some((item) => hasKeyword(item.label, keywords) || fieldsMatch(item.fields, keywords))
  )
}

export function toSearchKeywords(search?: string) {
  return splitGlobalFilterKeywords(search ?? '').map((keyword) => keyword.toLowerCase())
}

//* true when a search term sits inside the details, so the entry opens to show it
export function changesMatch(changes: ActivityChangesData | null, keywords: string[]) {
  if (!changes || keywords.length === 0) return false
  return fieldsMatch(changes.fields, keywords) || (changes.children ?? []).some((group) => groupMatches(group, keywords))
}

function ValueCell({ value, isBefore, highlight }: { value: string | null; isBefore?: boolean; highlight?: string }) {
  if (value === null) return <TableCell className='text-muted-foreground'>—</TableCell>

  return (
    <TableCell className={isBefore ? 'text-muted-foreground' : 'font-medium'}>
      <span className='whitespace-pre-wrap'>
        <WordsHighlighter value={value} highlight={highlight} />
      </span>
    </TableCell>
  )
}

function ChildGroup({ group, highlight }: { group: ActivityChildGroup; highlight?: string }) {
  //* a group holding the search term opens on its own
  const [isOpen, setIsOpen] = useState(() => groupMatches(group, toSearchKeywords(highlight)))

  const itemTitle = group.noun.charAt(0).toUpperCase() + group.noun.slice(1)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className='bg-card rounded-lg border'>
      <CollapsibleTrigger className='hover:bg-muted/50 flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm'>
        {isOpen ? <Icons.down className='text-muted-foreground size-4' /> : <Icons.right className='text-muted-foreground size-4' />}
        <span className='font-medium'>
          <WordsHighlighter value={group.label} highlight={highlight} />
        </span>

        {OPS.map((op) => {
          const count = group.items.filter((item) => item.op === op).length
          if (count === 0) return null

          return (
            <Badge key={op} variant={ACTIVITY_TONE_STYLES[ACTIVITY_OP_TONES[op]].badge}>
              {count} {ACTIVITY_OP_LABELS[op].toLowerCase()}
            </Badge>
          )
        })}

        <span className='text-muted-foreground ml-auto text-xs'>{isOpen ? 'Hide' : `View ${group.items.length}`}</span>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className='border-t'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-48'>{itemTitle}</TableHead>
                <TableHead className='w-28'>Change</TableHead>
                <TableHead className='w-36'>Field</TableHead>
                <TableHead>Before</TableHead>
                <TableHead>After</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.items.map((item, itemIndex) => {
                const opBadge = (
                  <Badge variant={ACTIVITY_TONE_STYLES[ACTIVITY_OP_TONES[item.op]].badge}>{ACTIVITY_OP_LABELS[item.op]}</Badge>
                )

                const itemLabel = <WordsHighlighter value={item.label} highlight={highlight} />

                //* an added or removed row with no filled fields still gets one line
                if (item.fields.length === 0) {
                  return (
                    <TableRow key={itemIndex}>
                      <TableCell className='font-medium'>{itemLabel}</TableCell>
                      <TableCell>{opBadge}</TableCell>
                      <TableCell className='text-muted-foreground' colSpan={3}>
                        —
                      </TableCell>
                    </TableRow>
                  )
                }

                return (
                  <Fragment key={itemIndex}>
                    {item.fields.map((field, fieldIndex) => (
                      <TableRow key={field.key}>
                        <TableCell className='font-medium'>{fieldIndex === 0 ? itemLabel : ''}</TableCell>
                        <TableCell>{fieldIndex === 0 ? opBadge : null}</TableCell>
                        <TableCell className='text-muted-foreground'>
                          <WordsHighlighter value={field.label} highlight={highlight} />
                        </TableCell>
                        <ValueCell value={field.from} isBefore highlight={highlight} />
                        <ValueCell value={field.to} highlight={highlight} />
                      </TableRow>
                    ))}
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

type ActivityChangesProps = { changes: ActivityChangesData | null; highlight?: string }

export default function ActivityChanges({ changes, highlight }: ActivityChangesProps) {
  if (!changes) return null

  const children = changes.children ?? []

  return (
    <div className='flex flex-col gap-2.5'>
      {changes.fields.length > 0 && (
        <div className='bg-card overflow-hidden rounded-lg border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-48'>Field</TableHead>
                <TableHead>Before</TableHead>
                <TableHead>After</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {changes.fields.map((field) => (
                <TableRow key={field.key}>
                  <TableCell className='text-muted-foreground'>
                    <WordsHighlighter value={field.label} highlight={highlight} />
                  </TableCell>
                  <ValueCell value={field.from} isBefore highlight={highlight} />
                  <ValueCell value={field.to} highlight={highlight} />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {children.map((group) => (
        <ChildGroup key={group.key} group={group} highlight={highlight} />
      ))}
    </div>
  )
}
