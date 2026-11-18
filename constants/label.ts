import { inchToPt } from '@/lib/unit'

//TODO: move to settings
//* inch rolls only for now, largest first
export const LABEL_SIZE_KEYS = ['4x2in', '3x2in', '2x1in'] as const

export type LabelSize = (typeof LABEL_SIZE_KEYS)[number]

type LabelSizeConfig = { label: string; width: number; height: number; isCompact: boolean; isDefault: boolean }

//* points, landscape, qr and code only, compact sizes stack them, mark one isDefault
export const LABEL_SIZES: Record<LabelSize, LabelSizeConfig> = {
  '4x2in': { label: '4 × 2 in', width: inchToPt(4), height: inchToPt(2), isCompact: false, isDefault: true },
  '3x2in': { label: '3 × 2 in', width: inchToPt(3), height: inchToPt(2), isCompact: false, isDefault: false },
  '2x1in': { label: '2 × 1 in', width: inchToPt(2), height: inchToPt(1), isCompact: true, isDefault: false }
}

//* first one marked isDefault, the first size if none is
export const DEFAULT_LABEL_SIZE: LabelSize = LABEL_SIZE_KEYS.find((key) => LABEL_SIZES[key].isDefault) ?? LABEL_SIZE_KEYS[0]

//* the badge text rides on the option, so a search can match it
export const LABEL_SIZE_OPTIONS = LABEL_SIZE_KEYS.map((value) => ({
  label: LABEL_SIZES[value].label,
  value,
  defaultLabel: value === DEFAULT_LABEL_SIZE ? 'Default' : ''
}))

//* most labels in one bulk pdf, select all stops here too
export const LABEL_MAX_COUNT = 1000

//* minutes a bulk pdf tab can still reload, its blob url is freed after
export const LABEL_PDF_URL_TTL_MINUTES = 5
