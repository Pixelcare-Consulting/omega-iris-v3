'use client'

import { Button } from '../ui/button'
import { Icons } from '../icons'
import { TooltipWrapper } from '../tooltip-wrapper'
import { cn } from '@/lib/utils'
import { DataTableViewMode } from '@/types/data-table'

type DataTableViewModeToggleProps = {
  viewMode: DataTableViewMode
  onViewModeChange: (viewMode: DataTableViewMode) => void
  isLoading?: boolean
}

//* switches how the rows are drawn, the table state behind them is the same either way
export default function DataTableViewModeToggle({ viewMode, onViewModeChange, isLoading }: DataTableViewModeToggleProps) {
  const modes = [
    { mode: 'table' as const, label: 'Table View', icon: Icons.table },
    { mode: 'card' as const, label: 'Card View', icon: Icons.layoutGrid }
  ]

  return (
    <div className='bg-muted flex items-center gap-0.5 rounded-md p-0.5'>
      {modes.map(({ mode, label, icon: Icon }) => {
        const isActive = viewMode === mode

        return (
          <TooltipWrapper key={mode} label={label}>
            <Button
              type='button'
              variant={isActive ? 'default' : 'ghost'}
              size='icon-sm'
              disabled={isLoading}
              aria-label={label}
              aria-pressed={isActive}
              className={cn(!isActive && 'hover:bg-background/60', isActive && 'shadow-sm')}
              onClick={() => onViewModeChange(mode)}
            >
              <Icon className={cn('size-4', !isActive && 'text-muted-foreground')} />
            </Button>
          </TooltipWrapper>
        )
      })}
    </div>
  )
}
