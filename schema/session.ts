import { z } from 'zod'

import { SESSION_TYPES } from '@/constants/session'

export const startSessionFormSchema = z.object({
  siteCode: z.string().min(1, 'Site is required'),
  type: z.enum(SESSION_TYPES, { message: 'Pick a process' })
})

export type StartSessionForm = z.infer<typeof startSessionFormSchema>

export const sessionCodeSchema = z.object({
  sessionCode: z.string().min(1)
})

export type SessionCode = z.infer<typeof sessionCodeSchema>

export const cancelSessionFormSchema = z.object({
  sessionCode: z.string().min(1),
  reason: z.string().trim().min(1, 'Reason is required')
})

export type CancelSessionForm = z.infer<typeof cancelSessionFormSchema>
