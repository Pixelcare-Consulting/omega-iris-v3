'use client'

import { Site } from '@/prisma/generated/client'
import { Row } from '@/components/row'
import { Column } from '@/components/column'
import ContentWrapper from '@/components/content-wrapper'
import ReadOnlyFieldHeader from '@/components/read-only-field-header'
import { Separator } from '@/components/ui/separator'
import ReadOnlyField from '@/components/read-only-field'
import Copy from '@/components/copy'
import RecordMetaData from '@/components/record-meta-data'
import { ScrollArea } from '@/components/ui/scroll-area'

type SiteOverviewTabProps = { site: Site }

export default function SiteOverviewTab({ site }: SiteOverviewTabProps) {
  return (
    <ContentWrapper className='h-full'>
      <ScrollArea className='min-h-0 flex-1 p-4' type='auto'>
        <Row className='w-full' gap={5}>
          <Column>
            <ReadOnlyFieldHeader title='Overview' description="Site's overview information" />
            <Separator className='mt-4' />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Code' value={site.code}>
              <Copy value={site.code} />
            </ReadOnlyField>
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Name' value={site.name} />
          </Column>

          <Column>
            <ReadOnlyField title='Description' value={site.description} />
          </Column>

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='Processes' description='Processes the site allows' />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Inbound' description='Site can receive stock' value={site.isEnableInbound ? 'Yes' : 'No'} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Outbound' description='Site can ship stock' value={site.isEnableOutbound ? 'Yes' : 'No'} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Movement' description='Site can move stock' value={site.isEnableMovement ? 'Yes' : 'No'} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField
              title='Cycle Count'
              description='Stock at the site can be counted'
              value={site.isEnableCycleCount ? 'Yes' : 'No'}
            />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='QC/Testing' description='Stock at the site can be tested' value={site.isEnableQcTesting ? 'Yes' : 'No'} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='RMA' description='Site can take returns' value={site.isEnableRma ? 'Yes' : 'No'} />
          </Column>

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='Settings' description="Site's setting" />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Active' description='Inactive sites are hidden from selection' value={site.isActive ? 'Yes' : 'No'} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='System' description='System generated, view only' value={site.isSystem ? 'Yes' : 'No'} />
          </Column>

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='Record Meta Data' description="Site's record meta data" />
          </Column>

          <RecordMetaData
            createdAt={site.createdAt}
            updatedAt={site.updatedAt}
            deletedAt={site.deletedAt}
            createdBy={site.createdBy}
            updatedBy={site.updatedBy}
            deletedBy={site.deletedBy}
          />
        </Row>
      </ScrollArea>
    </ContentWrapper>
  )
}
