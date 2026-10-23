import Link from 'next/link'

import { cn } from '@/lib/utils'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from './ui/card'
import { Skeleton } from './ui/skeleton'
import { Icons } from './icons'

export type StatCardTrend = {
  //* signed percentage, 12.5 renders as "▲ 12.5%", -3 as "▼ 3%", 0 as a neutral dash
  value: number
  //* qualifier shown next to the percentage, e.g. 'vs last month'
  label?: string
  //! set to false where a rise is bad (overdue loans, rejected requests), the card colours them green otherwise
  isGoodWhenUp?: boolean
}

type StatCardProps = {
  title: string
  value: string | number
  icon?: keyof typeof Icons
  description?: string
  trend?: StatCardTrend
  //* renders the whole card as a link, for drilling into the underlying list page
  href?: string
  isLoading?: boolean
  className?: string
}

export default function StatCard({ title, value, icon, description, trend, href, isLoading, className }: StatCardProps) {
  const Icon = icon ? Icons[icon] : null

  const direction = trend ? Math.sign(trend.value) : 0
  const isGoodWhenUp = trend?.isGoodWhenUp ?? true
  const isGood = direction > 0 ? isGoodWhenUp : !isGoodWhenUp

  const TrendIcon = direction === 0 ? Icons.minus : direction > 0 ? Icons.arrowUp : Icons.arrowDown

  //* the theme preset has no success token, so the "good" colour lives here rather than as an ad-hoc global token
  const trendClassName = direction === 0 ? 'text-muted-foreground' : isGood ? 'text-emerald-600 dark:text-emerald-500' : 'text-destructive'

  const card = (
    <Card className={cn('gap-2', href && 'hover:bg-accent/50 transition-colors', className)}>
      <CardHeader>
        <CardTitle className='text-muted-foreground text-sm font-medium'>{title}</CardTitle>

        {Icon && (
          <CardAction>
            <Icon className='text-muted-foreground size-4' />
          </CardAction>
        )}
      </CardHeader>

      <CardContent className='flex flex-col gap-1.5'>
        {isLoading ? (
          <>
            <Skeleton className='h-8 w-24' />
            {(trend || description) && <Skeleton className='h-4 w-32' />}
          </>
        ) : (
          <>
            <div className='text-2xl leading-none font-semibold tabular-nums'>{value}</div>

            {trend && (
              <div className='flex flex-wrap items-center gap-1 text-xs'>
                <span className={cn('inline-flex items-center gap-0.5 font-medium', trendClassName)}>
                  <TrendIcon className='size-3.5' />
                  {Math.abs(trend.value)}%
                </span>

                {trend.label && <span className='text-muted-foreground'>{trend.label}</span>}
              </div>
            )}

            {description && <p className='text-muted-foreground text-xs'>{description}</p>}
          </>
        )}
      </CardContent>
    </Card>
  )

  if (!href) return card

  return (
    <Link href={href} className='focus-visible:ring-ring block rounded-xl focus-visible:ring-2 focus-visible:outline-none'>
      {card}
    </Link>
  )
}
