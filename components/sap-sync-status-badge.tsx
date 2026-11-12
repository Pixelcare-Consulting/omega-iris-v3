import { Badge } from '@/components/ui/badge'
import { TooltipWrapper } from '@/components/tooltip-wrapper'
import { SAP_SYNC_STATUS_OPTIONS } from '@/constants/sap-sync'
import type { SapSyncStatus } from '@/prisma/generated/enums'

type SapSyncStatusBadgeProps = { status: SapSyncStatus; syncError?: string | null }

const VARIANTS = { PENDING: 'soft-slate', SYNCED: 'soft-green', FAILED: 'soft-red' } as const

//* a failed badge shows sap's message on hover
export default function SapSyncStatusBadge({ status, syncError }: SapSyncStatusBadgeProps) {
  const label = SAP_SYNC_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status
  const badge = <Badge variant={VARIANTS[status]}>{label}</Badge>

  if (status !== 'FAILED' || !syncError) return badge

  return (
    <TooltipWrapper label={syncError} labelClassName='max-w-80'>
      {badge}
    </TooltipWrapper>
  )
}
