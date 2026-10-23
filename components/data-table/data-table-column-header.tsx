'use client'

import { Icons } from '../icons'
import { type Column } from '@tanstack/react-table'

import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

type DataTableColumnHeaderProps<TData, TValue> = React.HTMLAttributes<HTMLButtonElement> & {
  column: Column<TData, TValue>
  title: string
}

export function DataTableColumnHeader<TData, TValue>({ column, title, className, ...props }: DataTableColumnHeaderProps<TData, TValue>) {
  const isPinnedLeft = column.getIsPinned() === 'left'
  const isPinnedRight = column.getIsPinned() === 'right'
  const isPinned = isPinnedLeft || isPinnedRight

  const canSort = column.getCanSort()
  const canHide = column.getCanHide()
  const canPin = column.getCanPin()

  if (!canSort && !canHide) {
    return <div className={cn(className)}>{title}</div>
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'hover:bg-accent focus:ring-ring data-[state=open]:bg-accent [&_svg]:text-muted-foreground -ml-1.5 flex h-8 items-center gap-1.5 rounded-md px-2 py-1.5 focus:ring-1 focus:outline-none [&_svg]:size-4 [&_svg]:shrink-0',
          className
        )}
        {...props}
      >
        {title}
        {canSort &&
          (column.getIsSorted() === 'desc' ? (
            <Icons.arrowDown />
          ) : column.getIsSorted() === 'asc' ? (
            <Icons.arrowUp />
          ) : (
            <Icons.arrowUpDown />
          ))}
        {column.getSortIndex() > -1 && (
          <span className='text-muted-foreground bg-accent flex size-4 items-center justify-center rounded-full text-[10px] font-medium'>
            {column.getSortIndex() + 1}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align='start' className='w-fit'>
        {canSort && (
          <>
            <DropdownMenuCheckboxItem
              className='[&_svg]:text-muted-foreground relative cursor-pointer pr-8 pl-2 [&>span:first-child]:right-2 [&>span:first-child]:left-auto'
              checked={column.getIsSorted() === 'asc'}
              onClick={() => column.toggleSorting(false, true)}
            >
              <Icons.arrowUp />
              Asc
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              className='[&_svg]:text-muted-foreground relative cursor-pointer pr-8 pl-2 [&>span:first-child]:right-2 [&>span:first-child]:left-auto'
              checked={column.getIsSorted() === 'desc'}
              onClick={() => column.toggleSorting(true, true)}
            >
              <Icons.arrowDown />
              Desc
            </DropdownMenuCheckboxItem>
            {column.getIsSorted() && (
              <DropdownMenuItem className='[&_svg]:text-muted-foreground cursor-pointer pl-2' onClick={() => column.clearSorting()}>
                <Icons.x />
                Clear Sort
              </DropdownMenuItem>
            )}
          </>
        )}

        {canSort && (canHide || canPin) && <DropdownMenuSeparator />}

        {canPin && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className='[&_svg]:text-muted-foreground cursor-pointer pl-2'>
              <Icons.pin />
              {isPinned ? 'Pinned' : 'Pin Column'}
            </DropdownMenuSubTrigger>

            <DropdownMenuSubContent className='w-fit'>
              <DropdownMenuCheckboxItem
                className='[&_svg]:text-muted-foreground relative cursor-pointer pr-8 pl-2 [&>span:first-child]:right-2 [&>span:first-child]:left-auto'
                checked={isPinnedLeft}
                onClick={() => (isPinnedLeft ? column.pin(false) : column.pin('left'))}
              >
                <Icons.panelLeft />
                Pin Left
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                className='[&_svg]:text-muted-foreground relative cursor-pointer pr-8 pl-2 [&>span:first-child]:right-2 [&>span:first-child]:left-auto'
                checked={isPinnedRight}
                onClick={() => (isPinnedRight ? column.pin(false) : column.pin('right'))}
              >
                <Icons.panelRight />
                Pin Right
              </DropdownMenuCheckboxItem>

              {isPinned && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className='[&_svg]:text-muted-foreground cursor-pointer pl-2' onClick={() => column.pin(false)}>
                    <Icons.pinOff />
                    Unpin
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {canSort && canHide && <DropdownMenuSeparator />}

        {canHide && (
          <DropdownMenuCheckboxItem
            className='[&_svg]:text-muted-foreground relative cursor-pointer pr-8 pl-2 [&>span:first-child]:right-2 [&>span:first-child]:left-auto'
            checked={!column.getIsVisible()}
            onClick={() => column.toggleVisibility(false)}
          >
            <Icons.eyeOff />
            Hide
          </DropdownMenuCheckboxItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
