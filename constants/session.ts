import type { SessionStatus, SessionType } from '@/prisma/generated/enums'
import { Icons, type Icon } from '@/components/icons'
import type { BadgeVariants } from '@/components/ui/badge'

type SessionTypeConfig = {
  label: string
  description: string
  icon: Icon
}

export const SESSION_TYPES = [
  'INBOUND',
  'OUTBOUND',
  'MOVEMENT',
  'CYCLE_COUNT',
  'QC_TESTING',
  'RMA'
] as const satisfies readonly SessionType[]

//* processes with a module built, the rest can't start a session yet
export const BUILT_SESSION_TYPES: readonly SessionType[] = ['INBOUND']

export const SESSION_TYPE_CONFIG: Record<SessionType, SessionTypeConfig> = {
  INBOUND: {
    label: 'Inbound',
    description: 'Receive goods against a PO and create unique IDs.',
    icon: Icons.arrowDownToLine
  },
  OUTBOUND: {
    label: 'Outbound',
    description: 'Pick and release packages for shipping.',
    icon: Icons.truck
  },
  MOVEMENT: {
    label: 'Inventory movement',
    description: 'Move packages between locations, pallets and containers.',
    icon: Icons.arrowLeftRight
  },
  CYCLE_COUNT: {
    label: 'Cycle count',
    description: 'Count stock at a location and record the differences.',
    icon: Icons.listChecks
  },
  QC_TESTING: {
    label: 'QC testing',
    description: 'Inspect received packages and set their QC status.',
    icon: Icons.flaskConical
  },
  RMA: {
    label: 'RMA / return',
    description: 'Receive returned goods back into stock.',
    icon: Icons.restore
  }
}

export const SESSION_TYPE_OPTIONS = SESSION_TYPES.map((value) => ({ label: SESSION_TYPE_CONFIG[value].label, value }))

export const SESSION_STATUSES = ['IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CANCELLED'] as const satisfies readonly SessionStatus[]

export const SESSION_STATUS_CONFIG: Record<SessionStatus, { label: string; variant: BadgeVariants['variant'] }> = {
  IN_PROGRESS: { label: 'In progress', variant: 'soft-blue' },
  PAUSED: { label: 'Paused', variant: 'soft-amber' },
  COMPLETED: { label: 'Completed', variant: 'soft-green' },
  CANCELLED: { label: 'Cancelled', variant: 'soft-red' }
}

export const SESSION_STATUS_OPTIONS = SESSION_STATUSES.map((value) => ({ label: SESSION_STATUS_CONFIG[value].label, value }))

//* site switch a session type needs turned on
export const SITE_SWITCH_BY_SESSION_TYPE = {
  INBOUND: 'isEnableInbound',
  OUTBOUND: 'isEnableOutbound',
  MOVEMENT: 'isEnableMovement',
  CYCLE_COUNT: 'isEnableCycleCount',
  QC_TESTING: 'isEnableQcTesting',
  RMA: 'isEnableRma'
} as const satisfies Record<SessionType, string>

export type SiteSwitch = (typeof SITE_SWITCH_BY_SESSION_TYPE)[SessionType]

//* open means the user still holds it
export const OPEN_SESSION_STATUSES = ['IN_PROGRESS', 'PAUSED'] as const satisfies readonly SessionStatus[]
