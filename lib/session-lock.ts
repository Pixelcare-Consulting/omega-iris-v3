import 'server-only'

import type { Prisma } from '@/prisma/generated/client'

//* thrown inside a transaction to roll it back, the action returns its status
export class SessionConflictError extends Error {
  constructor(
    message: string,
    public status = 409
  ) {
    super(message)
  }
}

//* locks the session row until the transaction ends, then reads it fresh
//! every write that checks a session's status takes this lock first, so a cancel or complete can't slip in between
export async function lockSession(tx: Prisma.TransactionClient, dbCode: string, code: string) {
  await tx.$queryRaw`SELECT 1 FROM "Session" WHERE "dbCode" = ${dbCode} AND "code" = ${code} FOR UPDATE`

  const session = await tx.session.findFirst({ where: { dbCode, code, deletedAt: null } })

  if (!session) throw new SessionConflictError('Session not found!')

  return session
}

//* the 409 message when an inbound can't change
export function toClosedSessionMessage(status: string) {
  return status === 'PAUSED' ? 'Resume the session to keep editing!' : 'The session is closed!'
}
