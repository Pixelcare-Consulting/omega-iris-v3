import 'server-only'

import { format, subDays } from 'date-fns'

//* days before the last sync to re-read, sap dates are day only and its clock can sit a day behind ours
export const SYNC_LOOKBACK_DAYS = Number(process.env.SYNC_LOOKBACK_DAYS) || 2

//* null on a first sync, which reads everything
export function toSyncSinceDate(lastSyncAt: Date | null) {
  if (!lastSyncAt) return null
  return format(subDays(lastSyncAt, SYNC_LOOKBACK_DAYS), 'yyyy-MM-dd')
}

//* a $filter part for rows created or changed on or after the date
export function toChangedSinceFilter(since: string | null) {
  if (!since) return null
  return `(UpdateDate ge '${since}' or CreateDate ge '${since}')`
}
