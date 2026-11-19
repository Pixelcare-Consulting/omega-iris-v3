import { cn } from '@/lib/utils'
import { ACTIVITY_TONE_LABELS } from '@/constants/activity-log'
import { ACTIVITY_TONE_STYLES } from './activity-tone'
import type { ActivityTone } from '@/types/activity-log'

const TONES: ActivityTone[] = ['green', 'blue', 'red', 'gray']

//* centered on its own row on small screens, pushed right from lg up, same as the page headers
export default function ActivityLegend({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'text-muted-foreground flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs lg:ml-auto lg:w-auto lg:justify-end',
        className
      )}
    >
      {TONES.map((tone) => (
        <span key={tone} className='inline-flex items-center gap-1.5'>
          <span className={cn('size-2.5 rounded-full', ACTIVITY_TONE_STYLES[tone].dot)} />
          {ACTIVITY_TONE_LABELS[tone]}
        </span>
      ))}
    </div>
  )
}
