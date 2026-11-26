import type { BadgeVariants } from '@/components/ui/badge'
import type { InboundStatus } from '@/prisma/generated/enums'

export const INBOUND_STATUS_CONFIG: Record<InboundStatus, { label: string; variant: BadgeVariants['variant'] }> = {
  DRAFT: { label: 'Draft', variant: 'soft-neutral' },
  SUBMITTED: { label: 'Submitted', variant: 'soft-green' },
  CANCELLED: { label: 'Cancelled', variant: 'soft-red' }
}

export const INBOUND_STATUS_OPTIONS = (Object.keys(INBOUND_STATUS_CONFIG) as InboundStatus[]).map((value) => ({
  label: INBOUND_STATUS_CONFIG[value].label,
  value
}))

export const INBOUND_STEPS = ['location', 'project', 'po', 'items', 'review'] as const

export type InboundStep = (typeof INBOUND_STEPS)[number]

export const INBOUND_STEP_CONFIG: Record<InboundStep, { label: string; caption: string }> = {
  location: { label: 'Location', caption: 'Where goods arrive' },
  project: { label: 'Project', caption: 'Customer project' },
  po: { label: 'Purchase order', caption: 'Enter an open PO' },
  items: { label: 'Received & inspection', caption: 'Add each package' },
  review: { label: 'Review & submit', caption: 'Check and submit' }
}

export const DEFAULT_INBOUND_STEP: InboundStep = 'location'

//* sap DocumentStatus of a po still open for receiving
export const SAP_OPEN_DOCUMENT_STATUS = 'bost_Open'

//* sap LineStatus of a po line closed for receiving, an open po can still hold some
export const SAP_CLOSED_LINE_STATUS = 'bost_Close'
