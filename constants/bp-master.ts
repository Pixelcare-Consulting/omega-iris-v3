import { PERMISSIONS_CODES } from '@/constants/permission'
import { SAP_SYNC_KEYS, SapSyncKey } from '@/constants/sap-sync'
import { SapAddressType, SapCardType, SapGroupType } from '@/types/sap'

export const BP_MASTER_TYPES = { CUSTOMER: 'C', VENDOR: 'S' } as const

export type BpMasterType = (typeof BP_MASTER_TYPES)[keyof typeof BP_MASTER_TYPES]

export const BP_ADDRESS_TYPES = { BILLING: 'B', SHIPPING: 'S' } as const

export type BpAddressType = (typeof BP_ADDRESS_TYPES)[keyof typeof BP_ADDRESS_TYPES]

export const BP_ADDRESS_TYPE_LABELS: Record<BpAddressType, string> = { B: 'Billing', S: 'Shipping' }

export const BP_SAP_CARD_TYPES: Record<BpMasterType, SapCardType> = { C: 'cCustomer', S: 'cSupplier' }

export const BP_SAP_GROUP_TYPES: Record<BpMasterType, SapGroupType> = { C: 'bbpgt_CustomerGroup', S: 'bbpgt_VendorGroup' }

export const BP_SAP_ADDRESS_TYPES: Record<BpAddressType, SapAddressType> = { B: 'bo_BillTo', S: 'bo_ShipTo' }

export const BP_SYNC_KEYS: Record<BpMasterType, { from: SapSyncKey; to: SapSyncKey }> = {
  C: { from: SAP_SYNC_KEYS.CUSTOMER_FROM_SAP, to: SAP_SYNC_KEYS.CUSTOMER_TO_SAP },
  S: { from: SAP_SYNC_KEYS.VENDOR_FROM_SAP, to: SAP_SYNC_KEYS.VENDOR_TO_SAP }
}

type BpMasterConfig = {
  label: string
  pluralLabel: string
  route: string
  permission: string
  description: string
  canCreate: boolean //* vendors only come from sap for now
  codePrefix: string
}

//* labels, routes and permission per type, both modules share one set of components
export const BP_MASTER_CONFIG: Record<BpMasterType, BpMasterConfig> = {
  C: {
    label: 'Customer',
    pluralLabel: 'Customers',
    route: '/customers',
    permission: PERMISSIONS_CODES.CUSTOMERS,
    description: 'Manage your customers, their addresses and contact persons',
    canCreate: true,
    codePrefix: 'C'
  },
  S: {
    label: 'Vendor',
    pluralLabel: 'Vendors',
    route: '/vendors',
    permission: PERMISSIONS_CODES.VENDORS,
    description: 'Manage your vendors, their addresses and contact persons',
    canCreate: false,
    codePrefix: 'V'
  }
}
