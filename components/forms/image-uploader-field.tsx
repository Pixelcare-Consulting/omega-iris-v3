'use client'

import { Control, Controller, FieldPath, FieldValues, useFormContext } from 'react-hook-form'

import { Field, FieldLabel, FieldDescription, FieldError } from '../ui/field'
import { FormExtendedProps, FileUploaderProps } from '@/types/common'
import {
  FileUpload,
  FileUploadClear,
  FileUploadDropzone,
  FileUploadItem,
  FileUploadItemDelete,
  FileUploadItemMetadata,
  FileUploadItemPreview,
  FileUploadList,
  FileUploadTrigger
} from '../ui/file-upload'
import { Icons } from '../icons'
import { Button } from '../ui/button'
import { cn } from '@/lib/utils'

type ExtendedProps = FormExtendedProps & { fileUploaderProps?: FileUploaderProps }

type ImageUploaderFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> = {
  control: Control<TFieldValues>
  name: TName
  label?: string
  description?: string
  direction?: 'horizontal' | 'vertical'
  maxSize?: number
  maxFiles?: number
  isMultiple?: boolean
  isRequired?: boolean
  isHideLabel?: boolean
  isShowClear?: boolean
  listContainerClassName?: string
  triggerContainerClassName?: string
  extendedProps?: ExtendedProps
}

export default function ImageUploaderField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  direction = 'horizontal',
  maxSize,
  maxFiles,
  isMultiple,
  isRequired,
  isHideLabel,
  isShowClear,
  listContainerClassName,
  triggerContainerClassName,
  extendedProps
}: ImageUploaderFieldProps<T>) {
  const form = useFormContext()

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        const value = field.value
        const isArray = Array.isArray(value)
        const files = isArray ? value : [value].filter(Boolean)

        const coverPreview = files.length > 0 && !isMultiple && files[0] ? URL.createObjectURL(files[0]) : null

        return (
          <Field
            {...extendedProps?.fieldProps}
            data-disabled={extendedProps?.fileUploaderProps?.disabled}
            data-invalid={fieldState.invalid}
          >
            {!isHideLabel && label && (
              <FieldLabel
                {...extendedProps?.fieldLabelProps}
                isRequired={isRequired}
                isDisabled={extendedProps?.fileUploaderProps?.disabled}
                htmlFor={field.name}
              >
                {label}
              </FieldLabel>
            )}

            <FileUpload
              className={cn('w-full', extendedProps?.fileUploaderProps?.className)}
              {...extendedProps?.fileUploaderProps}
              value={files}
              onValueChange={(files) => {
                if (!isMultiple) {
                  field.onChange(files[0])
                  return
                }

                field.onChange(files)
              }}
              maxFiles={maxFiles}
              maxSize={maxSize ? maxSize * 1024 * 1024 : undefined}
              multiple={isMultiple}
              disabled={extendedProps?.fileUploaderProps?.disabled}
              onFileReject={(_, message) => {
                form.setError(name, { message })
              }}
              accept='image/*'
            >
              {!isMultiple ? (
                <FileUploadTrigger asChild>
                  <div
                    className={cn(
                      'group relative cursor-pointer overflow-hidden rounded-lg border-2 border-dashed',
                      triggerContainerClassName
                    )}
                  >
                    {coverPreview ? (
                      <div className='relative h-full w-full'>
                        <img
                          src={coverPreview}
                          alt='Cover'
                          className='h-full w-full object-cover'
                          onClick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                          }}
                        />

                        <div
                          className='absolute top-2 right-2 z-30 flex size-6 cursor-pointer items-center justify-center rounded-full bg-red-500'
                          onClick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            field.onChange('')
                          }}
                        >
                          <Icons.x className={cn('size-4', fieldState.invalid ? 'text-red-500' : 'text-white')} />
                        </div>
                      </div>
                    ) : (
                      <div className='group-hover:bg-muted flex h-full w-full flex-col items-center justify-center gap-2 transition-colors'>
                        <div className='flex items-center justify-center rounded-full border p-2.5'>
                          <Icons.image className={cn('text-muted-foreground', fieldState.invalid && 'text-red-500')} />
                        </div>
                        <p className={cn('text-sm font-medium', extendedProps?.fileUploaderProps?.disabled && 'text-muted-foreground')}>
                          Click to insert image
                        </p>
                        <p className='text-muted-foreground text-xs'>
                          ({maxFiles ? 'max 2 files, ' : ''}up to {maxSize}MB each)
                        </p>
                      </div>
                    )}
                  </div>
                </FileUploadTrigger>
              ) : (
                <FileUploadDropzone>
                  <div className='flex flex-col items-center gap-1 text-center'>
                    <div className='flex items-center justify-center rounded-full border p-2.5'>
                      <Icons.image className='text-muted-foreground size-6' />
                    </div>
                    <p className={cn('text-sm font-medium', extendedProps?.fileUploaderProps?.disabled && 'text-muted-foreground')}>
                      Drag & drop images here
                    </p>
                    <p className='text-muted-foreground text-xs'>
                      Or click to browse ({maxFiles ? 'max 2 files, ' : ''}up to {maxSize}MB each)
                    </p>
                  </div>
                  <FileUploadTrigger asChild>
                    <Button variant='outline' size='sm' className='mt-2 w-fit'>
                      Browse images
                    </Button>
                  </FileUploadTrigger>
                </FileUploadDropzone>
              )}

              {!isMultiple ? null : (
                <FileUploadList orientation={direction} className={cn('overflow-auto', listContainerClassName)}>
                  {files.map((file, index) => (
                    <FileUploadItem key={index} value={file}>
                      <FileUploadItemPreview />
                      <FileUploadItemMetadata />
                      <FileUploadItemDelete asChild>
                        <Button variant='ghost' size='icon' className='size-7'>
                          <Icons.x />
                        </Button>
                      </FileUploadItemDelete>
                    </FileUploadItem>
                  ))}
                </FileUploadList>
              )}

              {isShowClear && (
                <FileUploadClear>
                  <Button variant='ghost'>
                    <Icons.trash /> Clear All
                  </Button>
                </FileUploadClear>
              )}
            </FileUpload>

            {description && <FieldDescription {...extendedProps?.fieldDescriptionProps}>{description}</FieldDescription>}
            {fieldState.invalid && <FieldError {...extendedProps?.fieldErrorProps} errors={[fieldState.error]} />}
          </Field>
        )
      }}
    />
  )
}
