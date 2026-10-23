import { BadgeVariants } from '@/components/ui/badge'

type BadgeVariant = NonNullable<BadgeVariants['variant']>

//* base tailwind color names shared by the `soft` and `solid` badge variants, this order drives the swatch grid
export const BADGE_COLOR_NAMES = [
  'slate',
  'neutral',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose'
] as const

//* `satisfies` keeps these in sync with `badgeVariants`, a name that isn't a real badge variant fails the build
//* black leads both families, it has no tailwind scale so it sits outside BADGE_COLOR_NAMES
export const SOFT_BADGE_COLORS = ['soft-black', ...BADGE_COLOR_NAMES.map((name) => `soft-${name}` as const)] satisfies BadgeVariant[]
export const SOLID_BADGE_COLORS = ['black', ...BADGE_COLOR_NAMES] satisfies BadgeVariant[]

export type SoftBadgeColor = (typeof SOFT_BADGE_COLORS)[number]
export type SolidBadgeColor = (typeof SOLID_BADGE_COLORS)[number]
export type BadgeColor = SoftBadgeColor | SolidBadgeColor

export const BADGE_COLOR_FAMILIES = [
  { key: 'soft', label: 'Soft', colors: SOFT_BADGE_COLORS as readonly BadgeColor[] },
  { key: 'solid', label: 'Solid', colors: SOLID_BADGE_COLORS as readonly BadgeColor[] }
] as const

export type BadgeColorFamily = (typeof BADGE_COLOR_FAMILIES)[number]['key']

export const DEFAULT_BADGE_COLOR_FAMILY: BadgeColorFamily = 'soft'

export const BADGE_COLORS: BadgeColor[] = [...SOFT_BADGE_COLORS, ...SOLID_BADGE_COLORS]
