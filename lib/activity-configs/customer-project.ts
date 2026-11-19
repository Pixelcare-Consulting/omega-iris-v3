import type { ActivityConfig } from '@/types/activity-log'
import type { Prisma } from '@/prisma/generated/client'

type CustomerProjectActivityRow = Prisma.CustomerProjectGetPayload<{ include: { category: true } }>

export const CUSTOMER_PROJECT_ACTIVITY_CONFIG: ActivityConfig<CustomerProjectActivityRow> = {
  fields: [
    { key: 'code', label: 'Code' },
    { key: 'name', label: 'Name' },
    {
      key: 'categoryCode',
      label: 'Category',
      format: (row) => (row.category ? `${row.category.code} - ${row.category.name}` : row.categoryCode)
    },
    { key: 'description', label: 'Description' },
    { key: 'isActive', label: 'Active' }
  ]
}
