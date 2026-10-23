'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Column } from '@tanstack/react-table'

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Icons } from '../icons'
import { cn } from '@/lib/utils'
import { FilterOption } from '@/types/data-table'
import { EMPTY_FILTER_LABEL, EMPTY_FILTER_VALUE } from '@/constants/data-table'
import { normalizeFilterValue } from '@/lib/data-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import LoadingButton from '../forms/button-field'

type DataTableColumnFilterProps<TData, TValue> = {
  column: Column<TData, TValue> | undefined
  title: string
  limit?: number
  isLoading?: boolean
} & ({ isFaceted: true; showCount?: boolean } | { isFaceted?: false; showCount?: never })

export default function DataTableColumnFilter<TData, TValue>({
  column,
  title,
  limit = 3,
  isLoading,
  isFaceted,
  showCount
}: DataTableColumnFilterProps<TData, TValue>) {
  const filterValue = column?.getFilterValue() as string[] | undefined

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  const parentRef = useRef<HTMLDivElement>(null)

  const facetedUniqueValues = column?.getFacetedUniqueValues()

  //* null, undefined and blank collapse into one EMPTY_FILTER_VALUE option with their counts summed
  //* without it they render as an unlabelled row or as the literal text 'null'
  const facetedCounts = useMemo(() => {
    if (!isFaceted) return undefined

    const counts = new Map<string, number>()

    for (const [value, count] of facetedUniqueValues ?? []) {
      const key = normalizeFilterValue(value)
      counts.set(key, (counts.get(key) ?? 0) + count)
    }

    return counts
  }, [isFaceted, facetedUniqueValues])

  const options: FilterOption[] = useMemo(() => {
    if (!isFaceted) return column?.columnDef.meta?.options ?? []

    return Array.from(facetedCounts?.keys() ?? []).map((value) => ({
      label: value === EMPTY_FILTER_VALUE ? EMPTY_FILTER_LABEL : value.replaceAll('-', ' ').toLowerCase(),
      value
    }))
  }, [isFaceted, facetedCounts, column?.columnDef.meta?.options])

  const filteredOptions = useMemo(
    () => (search.trim() === '' ? options : options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))),
    [options, search]
  )

  const virtualizer = useVirtualizer({
    count: filteredOptions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 5
  })

  const virtualOptions = virtualizer.getVirtualItems()

  const allValues = options.map((o) => o.value)
  const isAllSelected = allValues.length > 0 && allValues.every((v) => draft.has(v))
  const isFiltered = filterValue && filterValue.length > 0

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setDraft(new Set(filterValue ?? []))
      setSearch('')
    }
    setOpen(nextOpen)
  }

  const handleToggleValue = (value: string) => {
    setDraft((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  const handleSelectAll = () => {
    if (isAllSelected) setDraft(new Set())
    else setDraft(new Set(allValues))
  }

  const handleApply = () => {
    const values = Array.from(draft)
    column?.setFilterValue(values.length ? values : undefined)
    setOpen(false)
  }

  const handleClear = () => {
    column?.setFilterValue(undefined)
    setOpen(false)
  }

  useEffect(() => {
    if (open) {
      virtualizer.measure()
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    requestAnimationFrame(() => {
      virtualizer.measure()
    })
  }, [open, virtualizer])

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <LoadingButton variant='outline' className='flex items-center gap-2' isLoading={isLoading} loadingText='Loading'>
          <span className='font-normal'>{title}</span>

          {isFiltered && (
            <>
              <div className='hidden items-center gap-1 md:flex'>
                {filterValue.length > limit ? (
                  <Badge variant='secondary' className='rounded-sm px-1'>
                    {filterValue.length} selected
                  </Badge>
                ) : (
                  options
                    .filter((option) => filterValue.includes(option.value))
                    .map((option) => (
                      <Badge
                        key={option.value}
                        variant='secondary'
                        className={cn(
                          'rounded-sm px-1 font-normal',
                          isFaceted && option.value !== EMPTY_FILTER_VALUE && 'capitalize',
                          option.value === EMPTY_FILTER_VALUE && 'italic'
                        )}
                      >
                        {option.label}
                      </Badge>
                    ))
                )}
              </div>

              {/* //* on mobile just show the count */}
              <Badge variant='secondary' className='rounded-sm px-1 md:hidden'>
                {filterValue.length}
              </Badge>
            </>
          )}

          <Icons.upDown className='ml-auto h-4 w-4 shrink-0 opacity-50' />
        </LoadingButton>
      </PopoverTrigger>

      <PopoverContent className='w-52 p-0' align='start'>
        <Command shouldFilter={false}>
          <CommandInput value={search} onValueChange={setSearch} placeholder={`Search ${title.toLowerCase()}...`} />

          <CommandList>
            <div
              ref={parentRef}
              style={{
                height: 200,
                width: '100%',
                overflow: 'auto'
              }}
            >
              <CommandEmpty>No options found.</CommandEmpty>

              <CommandItem onSelect={handleSelectAll} className='border-border mb-1 flex cursor-pointer items-center gap-2 border-b'>
                <div
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-neutral-500',
                    isAllSelected
                      ? 'bg-primary text-primary-foreground'
                      : draft.size > 0
                        ? 'bg-primary text-primary-foreground'
                        : 'opacity-50'
                  )}
                >
                  {isAllSelected ? <Icons.check className='h-3 w-3' /> : draft.size > 0 ? <Icons.minus className='h-3 w-3' /> : null}
                </div>
                <span>Select All</span>
              </CommandItem>

              <CommandGroup>
                <div
                  style={{
                    height: virtualizer.getTotalSize(),
                    width: '100%',
                    position: 'relative'
                  }}
                >
                  {virtualOptions.map((virtualOption) => {
                    const option = filteredOptions[virtualOption.index]
                    const isSelected = draft.has(option.value)
                    const count = isFaceted ? facetedCounts?.get(option.value) : undefined
                    const isEmptyOption = option.value === EMPTY_FILTER_VALUE

                    return (
                      <CommandItem
                        title={option.label}
                        key={option.value}
                        onSelect={() => handleToggleValue(option.value)}
                        className='absolute top-0 left-0 flex w-full cursor-pointer items-center gap-2'
                        data-hide-check-icon
                        style={{
                          height: `${virtualOption.size}px`,
                          transform: `translateY(${virtualOption.start}px)`
                        }}
                      >
                        <div
                          className={cn(
                            'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-neutral-500',
                            isSelected ? 'bg-primary text-primary-foreground' : 'opacity-50'
                          )}
                        >
                          {isSelected && <Icons.check className='h-3 w-3' />}
                        </div>

                        <div className='flex min-w-0 flex-1 items-center gap-1.5'>
                          {option.icon && <option.icon className='text-muted-foreground h-4 w-4 shrink-0' />}
                          <span
                            className={cn(
                              'truncate',
                              isFaceted && !isEmptyOption && 'capitalize',
                              isEmptyOption && 'text-muted-foreground italic'
                            )}
                          >
                            {option.label}
                          </span>
                        </div>

                        {count !== undefined && showCount && (
                          <span className='text-muted-foreground ml-auto shrink-0 text-xs tabular-nums'>{count}</span>
                        )}
                      </CommandItem>
                    )
                  })}
                </div>
              </CommandGroup>
            </div>
          </CommandList>
        </Command>

        {/* //* footer actions */}
        <div className='flex items-center gap-2 border-t p-2'>
          {isFiltered && (
            <Button variant='ghost' size='sm' className='text-muted-foreground h-7 px-2 text-xs' onClick={handleClear}>
              <Icons.x className='mr-1 h-3 w-3' />
              Clear
            </Button>
          )}
          <Button size='sm' className='ml-auto h-7 px-3 text-xs' onClick={handleApply}>
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
