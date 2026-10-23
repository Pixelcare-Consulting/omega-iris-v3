'use client'

import { Column } from '@tanstack/react-table'
import { useState } from 'react'
import { format, parseISO, isValid } from 'date-fns'
import type { DateRange } from 'react-day-picker'

import { DateFilterValue, DateOperator, RelativeDirection, RelativeUnit } from '@/types/data-table'
import { DATE_OPERATORS, RELATIVE_UNITS, RELATIVE_DIRECTIONS } from '@/constants/data-table'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Icons } from '../icons'
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '../ui/command'
import { Input } from '../ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Calendar } from '../ui/calendar'
import { cn } from '@/lib/utils'
import LoadingButton from '../forms/button-field'

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '?'
  const d = parseISO(iso)
  return isValid(d) ? format(d, 'MMM d, yyyy') : '?'
}

function badgeSummary(fv: DateFilterValue): string {
  const op = DATE_OPERATORS.find((o) => o.value === fv.operator)?.label ?? fv.operator

  if (fv.operator === 'isEmpty' || fv.operator === 'isNotEmpty') return op

  if (fv.operator === 'isBetween') return `${op}: ${fmtDate(fv.value)} — ${fmtDate(fv.valueTo)}`

  if (fv.operator === 'isRelativeToToday' && fv.relative) {
    const { amount, unit, direction } = fv.relative
    return `${op}: ${amount} ${unit} ${direction}`
  }

  return `${op}: ${fmtDate(fv.value)}`
}

type DataTableColumnDateFilterProps<TData, TValue> = { column: Column<TData, TValue> | undefined; title: string; isLoading?: boolean }

type Draft = {
  operator: DateOperator
  value: Date | undefined
  valueTo: Date | undefined
  relAmount: string
  relUnit: RelativeUnit
  relDirection: RelativeDirection
}

const noInputOperators: DateOperator[] = ['isEmpty', 'isNotEmpty']

const defaultDraft: Draft = {
  operator: 'eq',
  value: undefined,
  valueTo: undefined,
  relAmount: '7',
  relUnit: 'days',
  relDirection: 'past'
}

