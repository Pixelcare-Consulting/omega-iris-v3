import { SapAddressType, SapCardType, SapCompanyPrivate, SapCurrency, SapGroupType } from '@/types/sap'

//* labels follow the sap b1 client

export const CARD_TYPE_OPTIONS: { value: SapCardType; label: string }[] = [
  { value: 'cCustomer', label: 'Customer' },
  { value: 'cSupplier', label: 'Vendor' },
  { value: 'cLid', label: 'Lead' }
]

export const COMPANY_PRIVATE_OPTIONS: { value: SapCompanyPrivate; label: string }[] = [
  { value: 'cCompany', label: 'Company' },
  { value: 'cPrivate', label: 'Private' },
  { value: 'cGovernment', label: 'Government' },
  { value: 'cEmployee', label: 'Employee' }
]

export const ADDRESS_TYPE_OPTIONS: { value: SapAddressType; label: string }[] = [
  { value: 'bo_BillTo', label: 'Bill To' },
  { value: 'bo_ShipTo', label: 'Ship To' }
]

//* active on the list maps to the Valid flag
export const ACTIVE_OPTIONS = [
  { value: 'tYES', label: 'Yes' },
  { value: 'tNO', label: 'No' }
]

export const ALL_CURRENCIES: SapCurrency = { Code: '##', Name: 'All Currencies' }

//* sap's "-No Sales Employee-" row
export const NO_SALES_EMPLOYEE_CODE = -1

//* business partner object code for the series service
export const BP_OBJECT_CODE = '2'

export const BP_SUB_TYPES: Record<SapCardType, 'C' | 'S' | 'L'> = { cCustomer: 'C', cSupplier: 'S', cLid: 'L' }

//* leads share the customer groups
export function toGroupType(cardType: SapCardType): SapGroupType {
  return cardType === 'cSupplier' ? 'bbpgt_VendorGroup' : 'bbpgt_CustomerGroup'
}

//* '##' reads as All Currencies everywhere it is shown
export function toCurrencyLabel(code?: string | null) {
  return code === ALL_CURRENCIES.Code ? ALL_CURRENCIES.Name : (code ?? null)
}

export function toOptionLabel<T extends string>(options: { value: T; label: string }[], value?: T | string | null) {
  return options.find((option) => option.value === value)?.label ?? value ?? null
}
