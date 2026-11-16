import { PermissionCreateManyInput } from '@/prisma/generated/models'

export const PERMISSIONS_ALLOWED_ACTIONS = {
  VIEW: 'view',
  CREATE: 'create',
  EDIT: 'edit',
  DELETE: 'delete',
  RESTORE: 'restore',
  IMPORT: 'import',
  EXPORT: 'export',
  SYNC_TO_SAP: 'sync to sap',
  SYNC_FROM_SAP: 'sync from sap'
} as const

export const PERMISSIONS_CODES = {
  DASHBOARD: 'p-dashboard',
  ROLES: 'p-roles',
  USERS: 'p-users',
  SETTINGS: 'p-settings',

  //* parents, one per sidebar dropdown, they only group their modules
  BP_MASTER: 'p-bp-master',
  WAREHOUSE: 'p-warehouse',
  INVENTORY: 'p-inventory',
  PROJECT: 'p-project',

  CUSTOMERS: 'p-customers',
  VENDORS: 'p-vendors',
  BUSINESS_PARTNERS: 'p-business-partners',
  ITEMS: 'p-items',
  SITES: 'p-sites',
  PROCESS_ZONES: 'p-process-zones',
  LOCATIONS: 'p-locations',
  PROJECT_CATEGORIES: 'p-project-categories',
  CUSTOMER_PROJECTS: 'p-customer-projects',
  ITEM_MASTERS: 'p-item-masters',
  TEST: 'p-test'
} as const

//* same order as the sidebar, a parent comes before its modules
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
    code: PERMISSIONS_CODES['BP_MASTER'],
    name: 'BP Master',
    description: 'BP Master Modules',
    isParent: true,
    parentCode: null,
    isSystem: true,
    allowedActions: []
  },
  {
    code: PERMISSIONS_CODES['CUSTOMERS'],
    name: 'Customers',
    description: 'Customers Module',
    isParent: false,
    parentCode: PERMISSIONS_CODES['BP_MASTER'],
    isSystem: true,
    allowedActions: ['view', 'create', 'edit', 'delete', 'restore', 'export', 'sync to sap', 'sync from sap']
  },
  {
    code: PERMISSIONS_CODES['VENDORS'],
    name: 'Vendors',
    description: 'Vendors Module',
    isParent: false,
    parentCode: PERMISSIONS_CODES['BP_MASTER'],
    isSystem: true,
    allowedActions: ['view', 'create', 'edit', 'delete', 'restore', 'export', 'sync from sap']
  },
  {
    code: PERMISSIONS_CODES['ITEM_MASTERS'],
    name: 'Item Masters',
    description: 'Item Masters Module',
    isParent: false,
    parentCode: null,
    isSystem: true,
    allowedActions: ['view', 'create', 'edit', 'delete', 'restore', 'export', 'sync to sap', 'sync from sap']
  },
  {
    code: PERMISSIONS_CODES['WAREHOUSE'],
    name: 'Warehouse',
    description: 'Warehouse Modules',
    isParent: true,
    parentCode: null,
    isSystem: true,
    allowedActions: []
  },
  {
    code: PERMISSIONS_CODES['SITES'],
    name: 'Sites',
    description: 'Sites Module',
    isParent: false,
    parentCode: PERMISSIONS_CODES['WAREHOUSE'],
    isSystem: true,
    allowedActions: ['view', 'create', 'edit', 'delete', 'restore', 'export']
  },
  {
    code: PERMISSIONS_CODES['PROCESS_ZONES'],
    name: 'Process Zones',
    description: 'Process Zones Module',
    isParent: false,
    parentCode: PERMISSIONS_CODES['WAREHOUSE'],
    isSystem: true,
    allowedActions: ['view', 'create', 'edit', 'delete', 'restore', 'export']
  },
  {
    code: PERMISSIONS_CODES['LOCATIONS'],
    name: 'Locations',
    description: 'Locations Module',
    isParent: false,
    parentCode: PERMISSIONS_CODES['WAREHOUSE'],
    isSystem: true,
    allowedActions: ['view', 'create', 'edit', 'delete', 'restore', 'export']
  },
  {
    code: PERMISSIONS_CODES['INVENTORY'],
    name: 'Inventory',
    description: 'Inventory Modules',
    isParent: true,
    parentCode: null,
    isSystem: true,
    allowedActions: []
  },
  {
    code: PERMISSIONS_CODES['PROJECT'],
    name: 'Project',
    description: 'Project Modules',
    isParent: true,
    parentCode: null,
    isSystem: true,
    allowedActions: []
  },
  {
    code: PERMISSIONS_CODES['PROJECT_CATEGORIES'],
    name: 'Project Categories',
    description: 'Project Categories Module',
    isParent: false,
    parentCode: PERMISSIONS_CODES['PROJECT'],
    isSystem: true,
    allowedActions: ['view', 'create', 'edit', 'delete', 'restore', 'export']
  },
  {
    code: PERMISSIONS_CODES['CUSTOMER_PROJECTS'],
    name: 'Customer Projects',
    description: 'Customer Projects Module',
    isParent: false,
    parentCode: PERMISSIONS_CODES['PROJECT'],
    isSystem: true,
    allowedActions: ['view', 'create', 'edit', 'delete', 'restore', 'export']
  }
]
