import { RoleCreateManyInput } from '@/prisma/generated/models'

export const SUPER_USER_ROLE_KEY = 'system-admin'

export const DEFAULT_ROLES: RoleCreateManyInput[] = [
  {
    name: 'System Admin',
    description: 'Full system access',
    key: SUPER_USER_ROLE_KEY,
    isSystem: true
  }
]
