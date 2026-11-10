'use client'

import { BpMasterWithRelations } from '@/actions/bp-master'
import { BP_ADDRESS_TYPES, BP_MASTER_CONFIG, BpMasterType } from '@/constants/bp-master'
import { Row } from '@/components/row'
import { Column } from '@/components/column'
import ContentWrapper from '@/components/content-wrapper'
import ReadOnlyFieldHeader from '@/components/read-only-field-header'
import { Separator } from '@/components/ui/separator'
import ReadOnlyField from '@/components/read-only-field'
import Copy from '@/components/copy'
import RecordMetaData from '@/components/record-meta-data'
import { ScrollArea } from '@/components/ui/scroll-area'

type BpMasterOverviewTabProps = { type: BpMasterType; bpMaster: BpMasterWithRelations }

export default function BpMasterOverviewTab({ type, bpMaster }: BpMasterOverviewTabProps) {
  const { label } = BP_MASTER_CONFIG[type]

  const billing = bpMaster.addresses.find((a) => a.type === BP_ADDRESS_TYPES.BILLING && a.isDefault)
  const shipping = bpMaster.addresses.find((a) => a.type === BP_ADDRESS_TYPES.SHIPPING && a.isDefault)
  const contact = bpMaster.contacts.find((c) => c.isDefault)

  return (
    <ContentWrapper className='h-full'>
      <ScrollArea className='min-h-0 flex-1 p-4' type='auto'>
        <Row className='w-full' gap={5}>
          <Column>
            <ReadOnlyFieldHeader title='Details' description={`${label}'s details`} />
            <Separator className='mt-4' />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Code' value={bpMaster.code}>
              <Copy value={bpMaster.code} />
            </ReadOnlyField>
          </Column>

          <Column md={6} lg={9}>
            <ReadOnlyField title='Name' value={bpMaster.name} />
          </Column>

          <Column md={6} lg={4}>
            <ReadOnlyField title='Default Bill-To' value={billing?.name ?? ''} />
          </Column>

          <Column md={6} lg={4}>
            <ReadOnlyField title='Default Ship-To' value={shipping?.name ?? ''} />
          </Column>

          <Column md={6} lg={4}>
            <ReadOnlyField title='Contact Person' value={contact?.name ?? ''} />
          </Column>

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='Record Meta Data' description={`${label}'s record meta data`} />
          </Column>

          <RecordMetaData
            createdAt={bpMaster.createdAt}
            updatedAt={bpMaster.updatedAt}
            deletedAt={bpMaster.deletedAt}
            createdBy={bpMaster.createdBy}
            updatedBy={bpMaster.updatedBy}
            deletedBy={bpMaster.deletedBy}
          />
        </Row>
      </ScrollArea>
    </ContentWrapper>
  )
}
