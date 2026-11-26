'use client'

import { InboundWithInclude } from '@/actions/inbound'
import { Row } from '@/components/row'
import { Column } from '@/components/column'
import ContentWrapper from '@/components/content-wrapper'
import ReadOnlyFieldHeader from '@/components/read-only-field-header'
import ReadOnlyField from '@/components/read-only-field'
import Copy from '@/components/copy'
import RecordMetaData from '@/components/record-meta-data'
import RelationLink from '@/components/relation-link'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { INBOUND_STATUS_CONFIG } from '@/constants/inbound'
import { formatDate, toCodeName } from '@/lib/utils'

type InboundOverviewTabProps = { inbound: InboundWithInclude }

const toYesNo = (value: boolean | undefined) => (value === undefined ? null : value ? 'Yes' : 'No')

export default function InboundOverviewTab({ inbound }: InboundOverviewTabProps) {
  const status = INBOUND_STATUS_CONFIG[inbound.status]
  const category = inbound.customerProject?.category
  const totalStock = inbound.items.reduce((total, item) => total + item.totalStock, 0)

  return (
    <ContentWrapper className='h-full'>
      <ScrollArea className='min-h-0 flex-1 p-4' type='auto'>
        <Row className='w-full' gap={5}>
          <Column>
            <ReadOnlyFieldHeader title='Details' description="Inbound's details" />
            <Separator className='mt-4' />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Code' value={inbound.code}>
              <Copy value={inbound.code} />
            </ReadOnlyField>
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Status' value={<Badge variant={status.variant}>{status.label}</Badge>} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField
              title='Session'
              value={<RelationLink href={`/sessions/${encodeURIComponent(inbound.sessionCode)}/view`}>{inbound.sessionCode}</RelationLink>}
            />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField
              title='User'
              value={<RelationLink href={`/users/${inbound.session.user.code}/view`}>{inbound.session.user.name}</RelationLink>}
            />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField
              title='Site'
              value={
                <RelationLink href={`/sites/${encodeURIComponent(inbound.session.site.code)}/view`}>
                  {toCodeName(inbound.session.site)}
                </RelationLink>
              }
            />
          </Column>

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='Location' description='Where the goods arrived' />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField
              title='Receiving Location'
              value={
                inbound.location ? (
                  <RelationLink href={`/locations/${encodeURIComponent(inbound.location.code)}/view`}>
                    {toCodeName(inbound.location)}
                  </RelationLink>
                ) : null
              }
            />
          </Column>

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='Project' description='Who the goods are for' />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField
              title='Customer Project'
              value={
                inbound.customerProject ? (
                  <RelationLink href={`/customer-projects/${encodeURIComponent(inbound.customerProject.code)}/view`}>
                    {toCodeName(inbound.customerProject)}
                  </RelationLink>
                ) : null
              }
            />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField
              title='Category'
              value={
                category ? (
                  <RelationLink href={`/project-categories/${encodeURIComponent(category.code)}/view`}>{toCodeName(category)}</RelationLink>
                ) : null
              }
            />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='PO Required' value={toYesNo(category?.isPoRequired)} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Mandatory QC' value={toYesNo(category?.isMandatoryQc)} />
          </Column>

          {category?.isPoRequired && (
            <>
              <Column>
                <Separator className='mt-3 mb-4' />
                <ReadOnlyFieldHeader title='Purchase Order' description='The SAP PO it was received against' />
              </Column>

              <Column md={6} lg={3}>
                <ReadOnlyField title='Purchase Order' value={inbound.poNum ? `PO ${inbound.poNum}` : null} />
              </Column>

              <Column md={6} lg={3}>
                <ReadOnlyField title='Partial Receiving' value={toYesNo(inbound.isPartialReceived)} />
              </Column>
            </>
          )}

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='Review' description='What was received' />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Packages' value={String(inbound.items.length)} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Total Pcs' value={totalStock.toLocaleString('en-US')} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField
              title='Submitted At'
              value={inbound.submittedAt ? formatDate(new Date(inbound.submittedAt), 'MMM d, yyyy h:mm a') : null}
            />
          </Column>

          <Column>
            <ReadOnlyField title='Notes' value={inbound.notes} />
          </Column>

          {inbound.cancelReason && (
            <>
              <Column>
                <Separator className='mt-3 mb-4' />
                <ReadOnlyFieldHeader title='Cancellation' description='Why the inbound was cancelled' />
              </Column>

              <Column>
                <ReadOnlyField title='Cancel Reason' value={inbound.cancelReason} />
              </Column>
            </>
          )}

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='Record Meta Data' description="Inbound's record meta data" />
          </Column>

          <RecordMetaData
            createdAt={inbound.createdAt}
            updatedAt={inbound.updatedAt}
            createdBy={inbound.createdBy}
            updatedBy={inbound.updatedBy}
          />
        </Row>
      </ScrollArea>
    </ContentWrapper>
  )
}
