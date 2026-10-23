'use client'

import React from 'react'

import { cn } from '@/lib/utils'

type DataTableContainerProps = React.ComponentPropsWithoutRef<'div'>

export default function DataTableContainer({ children, className, ...props }: DataTableContainerProps) {
  return (
    <div className={cn('flex min-h-0 w-full flex-1 flex-col gap-2.5 overflow-auto', className)} {...props}>
      {children}
    </div>
  )
}
