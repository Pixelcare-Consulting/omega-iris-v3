import 'server-only'

import { defineSequence, toYearMonthDayCode } from '@/lib/sequence'
import { formatPackagingUnitCode } from '@/lib/packaging-unit'

//* scope is the prefix, e.g. BB-SNAP-261019, so each project resets daily
export const PACKAGING_UNIT_SEQUENCE = defineSequence<{ prefixParts: string[] }>({
  key: 'PACKAGING_UNIT',
  scope: (ctx, date) => [...ctx.prefixParts, toYearMonthDayCode(date)].join('-'),
  format: (value, scope) => formatPackagingUnitCode(scope, value)
})
