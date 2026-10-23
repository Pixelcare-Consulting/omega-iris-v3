import { cn } from '@/lib/utils'

type AsteriskRequiredProps = { className?: string }

export default function AsteriskRequired({ className }: AsteriskRequiredProps) {
  return <span className={cn('text-destructive', className)}>*</span>
}
