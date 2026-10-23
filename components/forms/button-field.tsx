import { ButtonProps, FormExtendedProps } from '@/types/common'
import { Field } from '../ui/field'
import { Button } from '../ui/button'
import { Icons } from '../icons'

type ExtendedProps = FormExtendedProps

type ButtonFieldProps = ButtonProps & { isLoading?: boolean; loadingText?: string; extendedProps?: ExtendedProps; isField?: boolean }

export default function LoadingButton({
  isLoading,
  loadingText = 'Saving',
  extendedProps,
  children,
  disabled,
  ref,
  isField,
  size,
  ...props
}: ButtonFieldProps) {
  if (isField) {
    return (
      <Field {...extendedProps?.fieldProps}>
        <Button ref={ref} disabled={disabled || isLoading} {...props}>
          {isLoading && <Icons.spinner className='size-4 animate-spin' />}
          {!isLoading && children}
          {isLoading && <span>{loadingText}...</span>}
        </Button>
      </Field>
    )
  }

  return (
    <Button ref={ref} disabled={disabled || isLoading} size={size} {...props}>
      {isLoading && <Icons.spinner className='size-4 animate-spin' />}
      {!isLoading && children}
      {isLoading && !size?.startsWith('icon') && <span>{loadingText}...</span>}
    </Button>
  )
}
