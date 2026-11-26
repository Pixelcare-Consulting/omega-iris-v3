import type { ActivityConfig } from '@/types/activity-log'
import type { ProjectCategory } from '@/prisma/generated/client'

export const PROJECT_CATEGORY_ACTIVITY_CONFIG: ActivityConfig<ProjectCategory> = {
  fields: [
    { key: 'code', label: 'Code' },
    { key: 'name', label: 'Name' },
    { key: 'description', label: 'Description' },
    { key: 'isPoRequired', label: 'PO Required' },
    { key: 'isMandatoryQc', label: 'Mandatory QC' },
    { key: 'isActive', label: 'Active' }
  ]
}
