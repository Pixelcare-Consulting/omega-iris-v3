'use client'

import { LocationWithRelations } from '@/actions/location'
import { Row } from '@/components/row'
import { Column } from '@/components/column'
import ContentWrapper from '@/components/content-wrapper'
import ReadOnlyFieldHeader from '@/components/read-only-field-header'
import { Separator } from '@/components/ui/separator'
import ReadOnlyField from '@/components/read-only-field'
import Copy from '@/components/copy'
import RecordMetaData from '@/components/record-meta-data'
import { ScrollArea } from '@/components/ui/scroll-area'
import { LOCATION_TYPE_LABELS } from '@/constants/location'

type LocationOverviewTabProps = { location: LocationWithRelations }

export default function LocationOverviewTab({ location }: LocationOverviewTabProps) {
  return (
    <ContentWrapper className='h-full'>
      <ScrollArea className='min-h-0 flex-1 p-4' type='auto'>
        <Row className='w-full' gap={5}>
          <Column>
            <ReadOnlyFieldHeader title='Details' description="Location's details" />
            <Separator className='mt-4' />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Code' value={location.code}>
              <Copy value={location.code} />
            </ReadOnlyField>
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Name' value={location.name} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Type' value={location.type ? LOCATION_TYPE_LABELS[location.type] : null} />
          </Column>

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='Position' description='Where the location sits' />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Site' value={`${location.siteCode} - ${location.site.name}`} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Process Zone' value={`${location.processZoneCode} - ${location.processZone.name}`} />
          </Column>

          <Column md={4} lg={2}>
            <ReadOnlyField title='Bay' value={location.bayCode} />
          </Column>

          <Column md={4} lg={2}>
            <ReadOnlyField title='Level' value={location.levelCode} />
          </Column>

          <Column md={4} lg={2}>
            <ReadOnlyField title='Rack' value={location.rackCode} />
          </Column>

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='Settings' description="Location's setting" />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField
              title='Active'
              description='Inactive locations are hidden from selection'
              value={location.isActive ? 'Yes' : 'No'}
            />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Pallet Allowed' value={location.isPalletAllowed ? 'Yes' : 'No'} />
          </Column>

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='Record Meta Data' description="Location's record meta data" />
          </Column>

          <RecordMetaData
            createdAt={location.createdAt}
            updatedAt={location.updatedAt}
            deletedAt={location.deletedAt}
            createdBy={location.createdBy}
            updatedBy={location.updatedBy}
            deletedBy={location.deletedBy}
          />
        </Row>
      </ScrollArea>
    </ContentWrapper>
  )
}
