'use client'

import { Icons } from '@/components/icons'
import { cn } from '@/lib/utils'

type UnderDevelopmentProps = {
  title?: string
  description?: string
  className?: string
}

export default function UnderDevelopment({
  title = 'Under Development',
  description = 'This feature is under development.',
  className
}: UnderDevelopmentProps) {
  return (
    <div className={cn('flex h-full items-center justify-center', className)}>
      <div className='flex flex-col items-center justify-center'>
        <Icons.construction className='text-primary size-14' />
        <div className='mt-2.5 flex flex-col items-center justify-center gap-1'>
          <h1 className='text-primary text-center text-xl font-bold'>{title || 'Under Development'}</h1>
          <p className='text-center text-sm text-neutral-500 dark:text-neutral-400'>
            {description || 'This feature is under development.'}
          </p>
        </div>
      </div>
    </div>
  )
}
