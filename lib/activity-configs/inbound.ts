import type { ActivityConfig } from '@/types/activity-log'
import type { Prisma } from '@/prisma/generated/client'
import { INBOUND_STATUS_CONFIG } from '@/constants/inbound'

export const INBOUND_ACTIVITY_INCLUDE = { items: true } satisfies Prisma.InboundInclude

type InboundActivityRow = Prisma.InboundGetPayload<{ include: typeof INBOUND_ACTIVITY_INCLUDE }>

export const INBOUND_ACTIVITY_CONFIG: ActivityConfig<InboundActivityRow> = {
  fields: [
    { key: 'code', label: 'Code' },
    { key: 'locationCode', label: 'Location' },
    { key: 'customerProjectCode', label: 'Customer Project' },
    { key: 'poNum', label: 'Purchase Order' },
    { key: 'isPartialReceived', label: 'Partial Receiving' },
    { key: 'notes', label: 'Notes' },
    { key: 'status', label: 'Status', format: (row) => INBOUND_STATUS_CONFIG[row.status].label },
    { key: 'cancelReason', label: 'Cancel Reason' }
  ],
  children: [
    {
      key: 'items',
      label: 'Packages',
      noun: 'package',
      rows: (row) => row.items,
      matchKey: 'lineNum',
      rowLabel: (item) => `Line ${item.lineNum} · ${item.mpn}`,
      fields: [
        { key: 'owner', label: 'Owner' },
        { key: 'mpn', label: 'MFG P/N' },
        { key: 'partNumber', label: 'Part Number' },
        { key: 'commodityCode', label: 'Commodity' },
        { key: 'dateCode', label: 'DC' },
        { key: 'countryOfOrigin', label: 'COO' },
        { key: 'lotCode', label: 'Lot Code' },
        { key: 'packagingTypeCode', label: 'Packaging Type' },
        { key: 'spq', label: 'SPQ' },
        { key: 'cost', label: 'Cost', format: (item) => item.cost?.toString() ?? null },
        { key: 'totalStock', label: 'Received Qty', format: (item) => item.totalStock.toString() },
        { key: 'isMandatoryQc', label: 'Mandatory QC' },
        { key: 'notes', label: 'Notes' }
      ]
    }
  ]
}
