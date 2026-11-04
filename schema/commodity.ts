import { z } from 'zod'

import { optionalString, codeSchema } from './common'

export const commodityFormSchema = z.object({
  id: optionalString,
  code: codeSchema,
  name: z.string().trim().min(1, { message: 'Name is required' }),
  isActive: z.boolean()
})

export type CommodityForm = z.infer<typeof commodityFormSchema>
