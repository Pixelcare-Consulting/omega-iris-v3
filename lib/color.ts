import { BADGE_COLORS, BadgeColor, BadgeColorFamily, SOFT_BADGE_COLORS, SoftBadgeColor } from '@/constants/color'
import { badgeVariants, BadgeVariants } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { EMPTY_FILTER_LABEL, EMPTY_FILTER_VALUE } from '@/constants/data-table'
import { FilterOption } from '@/types/data-table'

export function isBadgeColor(value?: string | null): value is BadgeColor {
  return !!value && BADGE_COLORS.includes(value as BadgeColor)
}

//* which tab a color belongs to, `soft-blue` → `soft`, `blue` / `black` → `solid`, unknown → undefined
export function getBadgeColorFamily(value?: string | null): BadgeColorFamily | undefined {
  if (!isBadgeColor(value)) return undefined
  return SOFT_BADGE_COLORS.includes(value as SoftBadgeColor) ? 'soft' : 'solid'
}

//* the badge palette reused on an avatar fallback, so a user's avatar matches their role badge
//! badgeVariants also carries the badge's layout base (h-5, w-fit, px-2, rounded-4xl, text-xs), reset here to the avatar's own
//* returns undefined for an unset or unknown color, so the caller's fallback classes stand
export function getAvatarColorClassName(value?: string | null) {
  if (!isBadgeColor(value)) return undefined
  return cn(badgeVariants({ variant: value }), 'flex size-full rounded-full px-0 py-0 text-sm')
}

//* `soft-blue` → `Soft Blue`
export function formatBadgeColorLabel(value?: string | null): string {
  if (!value) return ''

  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

//* a stored color as a badge variant, unset, blank or unknown colors fall back
export function toBadgeVariant(value?: string | null, fallback: BadgeVariants['variant'] = 'secondary'): BadgeVariants['variant'] {
  return isBadgeColor(value) ? value : fallback
}

//* color filter options for a data table, the palette is a constant, so no fetch is needed
export const BADGE_COLOR_FILTER_OPTIONS: FilterOption[] = [
  ...BADGE_COLORS.map((color) => ({ label: formatBadgeColorLabel(color), value: color })),
  { label: EMPTY_FILTER_LABEL, value: EMPTY_FILTER_VALUE }
]
