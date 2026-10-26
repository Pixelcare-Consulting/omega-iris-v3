import { SapResult, SapYesNo } from '@/types/sap'
import { formatDate } from '@/lib/utils'

//* value helpers shared by every sap module, the form uses booleans and blanks, sap uses tYES/tNO and null

//* blank text becomes null so sap clears the field
export function toNullable(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function toYesNo(value: boolean): SapYesNo {
  return value ? 'tYES' : 'tNO'
}

//* only an explicit tNO is false, a missing flag counts as yes like sap's own default
export function fromYesNo(value?: SapYesNo | null) {
  return value !== 'tNO'
}

//* on create a null means "use sap's default", so it is left out
export function withoutNulls<T extends object>(body: T) {
  return Object.fromEntries(Object.entries(body).filter(([, value]) => value !== null && value !== undefined)) as T
}

//* the mutation envelope for a refused sap call, sap's own message goes back as is
//! data?: never keeps `result.data` readable on the caller's union, an inline literal gets that for free
export function toSapFailure(
  result: Extract<SapResult<unknown>, { ok: false }>,
  action: string
): { status: number; error: boolean; message: string; action: string; data?: never } {
  return { status: result.status || 500, error: true, message: result.message, action }
}

//* sap splits a timestamp into a date and a 'HH:mm:ss' time, both in the company's local time
//* the time can be missing, then only the date is kept
export function toSapDateTime(date?: string | null, time?: string | null) {
  if (!date) return null

  const day = date.slice(0, 10)
  return time ? `${day}T${time}` : day
}

//* the date-only format when sap has no time, so it never shows a made-up midnight
export function formatSapDateTime(
  date: string | null | undefined,
  time: string | null | undefined,
  dateTimeFormat: string,
  dateFormat: string
) {
  return formatDate(toSapDateTime(date, time), time ? dateTimeFormat : dateFormat)
}

//* a [code] route segment back to the sap code, a malformed escape is taken as typed
//* sap codes are strings and can hold '/', '#' or spaces, so links encode them
export function decodeCodeParam(segment: string) {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}
