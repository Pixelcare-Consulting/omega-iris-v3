'use client'

import * as React from 'react'
import type { Table } from '@tanstack/react-table'

import { Button } from '../ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Icons } from '../icons'
import { toast } from 'sonner'
import { TooltipWrapper } from '../tooltip-wrapper'

type DataTableActionsOptionsProps<TData> = React.ComponentProps<typeof PopoverContent> & { table: Table<TData>; isHideLabel?: boolean }

export function DataTableActionsOptions<TData>({ table, isHideLabel, ...props }: DataTableActionsOptionsProps<TData>) {
  const handleClearSorting = () => {
    table.resetSorting()
    toast.success('Sorting cleared!')
  }

  const handleClearColumnFilters = () => {
    table.resetColumnFilters()
    toast.success('Column filters cleared!')
  }

  const handleClearSearch = () => {
    table.resetGlobalFilter()
    toast.success('Search cleared!')
  }

  const handleClearColumnPinning = () => {
    table.resetColumnPinning()
    toast.success('Column pinning cleared!')
  }

  const handleClearAll = () => {
    table.resetSorting()
    table.resetColumnFilters()
    table.resetGlobalFilter()
    table.resetColumnPinning()
    toast.success('All cleared!')
  }

  const options = [
    { label: 'Clear Sorting', action: () => handleClearSorting() },
    { label: 'Clear Column Filters', action: () => handleClearColumnFilters() },
    { label: 'Clear Search', action: () => handleClearSearch() },
    { label: 'Clear Column Pinning', action: () => handleClearColumnPinning() },
    { label: 'Clear All', action: () => handleClearAll() }
  ]

  return (
    <Popover>
      <TooltipWrapper label='Options'>
        <PopoverTrigger asChild>
          <Button aria-label='Toggle columns' role='combobox' variant='outline' size='sm' className='ml-auto h-8 font-normal'>
            <Icons.list className='text-muted-foreground' />
            {isHideLabel ? '' : 'Options'}
          </Button>
        </PopoverTrigger>
      </TooltipWrapper>
      <PopoverContent className='w-fit max-w-50 p-0' {...props}>
        <Command>
          <CommandInput placeholder='Search columns...' />
          <CommandList className='max-h-72 overflow-y-auto'>
            <CommandEmpty>No actions found.</CommandEmpty>

            <CommandGroup>
              {options.map((option) => (
                <CommandItem key={option.label} onSelect={option.action} className='cursor-pointer'>
                  <span className='truncate'>{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
