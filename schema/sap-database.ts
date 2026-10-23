import { z } from 'zod'

export const chooseSapDatabaseFormSchema = z.object({
  dbCode: z.string().trim().min(1, { message: 'Database is required' })
})

export type ChooseSapDatabaseForm = z.infer<typeof chooseSapDatabaseFormSchema>
