import clsx, { ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import * as clipboard from 'clipboard-polyfill'
import { toast } from 'sonner'
import { format, isValid, parseISO } from 'date-fns'

//* get initials from a string
export const getInitials = (str: string, limit: number = 2) => {
  if (!str) return ''

  return str.split(/\s/).reduce((response, word, index) => {
    if (index < limit) response += word.slice(0, 1)
    return response
  }, '')
}

//* title case a string
export function titleCase(str: string) {
  return str
    .toLowerCase()
    .split(' ')
    .map(function (word) {
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

//* tailwind merge with clsx
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

//* delays a promise
export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

//* copy text to clipboard
export const copyText = (text: string) => (_evt: any) => {
  clipboard.writeText(String(text)).then(
    () => toast.success('Text copied!', { duration: 700 }),
    () => toast.error('Failed to copy!', { duration: 700 })
  )
}

//* safely parses a string to float
export function safeParseFloat(value: any) {
  const num = parseFloat(value)
  return isNaN(num) || !isFinite(num) ? 0 : num
}

//* safely parses a string to int
export function safeParseInt(value: any, radix?: number) {
  const num = parseInt(value, radix)
  return isNaN(num) || !isFinite(num) ? 0 : num
}

//* splits an array into smaller chunks
export function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

export function formatDate(value: string | Date | null | undefined, formatStr: string = 'Pp') {
  if (!value) return '—'

  const date = typeof value === 'string' ? parseISO(value) : value
  if (!isValid(date)) return '—'

  const formatted = format(date, formatStr)
  return formatted
}

//* view page label for a related record, flags deleted or inactive rows
export function toCodeName(row: { code: string; name: string; isActive?: boolean; deletedAt?: Date | null } | null | undefined) {
  if (!row) return null
  const suffix = row.deletedAt ? ' (Deleted)' : row.isActive === false ? ' (Inactive)' : ''
  return `${row.code} (${row.name})${suffix}`
}
