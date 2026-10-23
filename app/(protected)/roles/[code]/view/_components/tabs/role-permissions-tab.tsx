'use client'

import { useMemo } from 'react'

import ContentWrapper from '@/components/content-wrapper'
import { ScrollArea } from '@/components/ui/scroll-area'
import ReadOnlyFieldHeader from '@/components/read-only-field-header'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { usePermissions } from '@/hooks/safe-actions/permission'
import { useRolePermissions } from '@/hooks/safe-actions/role-permission'
import { buildPermissionTree, PermissionNode } from '@/lib/permissions'
import { Icons } from '@/components/icons'

type RolePermissionsTabProps = {
  permissions: ReturnType<typeof usePermissions>
  rolePermissions: ReturnType<typeof useRolePermissions>
}

export default function RolePermissionsTab({ permissions, rolePermissions }: RolePermissionsTabProps) {
  const permissionTree = useMemo(() => buildPermissionTree(permissions.data), [permissions.data])

  //* permissionCode -> Set of actions actually granted to this role
  const grantedByCode = useMemo(() => {
    const map = new Map<string, Set<string>>()
    rolePermissions.data.forEach((rp) => map.set(rp.permissionCode, new Set(rp.actions)))
    return map
  }, [rolePermissions.data])

  const isLoading = permissions.isLoading || rolePermissions.isLoading

  return (
    <ContentWrapper className='h-full'>
      <ScrollArea className='flex min-h-0 flex-1 flex-col p-4' type='auto' viewPortClassName='[&>div]:h-full'>
        <div className='flex h-full flex-col gap-4'>
          <div>
            <ReadOnlyFieldHeader title='Permissions' description="Role's assigned permissions" />
            <Separator className='mt-4' />
          </div>

          {!isLoading && permissionTree.length == 0 && (
            <div className='text-muted-foreground flex-coltext-sm flex min-h-0 flex-1'>
              <div className='flex flex-1 items-center justify-center gap-1.5'>
                <Icons.folderOpen /> <span>No permissions found.</span>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className='text-muted-foreground flex-coltext-sm flex min-h-0 flex-1'>
              <div className='flex flex-1 items-center justify-center gap-1.5'>
                <Icons.spinner className='animate-spin' /> <span>Loading permissions...</span>
              </div>
            </div>
          ) : (
            <div className='divide-border flex flex-col divide-y rounded-md border pl-2'>
              {permissionTree.map((node) => (
                <PermissionRow key={node.code} node={node} grantedByCode={grantedByCode} depth={0} />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </ContentWrapper>
  )
}

function PermissionRow({ node, grantedByCode, depth }: { node: PermissionNode; grantedByCode: Map<string, Set<string>>; depth: number }) {
  const hasChildren = node.children.length > 0
  const grantedActions = grantedByCode.get(node.code)

  return (
    <div className='flex flex-col'>
      <div
        className='flex flex-col gap-2 py-2.5 pr-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4'
        style={{ paddingLeft: `clamp(0px, ${depth * 20}px, ${depth * 12}px)` }}
      >
        <div className='flex min-w-0 flex-col'>
          <span className='font-medium wrap-break-word'>{node.name}</span>
          {node.description && <span className='text-muted-foreground/70 line-clamp-2 text-xs sm:truncate'>{node.description}</span>}
        </div>

        {!hasChildren && (
          <div className='flex flex-wrap items-center gap-1.5 sm:shrink-0'>
            {node.allowedActions.map((action) => {
              const isGranted = grantedActions?.has(action) ?? false
              return (
                <Badge
                  key={action}
                  variant={isGranted ? 'default' : 'outline'}
                  className={cn('text-xs capitalize', !isGranted && 'opacity-40')}
                >
                  {action}
                </Badge>
              )
            })}
          </div>
        )}
      </div>

      {hasChildren && (
        <div className='divide-border flex flex-col divide-y border-t'>
          {node.children.map((child) => (
            <PermissionRow key={child.code} node={child} grantedByCode={grantedByCode} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}
