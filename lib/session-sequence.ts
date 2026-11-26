import 'server-only'

import { format } from 'date-fns'

import { defineSequence, padSequence } from '@/lib/sequence'

//* S-2026-000125, each database counts on its own and every year starts over
export const SESSION_SEQUENCE = defineSequence<{ dbCode: string }>({
  key: 'SESSION',
  scope: (ctx, date) => `${ctx.dbCode}:${format(date, 'yyyy')}`,
  format: (value, scope) => `S-${scope.split(':')[1]}-${padSequence(value, 6)}`
})

//* INB-2026-000011, same scope as the session
export const INBOUND_SEQUENCE = defineSequence<{ dbCode: string }>({
  key: 'INBOUND',
  scope: (ctx, date) => `${ctx.dbCode}:${format(date, 'yyyy')}`,
  format: (value, scope) => `INB-${scope.split(':')[1]}-${padSequence(value, 6)}`
})
