import { cn, copyText } from '@/lib/utils'
import { IconProps, Icons } from './icons'

type CopyProps = IconProps & { value: string | number | boolean | null | undefined | Record<string, any> }

export default function Copy({ value, ...props }: CopyProps) {
  return (
    <Icons.copy
      {...props}
      className={cn('hover:text-primary size-4.5 cursor-pointer text-xl text-neutral-400', props.className)}
      onClick={copyText(String(value))}
    />
  )
}
