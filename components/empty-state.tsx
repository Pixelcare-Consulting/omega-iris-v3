import { Icons } from '@/components/icons'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { cn } from '@/lib/utils'

type EmptyStateProps = {
  title: string
  description?: string
  icon?: React.ReactNode
  className?: string
  contentClassName?: string
  style?: React.CSSProperties
  children?: React.ReactNode //* buttons or links, sits under the header
}

export default function EmptyState({ title, description, icon, className, contentClassName, style, children }: EmptyStateProps) {
  return (
    <Empty style={style} className={cn('h-full min-h-80', className)}>
      <EmptyHeader className='gap-0.5'>
        <EmptyMedia variant='icon'>{icon ?? <Icons.folderOpen />}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>

      {children && <EmptyContent className={contentClassName}>{children}</EmptyContent>}
    </Empty>
  )
}
