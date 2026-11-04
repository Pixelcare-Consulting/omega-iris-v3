import { FILE_ATTACHMENT_IMAGE_TYPES } from '@/constants/file-attachment'
import type { FileAttachment } from '@/prisma/generated/client'

export function isImageMimeType(mimeType: string) {
  return FILE_ATTACHMENT_IMAGE_TYPES.includes(mimeType)
}

export function buildFileAttachmentUrl(id: string, isDownload?: boolean) {
  return `/api/file-attachments/${id}${isDownload ? '?download=1' : ''}`
}

type UploadFileAttachmentInput = {
  file: File
  moduleName: string
  referenceId: string
  onProgress?: (percent: number) => void
}

//* XHR, not fetch, only XHR reports how many bytes have gone out
export function uploadFileAttachment({ file, moduleName, referenceId, onProgress }: UploadFileAttachmentInput) {
  return new Promise<FileAttachment>((resolve, reject) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('moduleName', moduleName)
    formData.append('referenceId', referenceId)

    const xhr = new XMLHttpRequest()

    xhr.open('POST', '/api/file-attachments')

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100))
    }

    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText)

        if (xhr.status >= 200 && xhr.status < 300) return resolve(body.data)

        reject(new Error(body?.message ?? 'Upload failed'))
      } catch {
        reject(new Error('Upload failed'))
      }
    }

    xhr.onerror = () => reject(new Error('Upload failed'))

    xhr.send(formData)
  })
}
