import { SapItemType, SapYesNo } from '@/types/sap'

//* labels follow the sap b1 client

export const ITEM_TYPE_OPTIONS: { value: SapItemType; label: string }[] = [
  { value: 'itItems', label: 'Items' },
  { value: 'itLabor', label: 'Labor' },
  { value: 'itTravel', label: 'Travel' },
  { value: 'itFixedAssets', label: 'Fixed Assets' }
]

//* sap only lets the items type be an inventory item
export const INVENTORY_ITEM_TYPES: SapItemType[] = ['itItems']

export function canBeInventoryItem(itemType?: SapItemType | null) {
  return !!itemType && INVENTORY_ITEM_TYPES.includes(itemType)
}

export const YES_NO_OPTIONS: { value: SapYesNo; label: string }[] = [
  { value: 'tYES', label: 'Yes' },
  { value: 'tNO', label: 'No' }
]

//* item object code for the series service
export const ITEM_OBJECT_CODE = '4'

//* sap's "- No Manufacturer -" row
export const NO_MANUFACTURER_CODE = -1

//* items take output tax groups
export const TAX_GROUP_CATEGORY = 'bovcOutputTax'
