import type { ActivityConfig } from '@/types/activity-log'
import type { Prisma } from '@/prisma/generated/client'

export const ROLE_ACTIVITY_INCLUDE = {
  rolePermissions: { include: { permission: true } },
  roleSapDatabases: { include: { sapDatabase: true } }
} satisfies Prisma.RoleInclude

type RoleActivityRow = Prisma.RoleGetPayload<{ include: typeof ROLE_ACTIVITY_INCLUDE }>

export const ROLE_ACTIVITY_CONFIG: ActivityConfig<RoleActivityRow> = {
  fields: [
    { key: 'name', label: 'Name' },
    { key: 'key', label: 'Key' },
    { key: 'color', label: 'Color' },
    { key: 'description', label: 'Description' },
    {
      key: 'sapDatabases',
      label: 'SAP Databases',
      format: (row) => row.roleSapDatabases.map((item) => item.sapDatabase.name).sort()
    }
  ],
  children: [
    {
      key: 'rolePermissions',
      label: 'Permissions',
      noun: 'permission',
      rows: (row) => row.rolePermissions,
      matchKey: 'permissionCode',
      rowLabel: (rolePermission) => rolePermission.permission?.name ?? rolePermission.permissionCode,
      fields: [{ key: 'actions', label: 'Actions', format: (rolePermission) => [...rolePermission.actions].sort() }]
    }
  ]
}
