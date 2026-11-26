import { z } from 'zod'

export const paramsSchema = z.object({
  code: z.number().min(1, { message: 'Please enter an code.' })
})

export type Params = z.infer<typeof paramsSchema>

//* for records keyed by a string code
export const codeParamsSchema = z.object({
  code: z.string().trim().min(1, { message: 'Please enter a code.' })
})

export type CodeParams = z.infer<typeof codeParamsSchema>

//* a user-typed record code, letters, numbers and dashes only since it ends up in the url
export const CODE_REGEX = /^[A-Z0-9-]+$/

export const codeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(1, { message: 'Code is required' })
  .regex(CODE_REGEX, { message: 'Code can only have letters, numbers and dashes' })

export const optionalNumber = z.coerce
  .number()
  .int()
  .nullish()
  .transform((v) => (v ? v : null))

//* pickers hand back strings, and 0 stays a real value (a sap line number), unlike optionalNumber
export const optionalNumeric = (isInt: boolean) =>
  z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? null : Number(value)),
    (isInt ? z.number().int() : z.number()).nullable()
  )

export const optionalString = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v : null))
