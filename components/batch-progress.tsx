import { Progress } from '@/components/ui/progress'
import { BatchStats } from '@/types/batch'

type BatchProgressProps = { stats: BatchStats; succeededLabel: string; preparingLabel?: string }

export default function BatchProgress({ stats, succeededLabel, preparingLabel = 'Preparing…' }: BatchProgressProps) {
  return (
    <div className='flex flex-col gap-2'>
      <div className='flex items-center justify-between text-sm'>
        {/* //* total stays 0 until the first step knows it */}
        <span>{stats.total === 0 ? preparingLabel : `Processing ${stats.processed} of ${stats.total}`}</span>
        <span className='font-medium'>{stats.progress}%</span>
      </div>

      {/* //* no fill animation, the bar matches the percentage right away */}
      <Progress value={stats.progress} className='[&_[data-slot=progress-indicator]]:transition-none' />

      <div className='text-muted-foreground flex gap-4 text-xs'>
        <span>
          {succeededLabel}: {stats.succeeded}
        </span>
        <span>Errors: {stats.errors.length}</span>
      </div>
    </div>
  )
}
