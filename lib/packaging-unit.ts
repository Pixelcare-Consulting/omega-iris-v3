import { differenceInDays } from 'date-fns'

import type { PackagingUnitWithRelations } from '@/actions/packaging-unit'
import type { LabelSize } from '@/constants/label'
import { PACKAGING_UNIT_PADDING_LENGTH } from '@/constants/packaging-unit'
import type { SessionType } from '@/prisma/generated/enums'

export type PackagingUnitTransaction = { type: SessionType; code: string; href: string; sessionCode: string }

//* transaction that made the unit
export function getPackagingUnitTransaction(unit: PackagingUnitWithRelations): PackagingUnitTransaction {
  const { inbound } = unit.inboundItem

  return {
    type: 'INBOUND',
    code: inbound.code,
    href: `/inbound/${encodeURIComponent(inbound.code)}/view`,
    sessionCode: inbound.sessionCode
  }
}

//* padded inline, lib/sequence is server only
export function formatPackagingUnitCode(scope: string, value: number) {
  return `${scope}-U${String(value).padStart(PACKAGING_UNIT_PADDING_LENGTH, '0')}`
}

export function getPackagingUnitLabelPdfHref(code: string, size: LabelSize, isDownload = false) {
  return `/api/packaging-units/${encodeURIComponent(code)}/label/pdf?size=${size}${isDownload ? '&download=1' : ''}`
}

export function getAgingDays(receivedAt: Date, now = new Date()) {
  return Math.max(differenceInDays(now, new Date(receivedAt)), 0)
}
