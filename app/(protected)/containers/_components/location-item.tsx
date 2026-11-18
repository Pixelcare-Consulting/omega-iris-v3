import ComboboxItemContent from '@/components/forms/combobox-item-content'
import { Badge } from '@/components/ui/badge'
import { FormOptions } from '@/types/common'

//* the badge text rides on the option, so a search can match it
export function toLocationOptions<T extends FormOptions>(options: T[]) {
  return options.map((option) => ({ ...option, palletLabel: option.isPalletAllowed ? 'Pallet Allowed' : 'Pallet Not Allowed' }))
}

//* search keys for every text the row shows
export const LOCATION_SEARCH_KEYS = ['value', 'palletLabel']

//* name, the code below it, and whether it takes pallets
export function renderLocationItem(item: FormOptions) {
  return (
    <ComboboxItemContent
      label={item.label}
      description={item.value}
      trailing={<Badge variant={item.isPalletAllowed ? 'soft-green' : 'soft-red'}>{item.palletLabel}</Badge>}
    />
  )
}
