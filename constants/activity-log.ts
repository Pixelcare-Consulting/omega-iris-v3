import type { ActivitySource } from '@/prisma/generated/enums'
import type { ActivityActor, ActivityChildOp, ActivityTone } from '@/types/activity-log'
import { PERMISSIONS_CODES } from '@/constants/permission'

type ActivityModuleConfig = { label: string; permission?: string; parent?: readonly string[] }

//* key is the module, not the prisma model, customers and vendors share BusinessPartner
//* parent is the data owner, not the sidebar group
export const ACTIVITY_MODULES = {
  USERS: { label: 'User', permission: PERMISSIONS_CODES.USERS },
  ROLES: { label: 'Role', permission: PERMISSIONS_CODES.ROLES },
  CUSTOMERS: { label: 'Customer', permission: PERMISSIONS_CODES.CUSTOMERS },
  VENDORS: { label: 'Vendor', permission: PERMISSIONS_CODES.VENDORS },
  BUSINESS_PARTNERS: { label: 'Business Partner', permission: PERMISSIONS_CODES.BUSINESS_PARTNERS },
  BP_ADDRESSES: { label: 'Address', parent: ['CUSTOMERS', 'VENDORS'] },
  BP_CONTACTS: { label: 'Contact', parent: ['CUSTOMERS', 'VENDORS'] },
  ITEM_MASTERS: { label: 'Item', permission: PERMISSIONS_CODES.ITEM_MASTERS },
  SITES: { label: 'Site', permission: PERMISSIONS_CODES.SITES },
  PROCESS_ZONES: { label: 'Process Zone', permission: PERMISSIONS_CODES.PROCESS_ZONES },
  LOCATIONS: { label: 'Location', permission: PERMISSIONS_CODES.LOCATIONS },
  PALLETS: { label: 'Pallet', permission: PERMISSIONS_CODES.PALLETS },
  CONTAINERS: { label: 'Container', permission: PERMISSIONS_CODES.CONTAINERS },
  PROJECT_CATEGORIES: { label: 'Project Category', permission: PERMISSIONS_CODES.PROJECT_CATEGORIES },
  CUSTOMER_PROJECTS: { label: 'Customer Project', permission: PERMISSIONS_CODES.CUSTOMER_PROJECTS },
  AUTH: { label: 'Sign-in' }
} as const satisfies Record<string, ActivityModuleConfig>

export type ActivityModule = keyof typeof ACTIVITY_MODULES

//* four tones by meaning, a new action picks one, never a fifth
export const ACTIVITY_ACTIONS = {
  CREATE: { label: 'Created', tone: 'green' },
  UPDATE: { label: 'Updated', tone: 'blue' },
  DELETE: { label: 'Deleted', tone: 'red' },
  RESTORE: { label: 'Restored', tone: 'green' },
  STATUS: { label: 'Status changed', tone: 'blue' },
  SYNC_TO_SAP: { label: 'Pushed to SAP', tone: 'gray' },
  SYNC_FROM_SAP: { label: 'Pulled from SAP', tone: 'gray' },
  IMPORT: { label: 'Imported', tone: 'green' },
  BULK_CREATE: { label: 'Generated', tone: 'green' },
  SIGN_IN: { label: 'Signed in', tone: 'gray' },
  SIGN_IN_FAILED: { label: 'Sign-in failed', tone: 'red' },
  LOCKED_OUT: { label: 'Locked out', tone: 'red' }
} as const satisfies Record<string, { label: string; tone: ActivityTone }>

export type ActivityAction = keyof typeof ACTIVITY_ACTIONS

export const ACTIVITY_OP_TONES: Record<ActivityChildOp, ActivityTone> = { added: 'green', changed: 'blue', removed: 'red' }

export const ACTIVITY_OP_LABELS: Record<ActivityChildOp, string> = { added: 'Added', changed: 'Changed', removed: 'Removed' }

export const ACTIVITY_TONE_LABELS: Record<ActivityTone, string> = {
  green: 'Added or brought back',
  blue: 'Changed',
  red: 'Removed or failed',
  gray: 'No data changed'
}

export const ACTIVITY_SOURCE_LABELS: Record<ActivitySource, string> = { WEB: 'Web', MOBILE: 'Mobile', SYSTEM: 'System generated' }

export const ACTIVITY_TIMELINE_PAGE_SIZE = 20

export const AUDIT_LOG_DEFAULT_DAYS = 30

export const SYSTEM_ACTOR: ActivityActor = { userCode: null, userName: 'System', source: 'SYSTEM' }

//* fields that make an update a status change
export const ACTIVITY_STATUS_KEYS = ['isActive', 'status']
