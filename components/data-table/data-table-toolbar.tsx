'use client'

import { cn } from '@/lib/utils'

type DataTableToolbarProps = React.HTMLAttributes<HTMLDivElement>

export default function DataTableToolbar({ className, children, ...props }: DataTableToolbarProps) {
  return (
    <div className={cn('flex flex-col justify-between gap-1.5 p-1 lg:flex-row lg:items-center', className)} {...props}>
      {children}
    </div>
  )
}
