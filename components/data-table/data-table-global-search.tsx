'use client'

import { Table } from '@tanstack/react-table'
import { ChangeEvent, useEffect, useRef } from 'react'
import { useDebouncedCallback } from 'use-debounce'

import { Icons } from '../icons'
import { InputGroup, InputGroupAddon, InputGroupInput } from '../ui/input-group'
import { InputGroupInputProps, InputGroupProps } from '@/types/common'
import { cn } from '@/lib/utils'

type DataTableGlobalSearchProps<TData> = InputGroupProps & {
  table: Table<TData>
  delay?: number
  inputGroupInputProps?: InputGroupInputProps
  isLoading?: boolean
}

export default function DataTableGlobalSearch<TData>({
  table,
  delay = 700,
  inputGroupInputProps,
  isLoading,
  ...props
}: DataTableGlobalSearchProps<TData>) {
  const inputRef = useRef<HTMLInputElement>(null)
  const globalFilter = table.getState().globalFilter ?? ''

  const handleSearch = (e: ChangeEvent<HTMLInputElement>) => table.setGlobalFilter(e.target.value)

  const debounceSearch = useDebouncedCallback(handleSearch, delay)

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
        placeholder='Search...'
        onChange={debounceSearch}
      />

      <InputGroupAddon>
        <Icons.search />
      </InputGroupAddon>
    </InputGroup>
  )
}
