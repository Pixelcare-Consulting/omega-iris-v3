'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import Modal from '@/components/modal'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadItem,
  FileUploadItemDelete,
  FileUploadItemMetadata,
  FileUploadItemPreview,
  FileUploadItemProgress,
  FileUploadList,
  FileUploadStartTrigger,
  FileUploadTrigger
} from '@/components/ui/file-upload'
import LoadingButton from '@/components/forms/button-field'
import { logger } from '@/lib/logger'
import {
  FILE_ATTACHMENT_ACCEPTED_EXTENSIONS,
  FILE_ATTACHMENT_ACCEPTED_TYPES,
  FILE_ATTACHMENT_MAX_CONCURRENT_UPLOADS,
  FILE_ATTACHMENT_MAX_FILES,
  FILE_ATTACHMENT_MAX_SIZE_MB
} from '@/constants/file-attachment'

type FileAttachmentUploadFormProps = {
  isOpen: boolean
  moduleName: string
  referenceId: string
  onClose: () => void
  onSuccess: () => void
}

//* XHR, not fetch, only XHR reports how many bytes have gone out
function uploadFile(file: File, moduleName: string, referenceId: string, onProgress: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('moduleName', moduleName)
    formData.append('referenceId', referenceId)

    const xhr = new XMLHttpRequest()

    xhr.open('POST', '/api/file-attachments')

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve()

      try {
        reject(new Error(JSON.parse(xhr.responseText)?.message ?? 'Upload failed'))
      } catch {
        reject(new Error('Upload failed'))
      }
    }

    xhr.onerror = () => reject(new Error('Upload failed'))

    xhr.send(formData)
  })
}

export default function FileAttachmentUploadForm({ isOpen, moduleName, referenceId, onClose, onSuccess }: FileAttachmentUploadFormProps) {
  const [files, setFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])

  const uploadedCount = uploadedFiles.length

  //* what the Upload button would send, a file already sent is not counted again
  const pendingCount = files.filter((file) => !uploadedFiles.includes(file)).length

  const handleUpload = async (
    uploadFiles: File[],
    {
      onProgress,
      onSuccess: onFileSuccess,
      onError
    }: {
      onProgress: (file: File, progress: number) => void
      onSuccess: (file: File) => void
      onError: (file: File, error: Error) => void
    }
  ) => {
    setIsUploading(true)

    try {
      //* a small queue keeps ten files from saturating the connection
      const queue = [...uploadFiles]

      const worker = async () => {
        while (queue.length > 0) {
          const file = queue.shift()

          if (!file) return

          try {
            await uploadFile(file, moduleName, referenceId, (percent) => onProgress(file, percent))
            onFileSuccess(file)
            setUploadedFiles((uploaded) => [...uploaded, file])
          } catch (err: any) {
            logger.error(err, '[FILE_ATTACHMENT_UPLOAD_ERROR]:')
            onError(file, err instanceof Error ? err : new Error('Upload failed'))
            toast.error(`${file.name}: ${err?.message ?? 'Upload failed'}`)
          }
        }
      }

      await Promise.all(Array.from({ length: Math.min(FILE_ATTACHMENT_MAX_CONCURRENT_UPLOADS, uploadFiles.length) }, () => worker()))
    } finally {
      setIsUploading(false)
    }
  }

  const handleDone = () => {
    if (uploadedCount > 0) {
      toast.success(`${uploadedCount} file(s) uploaded successfully!`)

      //! close first, a refresh in the same tick swallows the closing navigation
      onClose()
      onSuccess()
      return
    }

    onClose()
  }

  return (
    //! wraps the modal, not just its body, the footer's upload button needs this context through the portal
    <FileUpload
      className='w-full'
      value={files}
      onValueChange={setFiles}
      onUpload={handleUpload}
      isUploadOnAdd={false}
      accept={[...FILE_ATTACHMENT_ACCEPTED_TYPES, ...FILE_ATTACHMENT_ACCEPTED_EXTENSIONS].join(',')}
      maxFiles={FILE_ATTACHMENT_MAX_FILES}
      maxSize={FILE_ATTACHMENT_MAX_SIZE_MB * 1024 * 1024}
      multiple
      onFileReject={(file, message) => toast.error(`${file.name}: ${message}`)}
    >
      <Modal
        isOpen={isOpen}
        size='lg'
        isModal={false}
        isCloseOnEscape={false}
        isCloseOnOutsideClick={false}
        title='Upload Attachments'
        description={`Images and PDFs only, up to ${FILE_ATTACHMENT_MAX_SIZE_MB}MB each`}
        onClose={handleDone}
        footer={
          <>
            <Button type='button' variant='outline' onClick={handleDone} disabled={isUploading}>
              {uploadedCount > 0 ? 'Done' : 'Cancel'}
            </Button>

            <FileUploadStartTrigger asChild>
              <LoadingButton type='button' isLoading={isUploading} disabled={isUploading || pendingCount === 0}>
                <Icons.upload /> Upload{pendingCount > 0 ? ` (${pendingCount})` : ''}
              </LoadingButton>
            </FileUploadStartTrigger>
          </>
        }
      >
        <FileUploadDropzone>
          <div className='flex flex-col items-center gap-1 text-center'>
            <div className='flex items-center justify-center rounded-full border p-2.5'>
              <Icons.upload className='text-muted-foreground size-6' />
            </div>
            <p className='text-sm font-medium'>Drag & drop files here</p>
            <p className='text-muted-foreground text-xs'>
              Or click to browse (max {FILE_ATTACHMENT_MAX_FILES} files, up to {FILE_ATTACHMENT_MAX_SIZE_MB}MB each)
            </p>
          </div>

          <FileUploadTrigger asChild>
            <Button variant='outline' size='sm' className='mt-2 w-fit'>
              Browse files
            </Button>
          </FileUploadTrigger>
        </FileUploadDropzone>

        <FileUploadList orientation='vertical' className='max-h-[40vh] overflow-auto'>
          {files.map((file, index) => (
            <FileUploadItem key={index} value={file}>
              <FileUploadItemPreview className='bg-muted text-muted-foreground border-0 [&>svg]:size-6' />
              <FileUploadItemMetadata />
              <FileUploadItemProgress variant='circular' />
              <FileUploadItemDelete asChild>
                <Button variant='ghost' size='icon' className='size-7' disabled={isUploading}>
                  <Icons.x />
                </Button>
              </FileUploadItemDelete>
            </FileUploadItem>
          ))}
        </FileUploadList>
      </Modal>
    </FileUpload>
  )
}
