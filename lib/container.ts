import { DEFAULT_PADDING_LENGTH } from '@/constants/common'
import type { LabelSize } from '@/constants/label'
import type { ContainerType } from '@/prisma/generated/enums'

type ContainerProject = { isGeneralPurpose: boolean; projectCategoryCode?: string | null; customerProjectCode?: string | null }

//* category and project, none for general purpose
export function getContainerPrefixParts({ isGeneralPurpose, projectCategoryCode, customerProjectCode }: ContainerProject) {
  return isGeneralPurpose ? [] : [projectCategoryCode ?? '', customerProjectCode ?? '']
}

//* padded inline, lib/sequence is server only
export function formatContainerCode(scope: string, value: number) {
  return `${scope}-C${String(value).padStart(DEFAULT_PADDING_LENGTH, '0')}`
}

export function getContainerLabelPdfHref(code: string, size: LabelSize, isDownload = false) {
  return `/api/containers/${encodeURIComponent(code)}/label/pdf?size=${size}${isDownload ? '&download=1' : ''}`
}

export type ContainerScopePreview = { scope: string; value: number }

//* same key for the same prefix parts, used to match a line to its preview
export const toContainerPrefixKey = (prefixParts: string[]) => JSON.stringify(prefixParts)

type ContainerPreviewInput = ContainerProject & {
  quantity: number
  lineNumber: number
  type?: ContainerType | null
  palletCode?: string | null
}

export type ContainerPreviewLine = ContainerPreviewInput & { scope: string; codes: string[] }

//* one counter per scope, so lines with the same prefix keep counting
export function buildContainerPreview(
  lines: ContainerPreviewInput[],
  previewByKey: Record<string, ContainerScopePreview>
): ContainerPreviewLine[] {
  const counters: Record<string, number> = {}

  return lines.map((line) => {
    const preview = previewByKey[toContainerPrefixKey(getContainerPrefixParts(line))]
    const scope = preview?.scope ?? ''
    const start = counters[scope] ?? preview?.value ?? 1
    const quantity = Number.isFinite(line.quantity) && line.quantity > 0 ? Math.floor(line.quantity) : 0

    counters[scope] = start + quantity

    return {
      ...line,
      scope,
      quantity,
      codes: Array.from({ length: quantity }, (_, index) => formatContainerCode(scope, start + index))
    }
  })
}
