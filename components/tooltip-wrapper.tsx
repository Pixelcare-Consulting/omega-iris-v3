import { Tooltip, TooltipContent, ToolTipContentProps, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

type TooltipWrapperProps = ToolTipContentProps & {
  label: string | React.ReactNode
  children: React.ReactNode & { asChild?: boolean }
  delayDuration?: number
  labelClassName?: string
}

export function TooltipWrapper({ label, labelClassName, children, delayDuration = 500, ...props }: TooltipWrapperProps) {
  function renderLabel(label: string | React.ReactNode) {
    if (typeof label === 'string') return <p className={cn('text-sm font-medium', labelClassName)}>{label}</p>
    return label
  }

  return (
    <Tooltip delayDuration={delayDuration}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent {...props}>{renderLabel(label)}</TooltipContent>
    </Tooltip>
  )
}
