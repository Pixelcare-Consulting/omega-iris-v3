import { z } from 'zod'

import { optionalString, codeSchema } from './common'

export const processZoneFormSchema = z.object({
  id: optionalString,
  code: codeSchema.min(2, { message: 'Code must be at least 2 characters' }),
  name: z.string().trim().min(1, { message: 'Name is required' }),
  description: optionalString,
  isPalletEligible: z.boolean(),
  isActive: z.boolean()
})

export type ProcessZoneForm = z.infer<typeof processZoneFormSchema>
