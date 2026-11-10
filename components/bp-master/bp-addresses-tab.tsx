'use client'

import { BpMasterWithRelations } from '@/actions/bp-master'
import { BP_ADDRESS_TYPE_LABELS, BP_ADDRESS_TYPES } from '@/constants/bp-master'
import ContentWrapper from '@/components/content-wrapper'
import ReadOnlyFieldHeader from '@/components/read-only-field-header'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import EmptyState from '@/components/empty-state'
import { Icons } from '@/components/icons'
import BpRecordCard from './bp-record-card'

type BpAddressesTabProps = { bpMaster: BpMasterWithRelations }

type Address = BpMasterWithRelations['addresses'][number]

const toAddressFields = (a: Address): [string, string | null][] => [
  ['Line 1', a.line1],
  ['Line 2', a.line2],
  ['Line 3', a.line3],
  ['Street No.', a.streetNo],
  ['Building/Floor/Room', a.buildingFloorRoom],
  ['Block', a.block],
  ['City', a.city],
  ['Zip Code', a.zipCode],
  ['Country', a.countryName],
  ['State/Province', a.stateName]
]

export default function BpAddressesTab({ bpMaster }: BpAddressesTabProps) {
  const groups = [BP_ADDRESS_TYPES.BILLING, BP_ADDRESS_TYPES.SHIPPING].map((type) => ({
    type,
    label: BP_ADDRESS_TYPE_LABELS[type],
    rows: bpMaster.addresses.filter((a) => a.type === type)
  }))

  return (
    <ContentWrapper className='h-full'>
      <ScrollArea className='min-h-0 flex-1 p-4' type='auto'>
        <div className='flex flex-col gap-5'>
          {groups.map((group, index) => (
            <div key={group.type} className='flex flex-col gap-4'>
              {index > 0 && <Separator className='mb-1' />}

              <ReadOnlyFieldHeader title={`${group.label} Addresses`} description={`${group.label} address details`} />

              {group.rows.length === 0 ? (
                <EmptyState
                  title={`No ${group.label.toLowerCase()} addresses`}
                  description={`This record has no ${group.label.toLowerCase()} address yet.`}
                  icon={<Icons.mapPin />}
                  className='min-h-40'
                />
              ) : (
                group.rows.map((a) => (
                  <BpRecordCard key={a.id} code={a.code} name={a.name} isDefault={a.isDefault} fields={toAddressFields(a)} />
                ))
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </ContentWrapper>
  )
}
