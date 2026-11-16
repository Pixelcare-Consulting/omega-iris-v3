'use client'

import { BpMasterRow } from '@/actions/bp-master'
import { BP_MASTER_CONFIG, BpMasterType } from '@/constants/bp-master'
import { COMPANY_PRIVATE_OPTIONS, toOptionLabel } from '@/constants/business-partner'
import { Row } from '@/components/row'
import { Column } from '@/components/column'
import ContentWrapper from '@/components/content-wrapper'
import ReadOnlyFieldHeader from '@/components/read-only-field-header'
import { Separator } from '@/components/ui/separator'
import ReadOnlyField from '@/components/read-only-field'
import Copy from '@/components/copy'
import RecordMetaData from '@/components/record-meta-data'
import SapSyncStatusBadge from '@/components/sap-sync-status-badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatDate } from '@/lib/utils'

type BpMasterOverviewTabProps = { type: BpMasterType; bpMaster: BpMasterRow }

export default function BpMasterOverviewTab({ type, bpMaster }: BpMasterOverviewTabProps) {
  const { label } = BP_MASTER_CONFIG[type]

  return (
    <ContentWrapper className='h-full'>
      <ScrollArea className='min-h-0 flex-1 p-4' type='auto'>
        <Row className='w-full' gap={5}>
          <Column>
            <ReadOnlyFieldHeader title='Details' description={`${label}'s details`} />
            <Separator className='mt-4' />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Code' value={bpMaster.CardCode}>
              <Copy value={bpMaster.CardCode} />
            </ReadOnlyField>
          </Column>

          <Column md={6} lg={9}>
            <ReadOnlyField title='Name' value={bpMaster.CardName} />
          </Column>

          <Column md={6} lg={4}>
            <ReadOnlyField title='Group' value={bpMaster.GroupName ?? ''} />
          </Column>

          <Column md={6} lg={4}>
            <ReadOnlyField title='Currency' value={bpMaster.CurrName ?? bpMaster.CurrCode ?? ''} />
          </Column>

          <Column md={6} lg={4}>
            <ReadOnlyField title='Payment Terms' value={bpMaster.PymntGroup ?? ''} />
          </Column>

          <Column md={6} lg={4}>
            <ReadOnlyField title='Account Type' value={bpMaster.AcctType ?? ''} />
          </Column>

          <Column md={6} lg={4}>
            <ReadOnlyField title='Type of Business' value={toOptionLabel(COMPANY_PRIVATE_OPTIONS, bpMaster.CmpPrivate)} />
          </Column>

          <Column md={6} lg={4}>
            <ReadOnlyField title='Contact Person' value={bpMaster.CntctPrsn ?? ''} />
          </Column>

          <Column md={6} lg={4}>
            <ReadOnlyField title='Default Bill-To' value={bpMaster.BillToDef ?? ''} />
          </Column>

          <Column md={6} lg={4}>
            <ReadOnlyField title='Default Ship-To' value={bpMaster.ShipToDef ?? ''} />
          </Column>

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='Settings' description={`${label}'s setting`} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Active' value={bpMaster.isActive ? 'Yes' : 'No'} />
          </Column>

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='SAP Sync' description={`${label}'s link with SAP`} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Sync Status' value={<SapSyncStatusBadge status={bpMaster.syncStatus} />} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Synced At' value={bpMaster.syncedAt ? formatDate(bpMaster.syncedAt, 'MMM dd, yyyy hh:mm a') : ''} />
          </Column>

          {bpMaster.syncError && (
            <Column>
              <ReadOnlyField title='Last Sync Error' value={bpMaster.syncError} />
            </Column>
          )}

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
