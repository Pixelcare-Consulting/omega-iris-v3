import { z } from 'zod'

import { optionalNumber, optionalString } from './common'

//* sap caps an item code at 50 characters
export const ITEM_CODE_MAX_LENGTH = 50

//* a p/n can hold slashes and dots, so the usual code rule is skipped
//! 'add' is the create page url, an item with that p/n could never be opened
export const itemCodeSchema = z
  .string()
  .trim()
  .min(1, { message: 'MFG P/N is required' })
  .max(ITEM_CODE_MAX_LENGTH, { message: `MFG P/N must be at most ${ITEM_CODE_MAX_LENGTH} characters` })
  .refine((code) => code !== 'add', { message: "MFG P/N cannot be 'add'" })

//* the pickers hold string values, a blank one becomes null
export const itemMasterFormSchema = z.object({
  id: optionalString,
  ItemCode: itemCodeSchema,
  ItemName: optionalString,
  FirmCode: optionalNumber,
  ItmsGrpCod: optionalNumber,
  notes: optionalString,
  thumbnail: optionalString, //* file attachment id, saved by setItemMasterThumbnail
  isActive: z.boolean()
})

export const itemMasterThumbnailSchema = z.object({
  id: z.string().min(1),
  thumbnail: z.string().min(1).nullable()
})

//* the page loads the lookups once and sends them with every page
export const itemMasterSyncFromSapPageSchema = z.object({
  startedAt: z.iso.datetime(), //* the run's start, ties its activity rows to one batch
  since: z.string().nullable(),
  skip: z.number().int().min(0),
  metaData: z.object({
    itemGroups: z.array(z.object({ Number: z.number(), GroupName: z.string() })),
    manufacturers: z.array(z.object({ Code: z.number(), ManufacturerName: z.string() }))
  })
})

export const itemMasterSyncFinishSchema = z.object({
  startedAt: z.iso.datetime(),
  count: z.number().int().min(0)
})

export const itemMasterSyncFailSchema = z.object({ message: z.string().min(1) })

export const itemMasterSyncToSapSchema = z.object({ ids: z.array(z.string().min(1)).min(1).max(20) })

export type ItemMasterForm = z.infer<typeof itemMasterFormSchema>
export type ItemMasterThumbnail = z.infer<typeof itemMasterThumbnailSchema>
