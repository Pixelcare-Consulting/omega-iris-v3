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

//* recursively collects every leaf (permission with no children) under the given node(s)
export function getLeafPermissions(nodes: PermissionNode[]): Permission[] {
  return nodes.flatMap((node) => (node.children.length > 0 ? getLeafPermissions(node.children) : [node]))
}
