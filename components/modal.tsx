'use client'

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogPortal, DialogTitle, DialogTrigger } from './ui/dialog'
import { cn } from '@/lib/utils'

type ExtendedProps = {
  dialogProps?: Omit<React.ComponentPropsWithRef<typeof Dialog>, 'open' | 'onOpenChange'>
  dialogTriggerProps?: Omit<React.ComponentPropsWithRef<typeof DialogTrigger>, 'asChild'>
  dialogContentProps?: Omit<React.ComponentPropsWithRef<typeof DialogContent>, 'showCloseButton'>
  dialogHeaderProps?: React.ComponentPropsWithRef<typeof DialogHeader>
  dialogTitleProps?: React.ComponentPropsWithRef<typeof DialogTitle>
  dialogDescriptionProps?: React.ComponentPropsWithRef<typeof DialogDescription>
  dialogFooterProps?: React.ComponentPropsWithRef<typeof DialogFooter>
}

//* popups that mount to the body instead of inside the dialog
const PORTALLED_POPUP_SELECTOR = "[data-slot='combobox-content'],[role='listbox'],[data-slot='popover-content']"

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'

//* `sm:max-w-sm` is the shadcn default, so most modals need a wider one
const MODAL_SIZES: Record<ModalSize, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
  full: 'sm:max-w-[calc(100%-4rem)]'
}

type ModalProps = {
  isOpen?: boolean
  title?: string
  description?: string
  badge?: React.ReactNode
  size?: ModalSize
  trigger?: React.ReactNode
  footer?: React.ReactNode
  isHideCloseButton?: boolean
  isModal?: boolean
  isCloseOnOutsideClick?: boolean
  isCloseOnEscape?: boolean
  children?: React.ReactNode
  onOpenChange?: (isOpen: boolean) => void
  onClose?: () => void
  extendedProps?: ExtendedProps
}

export default function Modal({
  isOpen,
  title,
  description,
  badge,
  size = 'md',
  trigger,
  footer,
  isHideCloseButton,
  isModal = true,
  isCloseOnOutsideClick = true,
  isCloseOnEscape = true,
  children,
  onOpenChange,
  onClose,
  extendedProps
}: ModalProps) {
  const handleOpenChange = (open: boolean) => {
    onOpenChange?.(open)
    if (!open) onClose?.()
  }

  const handleInteractOutside: React.ComponentProps<typeof DialogContent>['onInteractOutside'] = (event) => {
    if (!isCloseOnOutsideClick) {
      event.preventDefault()
      return
    }

    //* only reachable when `isModal` is off, a modal dialog blocks those clicks before they get here
    const target = event.target as HTMLElement | null

    if (target?.closest(PORTALLED_POPUP_SELECTOR)) event.preventDefault()
  }

  //! a closing dropdown hands focus back to its trigger, which would close a non-modal dialog it just opened
  const handleFocusOutside: React.ComponentProps<typeof DialogContent>['onFocusOutside'] = (event) => {
    if (!isModal) event.preventDefault()
  }

  const handleEscapeKeyDown: React.ComponentProps<typeof DialogContent>['onEscapeKeyDown'] = (event) => {
    if (!isCloseOnEscape) event.preventDefault()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange} modal={isModal} {...extendedProps?.dialogProps}>
      {trigger && (
        <DialogTrigger asChild {...extendedProps?.dialogTriggerProps}>
          {trigger}
        </DialogTrigger>
      )}

      {/* //! radix renders its overlay only in modal mode, so a non-modal dialog needs its own backdrop */}
      {!isModal && isOpen && (
        <DialogPortal>
          <div
            data-slot='dialog-overlay'
            className='animate-in fade-in-0 fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs'
          />
        </DialogPortal>
      )}

      <DialogContent
        showCloseButton={!isHideCloseButton}
        onInteractOutside={handleInteractOutside}
        onFocusOutside={handleFocusOutside}
        onEscapeKeyDown={handleEscapeKeyDown}
        {...extendedProps?.dialogContentProps}
        className={cn(MODAL_SIZES[size], 'p-6', extendedProps?.dialogContentProps?.className)}
      >
        {/* //! radix warns when the content has no title, so an untitled modal still gets a screen-reader-only one */}
        <DialogHeader
          {...extendedProps?.dialogHeaderProps}
          className={cn(!title && !description && 'sr-only', extendedProps?.dialogHeaderProps?.className)}
        >
          <DialogTitle
            {...extendedProps?.dialogTitleProps}
            className={cn(badge && 'flex items-center gap-2', extendedProps?.dialogTitleProps?.className)}
          >
            {title ?? 'Dialog'}
            {badge}
          </DialogTitle>
          {description && <DialogDescription {...extendedProps?.dialogDescriptionProps}>{description}</DialogDescription>}
        </DialogHeader>

        {children}

        {/* //! the footer bleeds to the edges with negative margins, so they have to match the content padding */}
        {footer && (
          <DialogFooter {...extendedProps?.dialogFooterProps} className={cn('-mx-6 -mb-6', extendedProps?.dialogFooterProps?.className)}>
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
