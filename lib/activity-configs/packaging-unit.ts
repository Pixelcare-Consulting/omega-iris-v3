import type { ActivityConfig } from '@/types/activity-log'
import type { InboundItem, PackagingUnit } from '@/prisma/generated/client'

export const PACKAGING_UNIT_ACTIVITY_CONFIG: ActivityConfig<PackagingUnit> = {
  fields: [
    { key: 'code', label: 'Code' },
    { key: 'quantity', label: 'Quantity', format: (row) => row.quantity.toString() },
    { key: 'locationCode', label: 'Location' },
    { key: 'palletCode', label: 'Pallet' },
    { key: 'containerCode', label: 'Container' }
  ]
}

//* the edit saves to the inbound item, logged on the unit
export const PACKAGING_UNIT_DETAIL_ACTIVITY_CONFIG: ActivityConfig<InboundItem> = {
  fields: [
    { key: 'owner', label: 'Owner' },
    { key: 'partNumber', label: 'Part Number' },
    { key: 'commodityCode', label: 'Commodity' },
    { key: 'dateCode', label: 'DC' },
    { key: 'countryOfOrigin', label: 'COO' },
    { key: 'lotCode', label: 'Lot Code' },
    { key: 'packagingTypeCode', label: 'Packaging Type' },
    { key: 'spq', label: 'SPQ' },
    { key: 'cost', label: 'Cost', format: (row) => row.cost?.toString() ?? null },
    { key: 'isMandatoryQc', label: 'Mandatory QC' },
    { key: 'notes', label: 'Notes' }
  ]
}
