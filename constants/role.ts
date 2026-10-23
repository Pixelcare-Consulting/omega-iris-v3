import { RoleCreateManyInput } from '@/prisma/generated/models'

export const SUPER_USER_ROLE_KEY = 'system-admin'

export const DEFAULT_ROLES: RoleCreateManyInput[] = [
  {
    name: 'System Admin',
    description: 'Full system access',
    key: SUPER_USER_ROLE_KEY,
    isSystem: true
  },
  {
    name: 'Sales',
    description: 'Employee with sales access',
    key: 'sales',
    isSystem: true
  },
  {
    name: 'Marketing',
    description: 'Employee with marketing access',
    key: 'marketing',
    isSystem: true
  }
]
