'use client'

import * as React from 'react'
import type { Table } from '@tanstack/react-table'

import { Button } from '../ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Icons } from '../icons'
import { TooltipWrapper } from '../tooltip-wrapper'

type DataTableViewOptionsProps<TData> = React.ComponentProps<typeof PopoverContent> & { table: Table<TData>; isHideLabel?: boolean }

export function DataTableViewOptions<TData>({ table, isHideLabel, ...props }: DataTableViewOptionsProps<TData>) {
  const columns = React.useMemo(
    () =>
      table
        .getAllColumns()
        .filter((column) => typeof column.accessorFn !== 'undefined' && column.getCanHide() && column.columnDef.meta?.title),
    [table]
  )

  return (
    <Popover>
      <TooltipWrapper label='View'>
        <PopoverTrigger asChild>
          <Button aria-label='Toggle columns' role='combobox' variant='outline' size='sm' className='ml-auto h-8 font-normal'>
            <Icons.settings2 className='text-muted-foreground' />
            {isHideLabel ? '' : 'View'}
          </Button>
        </PopoverTrigger>
      </TooltipWrapper>
      <PopoverContent className='w-fit max-w-50 p-0' {...props}>
        <Command>
          <CommandInput placeholder='Search columns...' />
          <CommandList className='max-h-72 overflow-y-auto'>
            <CommandEmpty>No columns found.</CommandEmpty>

            <CommandGroup>
              {columns.map((column) => (
                <CommandItem
                  key={column.id}
                  onSelect={() => column.toggleVisibility(!column.getIsVisible())}
                  data-checked={column.getIsVisible()}
                  className='cursor-pointer'
                >
                  <span className='truncate'>{column.columnDef.meta?.title ?? column.id}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
