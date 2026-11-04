import { z } from 'zod'

import { optionalString, codeSchema } from './common'

export const customerProjectFormSchema = z.object({
  id: optionalString,
  code: codeSchema.min(4, { message: 'Code must be at least 4 characters' }),
  name: z.string().trim().min(1, { message: 'Name is required' }),
  description: optionalString,
  categoryCode: optionalString,
  isActive: z.boolean()
})

export type CustomerProjectForm = z.infer<typeof customerProjectFormSchema>
