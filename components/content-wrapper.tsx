import { cn } from '@/lib/utils'

type ContentWrapperProps = { className?: string; children: React.ReactNode }

//? add h-full w-full for full width and height
export default function ContentWrapper({ className, children }: ContentWrapperProps) {
  return <div className={cn('flex min-h-0 flex-1 rounded-md border bg-white p-4 shadow-xs', className)}>{children}</div>
}
