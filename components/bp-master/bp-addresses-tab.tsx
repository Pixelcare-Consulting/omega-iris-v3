'use client'

import { BpMasterRow } from '@/actions/bp-master'
import { BP_ADDRESS_TYPE_LABELS, BP_ADDRESS_TYPES } from '@/constants/bp-master'
import ContentWrapper from '@/components/content-wrapper'
import ReadOnlyFieldHeader from '@/components/read-only-field-header'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import EmptyState from '@/components/empty-state'
import { Icons } from '@/components/icons'
import { isSameName } from '@/schema/bp-master'
import BpRecordCard from './bp-record-card'

type BpAddressesTabProps = { bpMaster: BpMasterRow }

type Address = BpMasterRow['addresses'][number]

const toAddressFields = (a: Address): [string, string | null][] => [
  ['Street / PO Box', a.Street],
  ['Address 2', a.Address2],
  ['Address 3', a.Address3],
  ['Street No.', a.StreetNo],
  ['Building/Floor/Room', a.BuildingFloorRoom],
  ['Block', a.Block],
  ['City', a.City],
  ['Zip Code', a.ZipCode],
  ['County', a.County],
  ['Country', a.CountryName ?? a.CountryCode],
  ['State/Province', a.StateName ?? a.StateCode]
]

export default function BpAddressesTab({ bpMaster }: BpAddressesTabProps) {
  const groups = [BP_ADDRESS_TYPES.BILLING, BP_ADDRESS_TYPES.SHIPPING].map((type) => ({
    type,
    label: BP_ADDRESS_TYPE_LABELS[type],
    defaultName: type === BP_ADDRESS_TYPES.BILLING ? bpMaster.BillToDef : bpMaster.ShipToDef,
    rows: bpMaster.addresses.filter((a) => a.AddrType === type)
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
                  <BpRecordCard
                    key={a.id}
                    name={a.AddressName}
                    isDefault={isSameName(a.AddressName, group.defaultName)}
                    syncStatus={a.syncStatus}
                    fields={toAddressFields(a)}
                  />
                ))
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </ContentWrapper>
  )
}
