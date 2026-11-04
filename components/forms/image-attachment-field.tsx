'use client'

import { DragEvent, KeyboardEvent, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { FieldPath, FieldValues, useController, useFormContext } from 'react-hook-form'
import { formatBytes } from 'bytes-formatter'
import { toast } from 'sonner'

import { Field, FieldDescription, FieldError, FieldLabel } from '../ui/field'
import { Button } from '../ui/button'
import { Icons } from '../icons'
import { TooltipWrapper } from '../tooltip-wrapper'
import { buildFileAttachmentUrl } from '@/lib/file-attachment'
import { cn } from '@/lib/utils'
import { StagedImagesContext } from '@/contexts/staged-images'
import { useFileAttachmentById } from '@/hooks/safe-actions/file-attachment'
import { FILE_ATTACHMENT_IMAGE_TYPES, FILE_ATTACHMENT_MAX_SIZE_MB } from '@/constants/file-attachment'

//* inline: slim row, dropzone: wide dashed box, tile: square preview
type ImageAttachmentFieldVariant = 'inline' | 'dropzone' | 'tile'

type ImageAttachmentFieldProps<T extends FieldValues> = {
  name: FieldPath<T>
  label?: string
  description?: string
  variant?: ImageAttachmentFieldVariant
  isRequired?: boolean
  isDisabled?: boolean
  isHideLabel?: boolean
  //* shown in a tooltip on an info icon beside the label, e.g. the recommended size
  hint?: string
  //* defaults to every image type uploads allow
  acceptedTypes?: string[]
  acceptedLabel?: string
  className?: string
}

const MAX_SIZE_BYTES = FILE_ATTACHMENT_MAX_SIZE_MB * 1024 * 1024

//* 'image/jpeg' reads as JPEG
const toTypeLabel = (types: string[]) => types.map((type) => type.split('/')[1].toUpperCase()).join(', ')

//* the field value is the saved attachment id
//* a picked file waits in StagedImagesContext until the form saves
export default function ImageAttachmentField<T extends FieldValues>({
  name,
  label = 'Image',
  description,
  variant = 'inline',
  isRequired,
  isDisabled,
  isHideLabel,
  hint,
  acceptedTypes = FILE_ATTACHMENT_IMAGE_TYPES,
  acceptedLabel = 'a PNG, JPEG, or WebP image',
  className
}: ImageAttachmentFieldProps<T>) {
  const { control } = useFormContext<T>()
  const { field, fieldState } = useController({ name, control })
  const stagedImages = useContext(StagedImagesContext)

  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [brokenId, setBrokenId] = useState<string | null>(null)

  const id: string | null = field.value ?? null
  const stagedFile = stagedImages?.files[name] ?? null
  const progress = stagedImages?.progress[name]
  const isUploading = progress !== undefined

  //* the saved file's name and size
  const fileAttachment = useFileAttachmentById(stagedFile ? null : id)
  const fileMeta = fileAttachment.data?.id === id ? fileAttachment.data : null
  const isMissing = brokenId === id || (!fileAttachment.isLoading && fileAttachment.data === null && !!id)

  const stagedUrl = useMemo(() => (stagedFile ? URL.createObjectURL(stagedFile) : null), [stagedFile])

  useEffect(() => {
    return () => {
      if (stagedUrl) URL.revokeObjectURL(stagedUrl)
    }
  }, [stagedUrl])

  //* what the field shows right now, a staged file wins over the saved one
  const preview = stagedFile
    ? { src: stagedUrl, name: stagedFile.name, size: stagedFile.size, type: stagedFile.type }
    : id
      ? {
          src: isMissing ? null : buildFileAttachmentUrl(id),
          name: isMissing ? 'Image not found' : (fileMeta?.originalName ?? 'Loading...'),
          size: fileMeta?.size ?? null,
          type: fileMeta?.mimeType ?? null
        }
      : null

  const sizeLabel = `${toTypeLabel(acceptedTypes)}, up to ${FILE_ATTACHMENT_MAX_SIZE_MB}MB`

  const openPicker = () => {
    if (!isDisabled && !isUploading) inputRef.current?.click()
  }

  const handleFile = (file?: File) => {
    if (!file || isDisabled || isUploading) return

    //* checked again on the server, this only saves a wasted upload
    if (!acceptedTypes.includes(file.type)) return toast.error(`Choose ${acceptedLabel}`)
    if (file.size > MAX_SIZE_BYTES) return toast.error(`Image must be ${FILE_ATTACHMENT_MAX_SIZE_MB}MB or less`)

    stagedImages?.onStage(name, file)
  }

  const handleRemove = () => {
    stagedImages?.onStage(name, null)
    field.onChange(null)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragOver(false)
    handleFile(event.dataTransfer.files?.[0])
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (!isDisabled) setIsDragOver(true)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openPicker()
    }
  }

  //* drop target props shared by every empty state
  const dropProps = {
    role: 'button',
    tabIndex: isDisabled ? -1 : 0,
    'aria-disabled': isDisabled,
    onClick: openPicker,
    onKeyDown: handleKeyDown,
    onDragOver: handleDragOver,
    onDragLeave: () => setIsDragOver(false),
    onDrop: handleDrop
  }

  const dropClassName = cn(
    'transition-colors',
    isDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
    isDragOver && 'border-primary bg-primary/5'
  )

  const renderMeta = () => {
    if (!preview) return null

    if (stagedFile && isUploading) {
      return (
        <div className='flex flex-col gap-1'>
          <div className='bg-muted h-1 overflow-hidden rounded-full'>
            <div className='bg-primary h-full transition-[width]' style={{ width: `${progress}%` }} />
          </div>
          <span className='text-muted-foreground text-xs'>
            {progress}% of {formatBytes(stagedFile.size)}
          </span>
        </div>
      )
    }

    if (preview.size === null || !preview.type) return null

    return (
      <span className='text-muted-foreground text-xs'>
        {formatBytes(preview.size)} · {toTypeLabel([preview.type])}
      </span>
    )
  }

  const renderActions = (buttonVariant: 'outline' | 'secondary' = 'outline') =>
    !isDisabled && (
      <div className='flex shrink-0 items-center gap-1'>
        <TooltipWrapper label='Replace'>
          <Button type='button' variant={buttonVariant} size='icon' disabled={isUploading} onClick={openPicker}>
            <Icons.upload />
          </Button>
        </TooltipWrapper>

        <TooltipWrapper label='Remove'>
          <Button
            type='button'
            variant={buttonVariant}
            size='icon'
            className='text-destructive'
            disabled={isUploading}
            onClick={handleRemove}
          >
            <Icons.trash />
          </Button>
        </TooltipWrapper>
      </div>
    )

  const renderImage = (className: string, iconClassName = 'size-5') =>
    preview?.src ? (
      <img src={preview.src} alt={label} className={className} onError={() => id && setBrokenId(id)} />
    ) : (
      <Icons.image className={cn('text-muted-foreground', iconClassName)} />
    )

  //* slim row, the original look
  const renderInline = () =>
    preview ? (
      <div className='flex items-center gap-3 rounded-lg border p-2'>
        <div className='bg-muted/50 flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md border'>
          {renderImage('size-9 object-contain')}
        </div>

        <div className='flex min-w-0 flex-1 flex-col gap-1'>
          <span className='truncate text-sm font-medium'>{preview.name}</span>
          {renderMeta()}
        </div>

        {renderActions()}
      </div>
    ) : (
      <div
        {...dropProps}
        className={cn('bg-muted/30 hover:bg-muted/60 flex items-center gap-3 rounded-lg border border-dashed p-2', dropClassName)}
      >
        <div className='bg-background flex size-11 shrink-0 items-center justify-center rounded-md border'>
          <Icons.upload className='text-muted-foreground size-5' />
        </div>

        <div className='flex min-w-0 flex-col'>
          <span className='text-sm font-medium'>
            {isDisabled ? (
              'No image'
            ) : (
              <>
                Drop an image or <span className='text-primary underline underline-offset-2'>browse</span>
              </>
            )}
          </span>
          <span className='text-muted-foreground text-xs'>{sizeLabel}</span>
        </div>
      </div>
    )

  //* wide dashed box with a centered prompt
  const renderDropzone = () =>
    preview ? (
      <div className='flex flex-col items-center gap-3 rounded-lg border p-4 sm:flex-row'>
        <div className='bg-muted/50 flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-md border'>
          {renderImage('size-full object-contain', 'size-8')}
        </div>

        <div className='flex w-full min-w-0 flex-1 flex-col gap-1'>
          <span className='truncate text-sm font-medium'>{preview.name}</span>
          {renderMeta()}
        </div>

        {renderActions()}
      </div>
    ) : (
      <div
        {...dropProps}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center',
          dropClassName
        )}
      >
        <div className='bg-background flex size-12 items-center justify-center rounded-full border'>
          <Icons.image className='text-muted-foreground size-6' />
        </div>

        <span className='text-sm font-medium'>{isDisabled ? 'No image' : 'Drag & drop an image here'}</span>

        {!isDisabled && (
          <>
            <span className='text-muted-foreground text-xs'>Or click to browse ({sizeLabel})</span>
            <Button type='button' variant='outline' size='sm' className='mt-2' tabIndex={-1}>
              Browse image
            </Button>
          </>
        )}
      </div>
    )

  //* square preview, actions float over the image
  const renderTile = () =>
    preview ? (
      <div className='group bg-muted/50 relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border'>
        {renderImage('size-full object-contain', 'size-10')}

        <div className='absolute top-2 right-2 opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100'>
          {renderActions('secondary')}
        </div>

        <div className='bg-background/90 absolute inset-x-0 bottom-0 flex flex-col gap-1 border-t px-3 py-2'>
          <span className='truncate text-xs font-medium'>{preview.name}</span>
          {renderMeta()}
        </div>
      </div>
    ) : (
      <div
        {...dropProps}
        className={cn(
          'bg-muted/50 flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed',
          dropClassName
        )}
      >
        {isDisabled ? (
          <span className='text-muted-foreground text-sm'>No image</span>
        ) : (
          <>
            <Button type='button' variant='outline' size='sm' tabIndex={-1}>
              Select a file
            </Button>
            <span className='text-muted-foreground text-sm'>or drop a file here</span>
          </>
        )}
      </div>
    )

  const isTile = variant === 'tile'

  return (
    <Field data-disabled={isDisabled} data-invalid={fieldState.invalid} className={className}>
      {!isHideLabel && (
        <div className='flex items-center gap-1.5'>
          <FieldLabel isRequired={isRequired} isDisabled={isDisabled}>
            {label}
          </FieldLabel>

          {hint && !isTile && (
            <TooltipWrapper label={hint} delayDuration={100} className='max-w-xs'>
              <button
                type='button'
                aria-label={`About the ${label.toLowerCase()} image`}
                className='text-muted-foreground hover:text-foreground'
              >
                <Icons.info className='size-3.5' />
              </button>
            </TooltipWrapper>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type='file'
        accept={acceptedTypes.join(',')}
        className='hidden'
        onChange={(event) => {
          handleFile(event.target.files?.[0])
          event.target.value = ''
        }}
      />

      {variant === 'dropzone' ? renderDropzone() : isTile ? renderTile() : renderInline()}

      {/* //* the tile has no room beside the label, so the hint sits under it */}
      {isTile && hint && <span className='text-muted-foreground text-center text-xs'>{hint}</span>}

      {description && <FieldDescription>{description}</FieldDescription>}
      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
    </Field>
  )
}
