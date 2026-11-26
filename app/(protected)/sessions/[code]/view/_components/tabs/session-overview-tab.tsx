'use client'

import { SessionWithInclude } from '@/actions/session'
import { Row } from '@/components/row'
import { Column } from '@/components/column'
import ContentWrapper from '@/components/content-wrapper'
import ReadOnlyFieldHeader from '@/components/read-only-field-header'
import { Separator } from '@/components/ui/separator'
import ReadOnlyField from '@/components/read-only-field'
import Copy from '@/components/copy'
import RecordMetaData from '@/components/record-meta-data'
import RelationLink from '@/components/relation-link'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { SESSION_STATUS_CONFIG, SESSION_TYPE_CONFIG } from '@/constants/session'
import { formatActiveTime, getActiveSeconds } from '@/lib/session'
import { formatDate, toCodeName } from '@/lib/utils'

type SessionOverviewTabProps = { session: SessionWithInclude }

const toDateTime = (value: Date | null) => (value ? formatDate(new Date(value), 'MMM d, yyyy h:mm a') : null)

export default function SessionOverviewTab({ session }: SessionOverviewTabProps) {
  const status = SESSION_STATUS_CONFIG[session.status]

  return (
    <ContentWrapper className='h-full'>
      <ScrollArea className='min-h-0 flex-1 p-4' type='auto'>
        <Row className='w-full' gap={5}>
          <Column>
            <ReadOnlyFieldHeader title='Details' description="Session's details" />
            <Separator className='mt-4' />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Code' value={session.code}>
              <Copy value={session.code} />
            </ReadOnlyField>
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Type' value={SESSION_TYPE_CONFIG[session.type].label} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Status' value={<Badge variant={status.variant}>{status.label}</Badge>} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField
              title='Site'
              value={<RelationLink href={`/sites/${encodeURIComponent(session.site.code)}/view`}>{toCodeName(session.site)}</RelationLink>}
            />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField
              title='User'
              value={<RelationLink href={`/users/${session.user.code}/view`}>{session.user.name}</RelationLink>}
            />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Employee ID' value={session.employeeId} />
          </Column>

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='Time' description='When the session ran' />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Started' value={toDateTime(session.startedAt)} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Ended' value={toDateTime(session.endedAt)} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField
              title='Active Time'
              description='Run time minus pauses'
              value={<span suppressHydrationWarning>{formatActiveTime(getActiveSeconds(session, new Date()))}</span>}
            />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Pauses' value={String(session.pauses.length)} />
          </Column>

          {session.cancelReason && (
            <>
              <Column>
                <Separator className='mt-3 mb-4' />
                <ReadOnlyFieldHeader title='Cancellation' description='Why the session was cancelled' />
              </Column>

              <Column>
                <ReadOnlyField title='Cancel Reason' value={session.cancelReason} />
              </Column>
            </>
          )}

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='Record Meta Data' description="Session's record meta data" />
          </Column>

          <RecordMetaData
            createdAt={session.createdAt}
            updatedAt={session.updatedAt}
            deletedAt={session.deletedAt}
            createdBy={session.createdBy}
            updatedBy={session.updatedBy}
            deletedBy={session.deletedBy}
          />
        </Row>
      </ScrollArea>
    </ContentWrapper>
  )
}
