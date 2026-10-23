import { cn } from '@/lib/utils'

type RowProps = {
  children: React.ReactNode
  cols?: number
  gap?: number
  className?: string
}

const COLS_MAP: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
  7: 'grid-cols-7',
  8: 'grid-cols-8',
  9: 'grid-cols-9',
  10: 'grid-cols-10',
  11: 'grid-cols-11',
  12: 'grid-cols-12'
}

const GAP_MAP: Record<number, string> = {
  0: 'gap-0',
  1: 'gap-1',
  2: 'gap-2',
  3: 'gap-3',
  4: 'gap-4',
  5: 'gap-5',
  6: 'gap-6',
  7: 'gap-7',
  8: 'gap-8',
  10: 'gap-10',
  12: 'gap-12'
}

export function Row({ children, cols = 12, gap = 4, className = '' }: RowProps) {
  return <div className={cn(`grid h-full content-start ${COLS_MAP[cols]} ${GAP_MAP[gap]} ${className}`)}>{children}</div>
}
