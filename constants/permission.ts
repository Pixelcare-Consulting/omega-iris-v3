import { PermissionCreateManyInput } from '@/prisma/generated/models'

export const PERMISSIONS_ALLOWED_ACTIONS = {
  VIEW: 'view',
  CREATE: 'create',
  EDIT: 'edit',
  DELETE: 'delete',
  RESTORE: 'restore',
  IMPORT: 'import',
  EXPORT: 'export'
} as const

export const PERMISSIONS_CODES = {
  DASHBOARD: 'p-dashboard',
  ROLES: 'p-roles',
  USERS: 'p-users',
  SETTINGS: 'p-settings',
  TEST: 'p-test'
} as const

export const DEFAULT_PERMISSIONS: PermissionCreateManyInput[] = [
  {
    code: PERMISSIONS_CODES['DASHBOARD'],
    name: 'Dashboard',
    description: 'Dashboard Module',
    isParent: false,
    isSystem: true,
    parentCode: null,
    allowedActions: ['view']
  },
  {
    code: PERMISSIONS_CODES['USERS'],
    name: 'Users',
    description: 'Users Module',
    isParent: false,
    parentCode: null,
    isSystem: true,
    allowedActions: ['view', 'create', 'edit', 'delete', 'restore', 'export']
  },
  {
    code: PERMISSIONS_CODES['ROLES'],
    name: 'Roles',
    description: 'Roles Module',
    isParent: false,
    parentCode: null,
    isSystem: true,
    allowedActions: ['view', 'create', 'edit', 'delete', 'restore', 'export']
  }
]
