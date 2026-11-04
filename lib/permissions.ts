import { Permission } from '@/prisma/generated/client'

export type PermissionNode = Permission & { children: PermissionNode[] }

//* builds an arbitrarily deep tree from a flat list, using a map for O(n)
export function buildPermissionTree(permissions: Permission[]): PermissionNode[] {
  const byCode = new Map<string, PermissionNode>()
  permissions.forEach((p) => byCode.set(p.code, { ...p, children: [] }))

  const roots: PermissionNode[] = []

  byCode.forEach((node) => {
    if (node.parentCode && byCode.has(node.parentCode)) {
      byCode.get(node.parentCode)!.children.push(node)
    } else {
      roots.push(node)
    }
  })

  return roots
}

//* every permission that has actions to grant under the given node(s), parents included
//! a parent like p-items guards its own page, so it must be grantable, not only its leaves
export function getAssignablePermissions(nodes: PermissionNode[]): Permission[] {
  return nodes.flatMap((node) => [...(node.allowedActions.length > 0 ? [node] : []), ...getAssignablePermissions(node.children)])
}
