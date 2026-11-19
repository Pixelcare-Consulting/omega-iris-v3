import type { ActivityConfig } from '@/types/activity-log'
import type { Prisma } from '@/prisma/generated/client'

type UserActivityRow = Prisma.UserGetPayload<{ include: { role: true } }>

//* passwords are never listed, a reset is added by hand as "Reset"
export const USER_ACTIVITY_CONFIG: ActivityConfig<UserActivityRow> = {
  fields: [
    { key: 'fname', label: 'First Name' },
    { key: 'mname', label: 'Middle Name' },
    { key: 'lname', label: 'Last Name' },
    { key: 'suffix', label: 'Suffix' },
    { key: 'username', label: 'Username' },
    { key: 'email', label: 'Email' },
    { key: 'employeeId', label: 'Employee ID' },
    { key: 'roleCode', label: 'Role', format: (row) => row.role?.name },
    { key: 'isInternal', label: 'Internal' },
    { key: 'isActive', label: 'Active' },
    { key: 'isLocked', label: 'Locked' }
  ]
}
