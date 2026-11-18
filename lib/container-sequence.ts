import 'server-only'

import { defineSequence, toYearMonthCode } from '@/lib/sequence'
import { formatContainerCode } from '@/lib/container'

//* scope is the prefix, e.g. BB-SNAP-26J or 26J, so each resets monthly, apart from pallet numbers
export const CONTAINER_SEQUENCE = defineSequence<{ prefixParts: string[] }>({
  key: 'CONTAINER',
  scope: (ctx, date) => [...ctx.prefixParts, toYearMonthCode(date)].join('-'),
  format: (value, scope) => formatContainerCode(scope, value)
})
