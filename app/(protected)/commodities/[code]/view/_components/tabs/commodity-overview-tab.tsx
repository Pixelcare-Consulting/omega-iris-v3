'use client'

import { Commodity } from '@/prisma/generated/client'
import { Row } from '@/components/row'
import { Column } from '@/components/column'
import ContentWrapper from '@/components/content-wrapper'
import ReadOnlyFieldHeader from '@/components/read-only-field-header'
import { Separator } from '@/components/ui/separator'
import ReadOnlyField from '@/components/read-only-field'
import Copy from '@/components/copy'
import RecordMetaData from '@/components/record-meta-data'
import { ScrollArea } from '@/components/ui/scroll-area'

type CommodityOverviewTabProps = { commodity: Commodity }

export default function CommodityOverviewTab({ commodity }: CommodityOverviewTabProps) {
  return (
    <ContentWrapper className='h-full'>
      <ScrollArea className='min-h-0 flex-1 p-4' type='auto'>
        <Row className='w-full' gap={5}>
          <Column>
            <ReadOnlyFieldHeader title='Overview' description="Commodity's overview information" />
            <Separator className='mt-4' />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Code' value={commodity.code}>
              <Copy value={commodity.code} />
            </ReadOnlyField>
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Name' value={commodity.name} />
          </Column>

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='Settings' description="Commodity's setting" />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField
              title='Active'
              description='Inactive commodities are hidden from selection'
              value={commodity.isActive ? 'Yes' : 'No'}
            />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='System' description='System generated, view only' value={commodity.isSystem ? 'Yes' : 'No'} />
          </Column>

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='Record Meta Data' description="Commodity's record meta data" />
          </Column>

          <RecordMetaData
            createdAt={commodity.createdAt}
            updatedAt={commodity.updatedAt}
            deletedAt={commodity.deletedAt}
            createdBy={commodity.createdBy}
            updatedBy={commodity.updatedBy}
            deletedBy={commodity.deletedBy}
          />
        </Row>
      </ScrollArea>
    </ContentWrapper>
  )
}
