import { cn } from '@/lib/utils'
import { Icons } from './icons'

type ReadOnlyFieldProps = {
  className?: string
  title?: string
  value?: React.ReactNode
  isLoading?: boolean
  description?: string
  children?: React.ReactNode
}

export default function ReadOnlyField({ className, title, value, isLoading, description, children }: ReadOnlyFieldProps) {
  return (
    <div className={cn('flex flex-col justify-start gap-2', className)}>
      <h2 className='text-sm font-medium'>{title}:</h2>
      <span className='bg-muted inline-flex h-full min-h-8.5 flex-wrap items-center justify-between rounded px-2.5 text-sm'>
        {!isLoading && value}

        {isLoading && (
          <div className='flex w-full items-center justify-between'>
            <span className='text-muted-foreground'>Loading...</span>
            <Icons.spinner className='size-4 animate-spin' />
          </div>
        )}

        {(!isLoading && children) ?? null}
      </span>
      <span className='text-muted-foreground text-xs'>{description}</span>
    </div>
  )
}
