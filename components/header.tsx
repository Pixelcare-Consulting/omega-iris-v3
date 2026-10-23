import { cn } from '@/lib/utils'
import { BarLoader } from 'react-spinners'

type PageHeaderProps = {
  isLoading?: boolean
  className?: string
  title?: string
  titleClassName?: string
  description?: string
  descriptionClassName?: string
  children?: React.ReactNode
  badge?: React.ReactNode
}

export default function Header({
  isLoading,
  className,
  title,
  titleClassName,
  description,
  descriptionClassName,
  children,
  badge
}: PageHeaderProps) {
  return (
    <header className={cn('flex flex-wrap items-center gap-y-2 rounded-md border bg-white px-4 py-3 shadow-xs', className)}>
      {/* //* skipped when the page brings its own heading, so it takes no space */}
      {(title || description) && (
        <div className='hidden max-w-2xl flex-1 lg:inline-block'>
          <h1
            className={cn('flex items-center gap-2 text-base font-bold tracking-tight sm:text-lg md:text-lg lg:text-left', titleClassName)}
          >
            {title} {badge}
          </h1>
          <div className={cn('line-clamp-1 text-neutral-500 md:text-sm lg:text-left', descriptionClassName)}>{description}</div>
        </div>
      )}

      {children}

      {isLoading && (
        <div className='flex h-5 items-center'>
          <BarLoader className='mt-1' color='#ed1c24' width='100%' />
        </div>
      )}
    </header>
  )
}
