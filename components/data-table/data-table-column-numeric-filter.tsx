import { Column } from '@tanstack/react-table'
import { useState } from 'react'

import { NumericFilterValue, NumericOperator } from '@/types/data-table'
import { NUMERIC_OPERATORS } from '@/constants/data-table'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Icons } from '../icons'
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '../ui/command'
import { cn, safeParseFloat } from '@/lib/utils'
import { Input } from '../ui/input'
import LoadingButton from '../forms/button-field'

type Draft = { operator: NumericOperator; value: string; valueTo: string }
type DataTableNumericFilterProps<TData, TValue> = { column: Column<TData, TValue> | undefined; title: string; isLoading?: boolean }

const noInputOperators: NumericOperator[] = ['isEmpty', 'isNotEmpty']
const isBetweenOperator: NumericOperator = 'isBetween'
const defaultDraft: Draft = { operator: 'eq', value: '', valueTo: '' }

export default function DataTableColumnNumericFilter<TData, TValue>({
  column,
  title,
  isLoading
}: DataTableNumericFilterProps<TData, TValue>) {
  const filterValue = column?.getFilterValue() as NumericFilterValue | undefined

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(defaultDraft)

  const isNoInput = noInputOperators.includes(draft.operator)
  const isBetween = draft.operator === isBetweenOperator

  //* sync draft from filterValue when popover opens
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setDraft(
        filterValue
          ? { operator: filterValue.operator, value: filterValue.value?.toString() ?? '', valueTo: filterValue.valueTo?.toString() ?? '' }
          : defaultDraft
      )
    }
    setOpen(nextOpen)
  }

  const handleOperatorSelect = (op: NumericOperator) => {
    setDraft((prev) => ({
      ...prev,
      operator: op,
      ...(noInputOperators.includes(op) ? { value: '', valueTo: '' } : {})
    }))
  }

  const handleApply = () => {
    if (isNoInput) {
      column?.setFilterValue({ operator: draft.operator, value: null, valueTo: null } satisfies NumericFilterValue)
    } else if (isBetween) {
      const from = draft.value !== '' ? safeParseFloat(draft.value) : null
      const to = draft.valueTo !== '' ? safeParseFloat(draft.valueTo) : null
      if (from === null && to === null) return
      column?.setFilterValue({ operator: draft.operator, value: from, valueTo: to } satisfies NumericFilterValue)
    } else {
      if (draft.value === '') return
      column?.setFilterValue({ operator: draft.operator, value: safeParseFloat(draft.value), valueTo: null } satisfies NumericFilterValue)
    }
    setOpen(false)
  }

  const handleClear = () => {
    column?.setFilterValue(undefined)
    setOpen(false)
  }

  const isFiltered = filterValue !== undefined

  //* badge summary label, from the committed filterValue, not the draft
  const badgeLabel = isFiltered
    ? noInputOperators.includes(filterValue.operator)
      ? NUMERIC_OPERATORS.find((o) => o.value === filterValue.operator)?.label
      : filterValue.operator === isBetweenOperator
        ? `${NUMERIC_OPERATORS.find((o) => o.value === filterValue.operator)?.label}: ${filterValue.value ?? '?'} — ${filterValue.valueTo ?? '?'}`
        : `${NUMERIC_OPERATORS.find((o) => o.value === filterValue.operator)?.label}: ${filterValue.value}`
    : null

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <LoadingButton variant='outline' className='flex items-center gap-2' isLoading={isLoading} loadingText='Loading'>
          <span className='font-normal'>{title}</span>

          {isFiltered && (
            <Badge variant='secondary' className='rounded-sm px-1 font-normal'>
              {badgeLabel}
            </Badge>
          )}

          <Icons.upDown className='ml-auto h-4 w-4 shrink-0 opacity-50' />
        </LoadingButton>
      </PopoverTrigger>

      <PopoverContent className='w-72 p-0' align='start'>
        <Command>
          <CommandList>
            <CommandEmpty>No operators found.</CommandEmpty>

            {/* //* operator selector */}
            <CommandGroup heading='Operator'>
              {NUMERIC_OPERATORS.map((op) => (
                <CommandItem
                  key={op.value}
                  onSelect={() => handleOperatorSelect(op.value)}
                  className='flex cursor-pointer items-center gap-2'
                >
                  <div
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-neutral-500',
                      draft.operator === op.value ? 'bg-primary text-primary-foreground' : 'opacity-50'
                    )}
                  >
                    {draft.operator === op.value && <Icons.check className='h-2.5 w-2.5' />}
                  </div>
                  <span>{op.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>

            {/* //* value input, hidden for isEmpty and isNotEmpty */}
            {!isNoInput && (
              <CommandGroup heading='Value'>
                <div className='flex items-center gap-2 px-2 pb-2'>
                  {isBetween ? (
                    <>
                      <Input
                        type='number'
                        placeholder='From'
                        value={draft.value}
                        onChange={(e) => setDraft((prev) => ({ ...prev, value: e.target.value }))}
                        className='h-8'
                        step='any'
                      />
                      <span className='text-muted-foreground text-sm'>—</span>
                      <Input
                        type='number'
                        placeholder='To'
                        value={draft.valueTo}
                        onChange={(e) => setDraft((prev) => ({ ...prev, valueTo: e.target.value }))}
                        className='h-8'
                        step='any'
                      />
                    </>
                  ) : (
                    <Input
                      type='number'
                      placeholder='Enter value...'
                      value={draft.value}
                      onChange={(e) => setDraft((prev) => ({ ...prev, value: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && handleApply()}
                      className='h-8'
                      step='any'
                    />
                  )}
                </div>
              </CommandGroup>
            )}
          </CommandList>

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
        </Command>
      </PopoverContent>
    </Popover>
  )
}
