import { FILE_ATTACHMENT_IMAGE_TYPES } from '@/constants/file-attachment'

export function isImageMimeType(mimeType: string) {
  return FILE_ATTACHMENT_IMAGE_TYPES.includes(mimeType)
}

export function buildFileAttachmentUrl(id: string, isDownload?: boolean) {
  return `/api/file-attachments/${id}${isDownload ? '?download=1' : ''}`
}
