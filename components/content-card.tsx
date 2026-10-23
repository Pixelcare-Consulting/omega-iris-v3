import * as React from 'react'

import { cn } from '@/lib/utils'
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card'
import { Skeleton } from './ui/skeleton'
import { Icons } from './icons'

type ContentCardProps = {
  title?: React.ReactNode
  description?: React.ReactNode
  icon?: keyof typeof Icons
  //* top-right slot, buttons, dropdowns, a date-range picker
  action?: React.ReactNode
  footer?: React.ReactNode
  //* opt-in divider under the header, heavier than the shadcn default, use it for dashboard panels
  hasHeaderBorder?: boolean
  isLoading?: boolean
  //* skeleton height while isLoading, match the real content so the card doesn't jump
  loadingClassName?: string
  size?: 'default' | 'sm'
  className?: string
  headerClassName?: string
  contentClassName?: string
  footerClassName?: string
  children?: React.ReactNode
}

export default function ContentCard({
  title,
  description,
  icon,
  action,
  footer,
  hasHeaderBorder,
  isLoading,
  loadingClassName,
  size = 'default',
  className,
  headerClassName,
  contentClassName,
  footerClassName,
  children
}: ContentCardProps) {
  const Icon = icon ? Icons[icon] : null
  const hasHeader = Boolean(title || description || action || Icon)

  return (
    <Card size={size} className={className}>
      {hasHeader && (
        <CardHeader className={cn(hasHeaderBorder && 'border-b', headerClassName)}>
          {title && (
            <CardTitle className='flex items-center gap-2'>
              {Icon && <Icon className='text-muted-foreground size-4 shrink-0' />}
              {title}
            </CardTitle>
          )}

          {description && <CardDescription>{description}</CardDescription>}
          {action && <CardAction>{action}</CardAction>}
        </CardHeader>
      )}

      <CardContent className={cn('flex-1', contentClassName)}>
        {isLoading ? <Skeleton className={cn('h-40 w-full', loadingClassName)} /> : children}
      </CardContent>

      {footer && <CardFooter className={footerClassName}>{footer}</CardFooter>}
    </Card>
  )
}
