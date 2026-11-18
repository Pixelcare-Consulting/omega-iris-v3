import 'server-only'

import { defineSequence, toYearMonthCode } from '@/lib/sequence'
import { formatPalletCode } from '@/lib/pallet'

//* scope is the prefix, e.g. BB-SNAP-26J or 26J, so each resets monthly
export const PALLET_SEQUENCE = defineSequence<{ prefixParts: string[] }>({
  key: 'PALLET',
  scope: (ctx, date) => [...ctx.prefixParts, toYearMonthCode(date)].join('-'),
  format: (value, scope) => formatPalletCode(scope, value)
})
