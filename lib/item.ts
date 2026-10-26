import { ItemForm } from '@/schema/item'
import { SapItem, SapItemBody } from '@/types/sap'
import { NO_MANUFACTURER_CODE, canBeInventoryItem } from '@/constants/item'
import { fromYesNo, toNullable, toYesNo } from '@/lib/sap/utils'

//* sap keeps active as two flags, an item is active when valid and not frozen
export function isItemActive(item: Pick<SapItem, 'Valid' | 'Frozen'>) {
  return fromYesNo(item.Valid) && item.Frozen !== 'tYES'
}

//* form values to the service layer body
export function toItemBody(form: ItemForm): SapItemBody {
  return {
    ItemName: form.ItemName,
    ItemType: form.ItemType,
    ItemsGroupCode: form.ItemsGroupCode,
    InventoryItem: toYesNo(form.InventoryItem && canBeInventoryItem(form.ItemType)),
    SalesItem: toYesNo(form.SalesItem),
    PurchaseItem: toYesNo(form.PurchaseItem),
    WTLiable: toYesNo(form.WTLiable),
    Manufacturer: form.Manufacturer,
    SalesVATGroup: toNullable(form.SalesVATGroup),
    Valid: toYesNo(form.isActive),
    Frozen: toYesNo(!form.isActive)
  }
}

//* a service layer record to form values, null text becomes '' for the inputs
export function toItemFormValues(item: SapItem): ItemForm {
  return {
    ItemCode: item.ItemCode,
    Series: item.Series ?? null,
    ItemName: item.ItemName,
    ItemType: item.ItemType,
    ItemsGroupCode: item.ItemsGroupCode,
    InventoryItem: fromYesNo(item.InventoryItem),
    SalesItem: fromYesNo(item.SalesItem),
    PurchaseItem: fromYesNo(item.PurchaseItem),
    WTLiable: fromYesNo(item.WTLiable),
    Manufacturer: item.Manufacturer ?? NO_MANUFACTURER_CODE,
    SalesVATGroup: item.SalesVATGroup ?? '',
    isActive: isItemActive(item)
  }
}
