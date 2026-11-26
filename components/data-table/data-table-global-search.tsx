'use client'

import { Table } from '@tanstack/react-table'
import { ChangeEvent, ReactNode, useEffect, useRef } from 'react'
import { useDebouncedCallback } from 'use-debounce'

import { Icons } from '../icons'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '../ui/input-group'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '../ui/hover-card'
import { InputGroupInputProps, InputGroupProps } from '@/types/common'
import { cn } from '@/lib/utils'

type DataTableGlobalSearchProps<TData> = InputGroupProps & {
  table: Table<TData>
  delay?: number
  placeholder?: string //* name the searched fields, e.g. 'Search code, name...'
  inputGroupInputProps?: InputGroupInputProps
  isLoading?: boolean
  tips?: ReactNode //* extra page tips, listed after the general ones
}

const tipCode = 'bg-muted text-foreground rounded px-1'

//* how buildGlobalFilterWhere searches, so only server-searched tables show it
const GENERAL_SEARCH_TIPS = (
  <>
    <li>Part of a word is enough, it looks through every searchable column.</li>
    <li>
      Use <code className={tipCode}>*</code> to search more than one word. <code className={tipCode}>cebu*mandaue</code> finds rows that
      have both cebu and mandaue, in any column.
    </li>
    <li>Upper or lower case doesn&apos;t matter.</li>
    <li>It searches every page, not just the one shown, and works together with the filters.</li>
    <li>Matches are highlighted.</li>
  </>
)

export default function DataTableGlobalSearch<TData>({
  table,
  delay = 700,
  placeholder = 'Search...',
  inputGroupInputProps,
  isLoading,
  tips,
  ...props
}: DataTableGlobalSearchProps<TData>) {
  const inputRef = useRef<HTMLInputElement>(null)
  const globalFilter = table.getState().globalFilter ?? ''

  const handleSearch = (e: ChangeEvent<HTMLInputElement>) => table.setGlobalFilter(e.target.value)

  const debounceSearch = useDebouncedCallback(handleSearch, delay)

  //! client tables use tanstack includesString, which has no * rule, so they get no general tips
  const isServerSearch = !!table.options.manualFiltering
  const hasTips = isServerSearch || !!tips

  //* clear the input when global filter is empty
  useEffect(() => {
    if (!globalFilter && inputRef.current) inputRef.current.value = ''
  }, [globalFilter, inputRef])

  return (
    <InputGroup {...props} className={cn('w-full lg:max-w-70', props.className)}>
      <InputGroupInput
        {...inputGroupInputProps}
        ref={inputRef}
        defaultValue={globalFilter}
        placeholder={placeholder}
        onChange={debounceSearch}
      />

      <InputGroupAddon>
        <Icons.search />
      </InputGroupAddon>

      {hasTips && (
        <InputGroupAddon align='inline-end'>
          {/* //* opens on hover or keyboard focus, no click needed */}
          <HoverCard openDelay={150} closeDelay={100}>
            <HoverCardTrigger asChild>
              <InputGroupButton size='icon-xs' aria-label='Search tips'>
                <Icons.info />
              </InputGroupButton>
            </HoverCardTrigger>
            <HoverCardContent align='end' className='flex w-80 flex-col gap-2.5'>
              <span className='font-medium'>Search tips</span>
              <ul className='text-muted-foreground flex list-disc flex-col gap-1.5 pl-4 text-sm'>
                {isServerSearch && GENERAL_SEARCH_TIPS}
                {tips}
              </ul>
            </HoverCardContent>
          </HoverCard>
        </InputGroupAddon>
      )}
    </InputGroup>
  )
}
