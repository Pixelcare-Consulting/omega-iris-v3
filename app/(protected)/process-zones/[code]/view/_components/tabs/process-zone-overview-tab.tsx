'use client'

import { ProcessZone } from '@/prisma/generated/client'
import { Row } from '@/components/row'
import { Column } from '@/components/column'
import ContentWrapper from '@/components/content-wrapper'
import ReadOnlyFieldHeader from '@/components/read-only-field-header'
import { Separator } from '@/components/ui/separator'
import ReadOnlyField from '@/components/read-only-field'
import Copy from '@/components/copy'
import RecordMetaData from '@/components/record-meta-data'
import { ScrollArea } from '@/components/ui/scroll-area'

type ProcessZoneOverviewTabProps = { processZone: ProcessZone }

export default function ProcessZoneOverviewTab({ processZone }: ProcessZoneOverviewTabProps) {
  return (
    <ContentWrapper className='h-full'>
      <ScrollArea className='min-h-0 flex-1 p-4' type='auto'>
        <Row className='w-full' gap={5}>
          <Column>
            <ReadOnlyFieldHeader title='Overview' description="Process zone's overview information" />
            <Separator className='mt-4' />
          </Column>

          <Column md={6} lg={4}>
            <ReadOnlyField title='Code' value={processZone.code}>
              <Copy value={processZone.code} />
            </ReadOnlyField>
          </Column>

          <Column md={6} lg={4}>
            <ReadOnlyField title='Name' value={processZone.name} />
          </Column>

          <Column md={6} lg={4}>
            <ReadOnlyField title='Active' value={processZone.isActive ? 'Yes' : 'No'} />
          </Column>

          <Column md={6} lg={4}>
            <ReadOnlyField title='Pallet Eligible' value={processZone.isPalletEligible ? 'Yes' : 'No'} />
          </Column>

          <Column md={6} lg={4}>
            <ReadOnlyField title='System' description='System generated, view only' value={processZone.isSystem ? 'Yes' : 'No'} />
          </Column>

          <Column>
            <ReadOnlyField title='Description' value={processZone.description} />
          </Column>

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='Record Meta Data' description="Process zone's record meta data" />
          </Column>

          <RecordMetaData
            createdAt={processZone.createdAt}
            updatedAt={processZone.updatedAt}
            deletedAt={processZone.deletedAt}
            createdBy={processZone.createdBy}
            updatedBy={processZone.updatedBy}
            deletedBy={processZone.deletedBy}
          />
        </Row>
      </ScrollArea>
    </ContentWrapper>
  )
}
