import { z } from 'zod'

import { optionalString, codeSchema } from './common'

export const siteFormSchema = z.object({
  id: optionalString,
  code: codeSchema.max(3, { message: 'Code must be at most 3 characters' }),
  name: z.string().trim().min(1, { message: 'Name is required' }),
  description: optionalString,
  isEnableInbound: z.boolean(),
  isEnableOutbound: z.boolean(),
  isEnableMovement: z.boolean(),
  isEnableCycleCount: z.boolean(),
  isEnableQcTesting: z.boolean(),
  isEnableRma: z.boolean(),
  isActive: z.boolean()
})

export type SiteForm = z.infer<typeof siteFormSchema>
