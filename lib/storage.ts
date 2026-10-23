import path from 'node:path'
import { Disk } from 'flydrive'
import { FSDriver } from 'flydrive/drivers/fs'

import { FILE_ATTACHMENT_DISKS } from '@/constants/file-attachment'

//! kept outside the project
const DEFAULT_STORAGE_PATH = '../lis-storage'

//* one disk per name, cached so dev HMR does not stack instances
const globalForStorage = globalThis as unknown as { disks?: Map<string, Disk> }

const disks = globalForStorage.disks ?? new Map<string, Disk>()

if (process.env.NODE_ENV !== 'production') globalForStorage.disks = disks

export function resolveStorageRoot() {
  const storagePath = process.env.STORAGE_PATH?.trim() || DEFAULT_STORAGE_PATH

  //! the path is dynamic and sits outside the project, so the tracer has to skip it
  return path.isAbsolute(storagePath) ? storagePath : path.resolve(/*turbopackIgnore: true*/ process.cwd(), storagePath)
}

export function getActiveDiskName() {
  return process.env.FILE_STORAGE_DISK?.trim() || FILE_ATTACHMENT_DISKS.FS
}

function createDisk(name: string) {
  if (name === FILE_ATTACHMENT_DISKS.FS) {
    return new Disk(new FSDriver({ location: resolveStorageRoot(), visibility: 'private' }))
  }

  //! fail loudly, a silent fallback would write files to the wrong place
  throw new Error(`Unknown file storage disk: ${name}`)
}

export function getDisk(name = getActiveDiskName()) {
  const cached = disks.get(name)

  if (cached) return cached

  const created = createDisk(name)
  disks.set(name, created)

  return created
}

type GenerateAttachmentKeyParams = {
  moduleName: string
  originalName: string
  id: string
  segments: string[]
}

//! the id is always the last segment, that is what keeps a row and its object in step
export function generateAttachmentKey({ moduleName, segments, id, originalName }: GenerateAttachmentKeyParams) {
  const extension = path.extname(originalName).toLowerCase()

  //* segments reach the filesystem, so anything path-ish is stripped
  const filePath = [moduleName, ...segments.map((segment) => segment.replace(/[^a-zA-Z0-9-_]/g, '_')), id].join('/')

  return `${filePath}${extension}`
}
