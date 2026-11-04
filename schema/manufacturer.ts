import { z } from 'zod'

import { optionalString, codeSchema } from './common'

export const manufacturerFormSchema = z.object({
  id: optionalString,
  code: codeSchema,
  name: z.string().trim().min(1, { message: 'Name is required' }),
  isActive: z.boolean()
})

export type ManufacturerForm = z.infer<typeof manufacturerFormSchema>
