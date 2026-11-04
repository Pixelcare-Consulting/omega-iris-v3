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
  BUSINESS_PARTNERS: 'p-business-partners',
  ITEMS: 'p-items',
  SITES: 'p-sites',
  PROCESS_ZONES: 'p-process-zones',
  PROJECT_CATEGORIES: 'p-project-categories',
  CUSTOMER_PROJECTS: 'p-customer-projects',
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
  },
  {
    code: PERMISSIONS_CODES['SITES'],
    name: 'Sites',
    description: 'Sites Module',
    isParent: false,
    parentCode: null,
    isSystem: true,
    allowedActions: ['view', 'create', 'edit', 'delete', 'restore', 'export']
  },
  {
    code: PERMISSIONS_CODES['PROCESS_ZONES'],
    name: 'Process Zones',
    description: 'Process Zones Module',
    isParent: false,
    parentCode: null,
    isSystem: true,
    allowedActions: ['view', 'create', 'edit', 'delete', 'restore', 'export']
  },
  {
    code: PERMISSIONS_CODES['PROJECT_CATEGORIES'],
    name: 'Project Categories',
    description: 'Project Categories Module',
    isParent: false,
    parentCode: null,
    isSystem: true,
    allowedActions: ['view', 'create', 'edit', 'delete', 'restore', 'export']
  },
  {
    code: PERMISSIONS_CODES['CUSTOMER_PROJECTS'],
    name: 'Customer Projects',
    description: 'Customer Projects Module',
    isParent: false,
    parentCode: null,
    isSystem: true,
    allowedActions: ['view', 'create', 'edit', 'delete', 'restore', 'export']
  }
]
