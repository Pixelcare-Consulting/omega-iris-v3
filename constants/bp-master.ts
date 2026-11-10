import { PERMISSIONS_CODES } from '@/constants/permission'

export const BP_MASTER_TYPES = { CUSTOMER: 'C', VENDOR: 'S' } as const

export type BpMasterType = (typeof BP_MASTER_TYPES)[keyof typeof BP_MASTER_TYPES]

export const BP_ADDRESS_TYPES = { BILLING: 'B', SHIPPING: 'S' } as const

export type BpAddressType = (typeof BP_ADDRESS_TYPES)[keyof typeof BP_ADDRESS_TYPES]

export const BP_ADDRESS_TYPE_LABELS: Record<BpAddressType, string> = { B: 'Billing', S: 'Shipping' }

type BpMasterConfig = { label: string; pluralLabel: string; route: string; permission: string; description: string }

//* labels, routes and permission per type, both modules share one set of components
export const BP_MASTER_CONFIG: Record<BpMasterType, BpMasterConfig> = {
  C: {
    label: 'Customer',
    pluralLabel: 'Customers',
    route: '/customers',
    permission: PERMISSIONS_CODES.CUSTOMERS,
    description: 'Manage your customers, their addresses and contact persons'
  },
  S: {
    label: 'Vendor',
    pluralLabel: 'Vendors',
    route: '/vendors',
    permission: PERMISSIONS_CODES.VENDORS,
    description: 'Manage your vendors, their addresses and contact persons'
  }
}
