import { z } from 'zod'

import { optionalString } from './common'

export const itemMasterFormSchema = z.object({
  id: optionalString,
  //* a p/n can hold slashes and dots, so the usual code rule is skipped
  //! 'add' is the create page url, an item with that p/n could never be opened
  code: z
    .string()
    .trim()
    .min(1, { message: 'MFG P/N is required' })
    .max(100, { message: 'MFG P/N must be at most 100 characters' })
    .refine((code) => code !== 'add', { message: "MFG P/N cannot be 'add'" }),
  description: optionalString,
  manufacturerCode: optionalString,
  commodityCode: optionalString,
  notes: optionalString,
  thumbnail: optionalString, //* file attachment id, saved by setItemMasterThumbnail
  isActive: z.boolean()
})

export const itemMasterThumbnailSchema = z.object({
  id: z.string().min(1),
  thumbnail: z.string().min(1).nullable()
})

export type ItemMasterForm = z.infer<typeof itemMasterFormSchema>
export type ItemMasterThumbnail = z.infer<typeof itemMasterThumbnailSchema>
