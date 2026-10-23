import { authClient } from '@/lib/auth-client'
import type { auth } from '@/lib/auth'

//! named AuthSession, plain Session is the legislative session model
export type AuthSession = typeof authClient.$Infer.Session

//* comes from the server session, not the client one, whose shape differs slightly (it adds `createdAt` and `updatedAt`)
export type AuthSessionUser = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>['user']
