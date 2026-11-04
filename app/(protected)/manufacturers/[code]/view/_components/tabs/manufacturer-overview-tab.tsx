'use client'

import { Manufacturer } from '@/prisma/generated/client'
import { Row } from '@/components/row'
import { Column } from '@/components/column'
import ContentWrapper from '@/components/content-wrapper'
import ReadOnlyFieldHeader from '@/components/read-only-field-header'
import { Separator } from '@/components/ui/separator'
import ReadOnlyField from '@/components/read-only-field'
import Copy from '@/components/copy'
import RecordMetaData from '@/components/record-meta-data'
import { ScrollArea } from '@/components/ui/scroll-area'

type ManufacturerOverviewTabProps = { manufacturer: Manufacturer }

export default function ManufacturerOverviewTab({ manufacturer }: ManufacturerOverviewTabProps) {
  return (
    <ContentWrapper className='h-full'>
      <ScrollArea className='min-h-0 flex-1 p-4' type='auto'>
        <Row className='w-full' gap={5}>
          <Column>
            <ReadOnlyFieldHeader title='Overview' description="Manufacturer's overview information" />
            <Separator className='mt-4' />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Code' value={manufacturer.code}>
              <Copy value={manufacturer.code} />
            </ReadOnlyField>
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Name' value={manufacturer.name} />
          </Column>

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='Settings' description="Manufacturer's setting" />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField
              title='Active'
              description='Inactive manufacturers are hidden from selection'
              value={manufacturer.isActive ? 'Yes' : 'No'}
            />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='System' description='System generated, view only' value={manufacturer.isSystem ? 'Yes' : 'No'} />
          </Column>

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='Record Meta Data' description="Manufacturer's record meta data" />
          </Column>

          <RecordMetaData
            createdAt={manufacturer.createdAt}
            updatedAt={manufacturer.updatedAt}
            deletedAt={manufacturer.deletedAt}
            createdBy={manufacturer.createdBy}
            updatedBy={manufacturer.updatedBy}
            deletedBy={manufacturer.deletedBy}
          />
        </Row>
      </ScrollArea>
    </ContentWrapper>
  )
}
