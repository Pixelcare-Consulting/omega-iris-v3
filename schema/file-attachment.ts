import z from 'zod'

import { FILE_ATTACHMENT_ACCEPTED_TYPES, FILE_ATTACHMENT_MAX_SIZE_MB } from '@/constants/file-attachment'

export const fileAttachmentScopeSchema = z.object({
  moduleName: z.string().min(1),
  referenceId: z.string().min(1)
})

//* the upload route validates a raw file, not a form
export const fileAttachmentUploadSchema = z.object({
  moduleName: z.string().min(1, 'Module is required'),
  referenceId: z.string().min(1, 'Reference is required'),
  originalName: z.string().min(1, 'File name is required'),
  mimeType: z.string().refine((value) => FILE_ATTACHMENT_ACCEPTED_TYPES.includes(value), 'File type is not allowed'),
  size: z
    .number()
    .int()
    .positive('File is empty')
    .max(FILE_ATTACHMENT_MAX_SIZE_MB * 1024 * 1024, `File must be ${FILE_ATTACHMENT_MAX_SIZE_MB}MB or less`)
})

export type FileAttachmentUpload = z.infer<typeof fileAttachmentUploadSchema>