export default function DataTableColumnDateFilter<TData, TValue>({
  column,
  title,
  isLoading
}: DataTableColumnDateFilterProps<TData, TValue>) {
  const filterValue = column?.getFilterValue() as DateFilterValue | undefined

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(defaultDraft)

  const isNoInput = noInputOperators.includes(draft.operator)
  const isBetween = draft.operator === 'isBetween'
  const isRelative = draft.operator === 'isRelativeToToday'

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      if (filterValue) {
        const parseDate = (iso: string | null | undefined) => {
          if (!iso) return undefined
          const d = parseISO(iso)
          return isValid(d) ? d : undefined
        }
        setDraft({
          operator: filterValue.operator,
          value: 'value' in filterValue ? parseDate(filterValue.value) : undefined,
          valueTo: 'valueTo' in filterValue ? parseDate(filterValue.valueTo) : undefined,
          relAmount: filterValue.operator === 'isRelativeToToday' && filterValue.relative ? String(filterValue.relative.amount) : '7',
          relUnit: filterValue.operator === 'isRelativeToToday' && filterValue.relative ? filterValue.relative.unit : 'days',
          relDirection: filterValue.operator === 'isRelativeToToday' && filterValue.relative ? filterValue.relative.direction : 'past'
        })
      } else {
        setDraft(defaultDraft)
      }
    }
    setOpen(nextOpen)
  }

  const handleOperatorSelect = (op: DateOperator) => {
    setDraft((prev) => ({
      ...prev,
      operator: op,
      ...(noInputOperators.includes(op) ? { value: undefined, valueTo: undefined } : {})
    }))
  }

  const handleApply = () => {
    const toISO = (d: Date | undefined) => (d ? format(d, 'yyyy-MM-dd') : null)

    if (isNoInput) {
      column?.setFilterValue({
        operator: draft.operator as 'isEmpty' | 'isNotEmpty',
        value: null,
        valueTo: null,
        relative: null
      } satisfies DateFilterValue)
    } else if (isBetween) {
      if (!draft.value && !draft.valueTo) return
      column?.setFilterValue({
        operator: 'isBetween',
        value: toISO(draft.value),
        valueTo: toISO(draft.valueTo),
        relative: null
      } satisfies DateFilterValue)
    } else if (isRelative) {
      const amount = parseInt(draft.relAmount, 10)
      if (!amount || amount <= 0) return
      column?.setFilterValue({
        operator: 'isRelativeToToday',
        value: null,
        valueTo: null,
        relative: { amount, unit: draft.relUnit, direction: draft.relDirection }
      } satisfies DateFilterValue)
    } else {
      if (!draft.value) return
      column?.setFilterValue({
        operator: draft.operator as Exclude<DateOperator, 'isEmpty' | 'isNotEmpty' | 'isBetween' | 'isRelativeToToday'>,
        value: toISO(draft.value),
        valueTo: null,
        relative: null
      } satisfies DateFilterValue)
    }
    setOpen(false)
  }

  const handleClear = () => {
    column?.setFilterValue(undefined)
    setOpen(false)
  }

  const isFiltered = filterValue !== undefined

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <LoadingButton variant='outline' className='flex items-center gap-2' isLoading={isLoading} loadingText='Loading'>
          <span className='font-normal'>{title}</span>
          {isFiltered && (
            <Badge variant='secondary' className='rounded-sm px-1 font-normal'>
              {badgeSummary(filterValue)}
            </Badge>
          )}
          <Icons.upDown className='ml-auto h-4 w-4 shrink-0 opacity-50' />
        </LoadingButton>
      </PopoverTrigger>

      <PopoverContent className={cn('p-0', isBetween ? 'w-auto' : 'w-72')} align='start'>
        <Command>
          <CommandList>
            <CommandEmpty>No operators found.</CommandEmpty>

            {/* //* operator selector */}
            <CommandGroup heading='Operator'>
              {DATE_OPERATORS.map((op) => (
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

            {/* //* value input */}
            {!isNoInput && (
              <CommandGroup heading='Value'>
                <div className='px-1 pb-2'>
                  {isBetween ? (
                    //* two-month range picker
                    <Calendar
                      className='w-full'
                      mode='range'
                      captionLayout='dropdown'
                      numberOfMonths={2}
                      defaultMonth={draft.valueTo ? new Date(draft.valueTo) : new Date()}
                      selected={draft.valueTo || draft.valueTo ? { from: draft.value, to: draft.valueTo } : undefined}
                      onSelect={(range: DateRange | undefined) => {
                        setDraft((prev) => ({
                          ...prev,
                          value: range?.from,
                          valueTo: range?.to
                        }))
                      }}
                    />
                  ) : isRelative ? (
                    //* relative picker, amount, unit and direction
                    <div className='flex flex-col gap-2 px-1 pt-1'>
                      <div className='flex items-center gap-2'>
                        <Input
                          type='number'
                          min={1}
                          placeholder='Amount'
                          value={draft.relAmount}
                          onChange={(e) => setDraft((p) => ({ ...p, relAmount: e.target.value }))}
                          className='h-8 w-20'
                        />
                        <Select value={draft.relUnit} onValueChange={(v) => setDraft((p) => ({ ...p, relUnit: v as RelativeUnit }))}>
                          <SelectTrigger className='h-8 flex-1'>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {RELATIVE_UNITS.map((u) => (
                              <SelectItem key={u.value} value={u.value}>
                                {u.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Select
                        value={draft.relDirection}
                        onValueChange={(v) => setDraft((p) => ({ ...p, relDirection: v as RelativeDirection }))}
                      >
                        <SelectTrigger className='h-8 w-full'>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RELATIVE_DIRECTIONS.map((d) => (
                            <SelectItem key={d.value} value={d.value}>
                              {d.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    //* single-day picker
                    <Calendar
                      className='w-full'
                      mode='single'
                      captionLayout='dropdown'
                      defaultMonth={draft.value ? new Date(draft.value) : new Date()}
                      selected={draft.value}
                      onSelect={(day) => setDraft((prev) => ({ ...prev, value: day }))}
                    />
                  )}
                </div>
              </CommandGroup>
            )}
          </CommandList>

          {/* //* footer */}
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
