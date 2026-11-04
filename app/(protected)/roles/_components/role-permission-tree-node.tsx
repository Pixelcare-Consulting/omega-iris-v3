'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { PermissionNode, getAssignablePermissions } from '@/lib/permissions'

type PermissionTreeNodeProps = {
  node: PermissionNode
  depth?: number
  selectedActionsMap: Map<string, string[]>
  onToggleAction: (code: string, action: string) => void
  onToggleNode: (node: PermissionNode) => void
}

function PermissionActions({
  node,
  selectedActions,
  onToggleAction
}: {
  node: PermissionNode
  selectedActions: string[]
  onToggleAction: (code: string, action: string) => void
}) {
  return (
    <div className='col-span-12 grid grid-cols-2 items-center gap-x-4 gap-y-3 sm:col-span-8 sm:grid-cols-3 lg:grid-cols-6'>
      {node.allowedActions.map((action) => (
        <label key={`${node.code}-${action}`} className='flex cursor-pointer items-center gap-2 text-xs capitalize'>
          <Checkbox checked={selectedActions.includes(action)} onCheckedChange={() => onToggleAction(node.code, action)} />
          {action}
        </label>
      ))}
    </div>
  )
}

export function PermissionTreeNode({ node, depth = 0, selectedActionsMap, onToggleAction, onToggleNode }: PermissionTreeNodeProps) {
  const hasChildren = node.children.length > 0

  if (hasChildren) {
    const assignable = getAssignablePermissions([node])
    const allSelected = assignable.every((p) => p.allowedActions.every((a) => (selectedActionsMap.get(p.code) ?? []).includes(a)))
    const someSelected = assignable.some((p) => (selectedActionsMap.get(p.code) ?? []).length > 0)

    return (
      <div className='col-span-12 grid grid-cols-12 py-2'>
        {/* //* a parent's own actions sit on its row, same as a leaf */}
        <div className='col-span-12 mb-1 grid grid-cols-12 items-center gap-2 pr-2'>
          <div
            className={cn('col-span-12 flex items-start gap-2', node.allowedActions.length > 0 && 'sm:col-span-4')}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
          >
            <Checkbox
              className='mt-0.5 shrink-0'
              checked={someSelected ? (allSelected ? true : 'indeterminate') : false}
              onCheckedChange={() => onToggleNode(node)}
            />
            <div className='flex flex-col justify-center'>
              <h1 className={cn('cursor-pointer text-sm font-semibold', depth > 0 && 'text-[13px]')}>{node.name}</h1>
              {node.description && <p className='-mt-0.5 text-xs text-neutral-400'>{node.description}</p>}
            </div>
          </div>

          {node.allowedActions.length > 0 && (
            <PermissionActions node={node} selectedActions={selectedActionsMap.get(node.code) ?? []} onToggleAction={onToggleAction} />
          )}
        </div>

        <div className='col-span-12 flex flex-col divide-y'>
          {node.children.map((child) => (
            <PermissionTreeNode
              key={child.code}
              node={child}
              depth={depth + 1}
              selectedActionsMap={selectedActionsMap}
              onToggleAction={onToggleAction}
              onToggleNode={onToggleNode}
            />
          ))}
        </div>
      </div>
    )
  }

  //* leaf permission row
  const selectedActions = selectedActionsMap.get(node.code) ?? []
  const allSelected = node.allowedActions.every((a) => selectedActions.includes(a))
  const someSelected = node.allowedActions.some((a) => selectedActions.includes(a))

  return (
    <div className='col-span-12 grid grid-cols-12 gap-2 p-2 hover:bg-slate-400/10'>
      <div className='col-span-12 flex items-start gap-2 sm:col-span-4' style={{ paddingLeft: `${depth * 16}px` }}>
        <Checkbox
          className='mt-0.5 shrink-0'
          checked={someSelected ? (allSelected ? true : 'indeterminate') : false}
          onCheckedChange={() => onToggleNode(node)}
        />
        <div className='flex flex-col justify-center'>
          <h2 className='text-sm font-semibold'>{node.name}</h2>
          {node.description && <p className='-mt-0.5 text-xs text-neutral-400'>{node.description}</p>}
        </div>
      </div>

      <PermissionActions node={node} selectedActions={selectedActions} onToggleAction={onToggleAction} />
    </div>
  )
}
