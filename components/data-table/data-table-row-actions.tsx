'use client'

import { useContext } from 'react'

import { AbilityContext } from '@/contexts/ability'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '../ui/dropdown-menu'
import { Icons } from '../icons'
import { TooltipWrapper } from '../tooltip-wrapper'

export type DataTableRowAction = {
  label: string
  icon: React.ReactNode
  onClick?: () => void
  subject?: string
  action?: string
  isHidden?: boolean
  isDestructive?: boolean
  items?: DataTableRowAction[]
}

type DataTableRowActionsProps = {
  actions: DataTableRowAction[]
  align?: React.ComponentProps<typeof DropdownMenuContent>['align']
}

//* overflow menu for a row's extra actions, view, edit and delete stay inline
//! permissions are checked here rather than per item, so the trigger can hide itself when nothing is left to show
export default function DataTableRowActions({ actions, align = 'end' }: DataTableRowActionsProps) {
  const ability = useContext(AbilityContext)

  const toAllowedActions = (rowActions: DataTableRowAction[]): DataTableRowAction[] =>
    rowActions
      .map((rowAction) => (rowAction.items ? { ...rowAction, items: toAllowedActions(rowAction.items) } : rowAction))
      .filter(({ isHidden, subject, action, items }) => {
        if (isHidden) return false

        //* a submenu whose entries are all denied has nothing left to open
        if (items && items.length === 0) return false
        if (!subject || !action) return true

        return !!ability?.can(action, subject)
      })

  const allowedActions = toAllowedActions(actions)

  if (allowedActions.length === 0) return null

  return (
    <DropdownMenu>
      <TooltipWrapper label='More Options'>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' size='icon-sm'>
            <Icons.ellipsisVertical className='text-muted-foreground size-4' />
          </Button>
        </DropdownMenuTrigger>
      </TooltipWrapper>

      <DropdownMenuContent className='w-auto min-w-32' align={align}>
        {allowedActions.map(({ label, icon, onClick, isDestructive, items }) =>
          items ? (
            <DropdownMenuSub key={label}>
              <DropdownMenuSubTrigger>
                {icon} {label}
              </DropdownMenuSubTrigger>

              <DropdownMenuPortal>
                <DropdownMenuSubContent className='w-auto min-w-32'>
                  {items.map((item) => (
                    <DropdownMenuItem key={item.label} variant={item.isDestructive ? 'destructive' : 'default'} onClick={item.onClick}>
                      {item.icon} {item.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          ) : (
            <DropdownMenuItem key={label} variant={isDestructive ? 'destructive' : 'default'} onClick={onClick}>
              {icon} {label}
            </DropdownMenuItem>
          )
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
