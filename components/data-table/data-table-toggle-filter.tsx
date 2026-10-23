'use client'

import { Fragment } from 'react'

import { Button } from '../ui/button'
import { Separator } from '../ui/separator'
import { Icons } from '../icons'

type DataTableToggleFilterProps<T extends string> = {
  groups: { value: T; label: string }[][]
  value: T[]
  onValueChange: (value: T[]) => void
  isLoading?: boolean
}

//* a row of on/off buttons, groups are split by a separator
export default function DataTableToggleFilter<T extends string>({
  groups,
  value,
  onValueChange,
  isLoading
}: DataTableToggleFilterProps<T>) {
  const handleToggle = (option: T) => {
    onValueChange(value.includes(option) ? value.filter((v) => v !== option) : [...value, option])
  }

  return (
    <div className='flex flex-wrap items-center gap-2 p-1'>
      {groups.map((group, index) => (
        <Fragment key={index}>
          {index > 0 && <Separator orientation='vertical' className='h-6!' />}

          {group.map((option) => {
            const isActive = value.includes(option.value)

            return (
              <Button
                key={option.value}
                type='button'
                size='sm'
                variant={isActive ? 'default' : 'outline'}
                aria-pressed={isActive}
                disabled={isLoading}
                onClick={() => handleToggle(option.value)}
              >
                {isActive ? <Icons.check /> : null}
                {option.label}
              </Button>
            )
          })}
        </Fragment>
      ))}
    </div>
  )
}
