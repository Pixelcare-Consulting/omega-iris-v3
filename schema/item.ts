import { z } from 'zod'

import { dataTableParamsSchema } from '@/schema/data-table'

//* field names match the service layer, so the body maps almost one to one

export const itemFormSchema = z.object({
  ItemCode: z.string().trim(), //* empty on create, sap assigns it
  Series: z.coerce.number().int().nullish(), //* only sent on create, sap numbers the item from it
  ItemName: z.string().trim().min(1, 'Description is required').max(200, 'Must be at most 200 characters'),
  ItemType: z.enum(['itItems', 'itLabor', 'itTravel', 'itFixedAssets'], { message: 'Item Type is required' }),
  ItemsGroupCode: z.coerce.number().int().positive('Item Group is required'),
  InventoryItem: z.boolean(),
  SalesItem: z.boolean(),
  PurchaseItem: z.boolean(),
  WTLiable: z.boolean(),
  Manufacturer: z.coerce.number().int(),
  SalesVATGroup: z.string().trim().max(8, 'Must be at most 8 characters').nullish(),
  isActive: z.boolean()
})

export const itemCodeSchema = z.object({ code: z.string().trim().min(1, 'Item No. is required') })

//* the lookups the list page already fetched, sent along so each table request skips them
export const itemTableLookupsSchema = z.object({
  itemGroups: z.array(z.object({ Number: z.number(), GroupName: z.string() })),
  manufacturers: z.array(z.object({ Code: z.number(), ManufacturerName: z.string() })),
  vatGroups: z.array(z.object({ Code: z.string(), Name: z.string(), Category: z.string(), Inactive: z.enum(['tYES', 'tNO']) }))
})

export const itemTableParamsSchema = dataTableParamsSchema.extend({ lookups: itemTableLookupsSchema })

export type ItemForm = z.infer<typeof itemFormSchema>
export type ItemTableLookups = z.infer<typeof itemTableLookupsSchema>
export type ItemTableParams = z.infer<typeof itemTableParamsSchema>
