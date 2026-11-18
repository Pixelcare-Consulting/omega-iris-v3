import { DEFAULT_PADDING_LENGTH } from '@/constants/common'
import type { LabelSize } from '@/constants/label'

type PalletProject = { isGeneralPurpose: boolean; projectCategoryCode?: string | null; customerProjectCode?: string | null }

//* category and project, none for general purpose
export function getPalletPrefixParts({ isGeneralPurpose, projectCategoryCode, customerProjectCode }: PalletProject) {
  return isGeneralPurpose ? [] : [projectCategoryCode ?? '', customerProjectCode ?? '']
}

//* padded inline, lib/sequence is server only
export function formatPalletCode(scope: string, value: number) {
  return `${scope}-P${String(value).padStart(DEFAULT_PADDING_LENGTH, '0')}`
}

export type PalletPreviewLine = PalletProject & { lineNumber: number; scope: string; quantity: number; codes: string[] }

export function getPalletLabelPdfHref(code: string, size: LabelSize, isDownload = false) {
  return `/api/pallets/${encodeURIComponent(code)}/label/pdf?size=${size}${isDownload ? '&download=1' : ''}`
}

export type PalletScopePreview = { scope: string; value: number }

//* same key for the same prefix parts, used to match a line to its preview
export const toPalletPrefixKey = (prefixParts: string[]) => JSON.stringify(prefixParts)

//* one counter per scope, so lines with the same prefix keep counting
export function buildPalletPreview(
  lines: (PalletProject & { quantity: number; lineNumber: number })[],
  previewByKey: Record<string, PalletScopePreview>
): PalletPreviewLine[] {
  const counters: Record<string, number> = {}

  return lines.map((line) => {
    const preview = previewByKey[toPalletPrefixKey(getPalletPrefixParts(line))]
    const scope = preview?.scope ?? ''
    const start = counters[scope] ?? preview?.value ?? 1
    const quantity = Number.isFinite(line.quantity) && line.quantity > 0 ? Math.floor(line.quantity) : 0

    counters[scope] = start + quantity

    return {
      lineNumber: line.lineNumber,
      scope,
      quantity,
      isGeneralPurpose: line.isGeneralPurpose,
      projectCategoryCode: line.projectCategoryCode,
      customerProjectCode: line.customerProjectCode,
      codes: Array.from({ length: quantity }, (_, index) => formatPalletCode(scope, start + index))
    }
  })
}
