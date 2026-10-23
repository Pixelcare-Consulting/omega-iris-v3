import { z } from 'zod'

export const signinFormSchema = z.object({
  callbackUrl: z.string().trim().nullable(),
  email: z.email('Email is invalid').trim().min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required')
})

export type SignInForm = z.infer<typeof signinFormSchema>
