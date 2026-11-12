import type { SapSyncStatus } from '@/prisma/generated/enums'

//* every sap sync key, SapSyncState rows are keyed by these
export const SAP_SYNC_KEYS = {
  ITEM_MASTER_FROM_SAP: 'item-master-from-sap',
  ITEM_MASTER_TO_SAP: 'item-master-to-sap'
} as const

export type SapSyncKey = (typeof SAP_SYNC_KEYS)[keyof typeof SAP_SYNC_KEYS]

//* items per sync to sap call
export const SAP_SYNC_TO_CHUNK_SIZE = 20

//* sap items per sync from sap page
export const SAP_SYNC_FROM_PAGE_SIZE = 1000

export const SAP_SYNC_STATUS_OPTIONS: { value: SapSyncStatus; label: string }[] = [
  { value: 'PENDING', label: 'Not synced' },
  { value: 'SYNCED', label: 'Synced' },
  { value: 'FAILED', label: 'Failed' }
]
