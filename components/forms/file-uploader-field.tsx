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
  FileUploadItemProgress,
  FileUploadList,
  FileUploadTrigger
} from '../ui/file-upload'
import { Icons } from '../icons'
import { Button } from '../ui/button'
import { cn } from '@/lib/utils'

type ExtendedProps = FormExtendedProps & { fileUploaderProps?: FileUploaderProps }

type FileUploaderFieldProps<
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
  extendedProps?: ExtendedProps
}

export default function FileUploaderField<T extends FieldValues>({
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
  extendedProps
}: FileUploaderFieldProps<T>) {
  const form = useFormContext()

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        const value = field.value
        const isArray = Array.isArray(value)
        const files = isArray ? value : [value]

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
              onValueChange={field.onChange}
              maxFiles={maxFiles}
              maxSize={maxSize ? maxSize * 1024 * 1024 : undefined}
              multiple={isMultiple}
              disabled={extendedProps?.fileUploaderProps?.disabled}
              onFileReject={(_, message) => {
                form.setError(name, { message })
              }}
            >
              <FileUploadDropzone>
                <div className='flex flex-col items-center gap-1 text-center'>
                  <div className='flex items-center justify-center rounded-full border p-2.5'>
                    <Icons.upload className='text-muted-foreground size-6' />
                  </div>
                  <p className={cn('text-sm font-medium', extendedProps?.fileUploaderProps?.disabled && 'text-muted-foreground')}>
                    Drag & drop files here
                  </p>
                  <p className='text-muted-foreground text-xs'>
                    Or click to browse ({maxFiles ? `max ${maxFiles} files, ` : ''}up to {maxSize}MB each)
                  </p>
                </div>
                <FileUploadTrigger asChild>
                  <Button variant='outline' size='sm' className='mt-2 w-fit'>
                    Browse files
                  </Button>
                </FileUploadTrigger>
              </FileUploadDropzone>
              <FileUploadList orientation={direction} className={cn('overflow-auto', listContainerClassName)}>
                {files.map((file, index) => (
                  <FileUploadItem key={index} value={file}>
                    <FileUploadItemPreview />
                    <FileUploadItemMetadata />

                    {/* //! only with an upload handler, without one a file sits at 0 and the bar never leaves */}
                    {extendedProps?.fileUploaderProps?.onUpload && <FileUploadItemProgress variant='linear' />}

                    <FileUploadItemDelete asChild>
                      <Button variant='ghost' size='icon' className='size-7'>
                        <Icons.x />
                      </Button>
                    </FileUploadItemDelete>
                  </FileUploadItem>
                ))}
              </FileUploadList>

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
