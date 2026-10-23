import { z } from 'zod'

export const paramsSchema = z.object({
  code: z.number().min(1, { message: 'Please enter an code.' })
})

export type Params = z.infer<typeof paramsSchema>

export const optionalNumber = z.coerce
  .number()
  .int()
  .nullish()
  .transform((v) => (v ? v : null))

export const optionalString = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v : null))
