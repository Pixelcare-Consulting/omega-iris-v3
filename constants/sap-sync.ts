import type { SapSyncStatus } from '@/prisma/generated/enums'

//* every sap sync key, SapSyncState rows are keyed by these
export const SAP_SYNC_KEYS = {
  ITEM_MASTER_FROM_SAP: 'item-master-from-sap',
  ITEM_MASTER_TO_SAP: 'item-master-to-sap',
  CUSTOMER_FROM_SAP: 'customer-from-sap',
  CUSTOMER_TO_SAP: 'customer-to-sap',
  VENDOR_FROM_SAP: 'vendor-from-sap',
  VENDOR_TO_SAP: 'vendor-to-sap'
} as const

export type SapSyncKey = (typeof SAP_SYNC_KEYS)[keyof typeof SAP_SYNC_KEYS]

//* items per sync to sap call
export const SAP_SYNC_TO_CHUNK_SIZE = 20

//* sap items per sync from sap page
export const SAP_SYNC_FROM_PAGE_SIZE = 1000

//* business partners carry their addresses and contacts, so pages are smaller
export const SAP_SYNC_BP_PAGE_SIZE = 200

export const SAP_SYNC_STATUS_OPTIONS: { value: SapSyncStatus; label: string }[] = [
  { value: 'PENDING', label: 'Not synced' },
  { value: 'SYNCED', label: 'Synced' },
  { value: 'FAILED', label: 'Failed' }
]
