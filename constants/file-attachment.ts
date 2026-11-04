import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'

//* module names namespace stored objects and scope every query
export const FILE_ATTACHMENT_MODULES = { SETTINGS: 'settings', ITEM_MASTERS: 'item-masters' } as const

//* which permission guards uploads for each module
export const FILE_ATTACHMENT_MODULE_PERMISSIONS = {
  [FILE_ATTACHMENT_MODULES.SETTINGS]: PERMISSIONS_CODES.SETTINGS,
  [FILE_ATTACHMENT_MODULES.ITEM_MASTERS]: PERMISSIONS_CODES.ITEM_MASTERS
} as const

//* which actions allow an upload, any one is enough, modules not listed need create
//* settings has no create, an image upload is part of editing it
//* an item thumbnail is set while creating or editing the item
export const FILE_ATTACHMENT_MODULE_UPLOAD_ACTIONS: Partial<Record<string, string[]>> = {
  [FILE_ATTACHMENT_MODULES.SETTINGS]: [PERMISSIONS_ALLOWED_ACTIONS.EDIT],
  [FILE_ATTACHMENT_MODULES.ITEM_MASTERS]: [PERMISSIONS_ALLOWED_ACTIONS.CREATE, PERMISSIONS_ALLOWED_ACTIONS.EDIT]
}

export const FILE_ATTACHMENT_DISKS = { FS: 'fs' } as const

export const FILE_ATTACHMENT_MAX_SIZE_MB = 4
export const FILE_ATTACHMENT_MAX_FILES = 10
export const FILE_ATTACHMENT_MAX_CONCURRENT_UPLOADS = 3

//! the disk write runs inside the transaction, so the 5s prisma default is too short for a slow disk
export const FILE_ATTACHMENT_UPLOAD_TIMEOUT_MS = 20_000

//* each upload holds a connection while it writes, so give the pool room
export const FILE_ATTACHMENT_UPLOAD_MAX_WAIT_MS = 5_000

//* the client sends the type and the name, both are checked and they have to agree
export const FILE_ATTACHMENT_ACCEPTED_TYPE_EXTENSIONS: Record<string, string[]> = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf']
}

export const FILE_ATTACHMENT_ACCEPTED_TYPES = Object.keys(FILE_ATTACHMENT_ACCEPTED_TYPE_EXTENSIONS)
export const FILE_ATTACHMENT_ACCEPTED_EXTENSIONS = Object.values(FILE_ATTACHMENT_ACCEPTED_TYPE_EXTENSIONS).flat()

export const FILE_ATTACHMENT_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']

export type FileAttachmentModule = (typeof FILE_ATTACHMENT_MODULES)[keyof typeof FILE_ATTACHMENT_MODULES]
export type FileAttachmentDisk = (typeof FILE_ATTACHMENT_DISKS)[keyof typeof FILE_ATTACHMENT_DISKS]
