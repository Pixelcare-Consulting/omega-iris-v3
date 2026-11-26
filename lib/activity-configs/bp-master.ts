import type { ActivityConfig } from '@/types/activity-log'
import type { Prisma } from '@/prisma/generated/client'
import { COMPANY_PRIVATE_OPTIONS, toOptionLabel } from '@/constants/business-partner'

export type BpMasterActivityRow = Prisma.BusinessPartnerGetPayload<{ include: { addresses: true; contacts: true } }>

const toAddressType = (type?: string | null) => (type === 'B' ? 'Bill To' : 'Ship To')

//* lookups show the sap name the save already stored
export const BP_MASTER_ACTIVITY_CONFIG: ActivityConfig<BpMasterActivityRow> = {
  fields: [
    { key: 'CardCode', label: 'Code' },
    { key: 'CardName', label: 'Name' },
    { key: 'GroupCode', label: 'Group', format: (row) => row.GroupName ?? row.GroupCode },
    { key: 'CurrCode', label: 'Currency', format: (row) => row.CurrName ?? row.CurrCode },
    { key: 'GroupNum', label: 'Payment Terms', format: (row) => row.PymntGroup ?? row.GroupNum },
    { key: 'AcctType', label: 'Account Type' },
    { key: 'CmpPrivate', label: 'Type of Business', format: (row) => toOptionLabel(COMPANY_PRIVATE_OPTIONS, row.CmpPrivate) },
    { key: 'CntctPrsn', label: 'Contact Person' },
    { key: 'BillToDef', label: 'Default Bill-To' },
    { key: 'ShipToDef', label: 'Default Ship-To' },
    { key: 'isActive', label: 'Active' }
  ],
  children: [
    {
      key: 'addresses',
      label: 'Addresses',
      noun: 'address',
      rows: (row) => row.addresses ?? [],
      matchKey: 'id',
      rowLabel: (address) => `${address.AddressName} (${toAddressType(address.AddrType)})`,
      fields: [
        { key: 'AddressName', label: 'Name' },
        { key: 'AddrType', label: 'Type', format: (address) => toAddressType(address.AddrType) },
        { key: 'Street', label: 'Street / PO Box' },
        { key: 'Address2', label: 'Address 2' },
        { key: 'Address3', label: 'Address 3' },
        { key: 'StreetNo', label: 'Street No.' },
        { key: 'BuildingFloorRoom', label: 'Building/Floor/Room' },
        { key: 'Block', label: 'Block' },
        { key: 'City', label: 'City' },
        { key: 'ZipCode', label: 'Zip Code' },
        { key: 'County', label: 'County' },
        { key: 'CountryCode', label: 'Country', format: (address) => address.CountryName ?? address.CountryCode },
        { key: 'StateCode', label: 'State/Province', format: (address) => address.StateName ?? address.StateCode }
      ]
    },
    {
      key: 'contacts',
      label: 'Contacts',
      noun: 'contact',
      rows: (row) => row.contacts ?? [],
      matchKey: 'id',
      rowLabel: (contact) => contact.ContactName,
      fields: [
        { key: 'ContactName', label: 'Contact ID' },
        { key: 'FirstName', label: 'First Name' },
        { key: 'LastName', label: 'Last Name' },
        { key: 'Email', label: 'Email' },
        { key: 'Title', label: 'Title' },
        { key: 'Position', label: 'Position' },
        { key: 'Phone1', label: 'Tel 1' },
        { key: 'Phone2', label: 'Tel 2' },
        { key: 'MobilePhone', label: 'Mobile Phone' }
      ]
    }
  ]
}
