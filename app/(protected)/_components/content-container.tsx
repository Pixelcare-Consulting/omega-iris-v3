import { cn } from '@/lib/utils'

type ContentContainerProps = { className?: string; children: React.ReactNode }

//* fills the layout's content slot, pass overflow-y-auto to let a page scroll itself
export default function ContentContainer({ className, children }: ContentContainerProps) {
  return <div className={cn('h-full space-y-5 px-8 py-4', className)}>{children}</div>
}
