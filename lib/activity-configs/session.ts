import type { ActivityConfig } from '@/types/activity-log'
import type { Session } from '@/prisma/generated/client'
import { SESSION_STATUS_CONFIG, SESSION_TYPE_CONFIG } from '@/constants/session'

export const SESSION_ACTIVITY_CONFIG: ActivityConfig<Session> = {
  fields: [
    { key: 'code', label: 'Code' },
    { key: 'type', label: 'Type', format: (row) => SESSION_TYPE_CONFIG[row.type].label },
    { key: 'siteCode', label: 'Site' },
    { key: 'status', label: 'Status', format: (row) => SESSION_STATUS_CONFIG[row.status].label },
    { key: 'cancelReason', label: 'Cancel Reason' }
  ]
}
