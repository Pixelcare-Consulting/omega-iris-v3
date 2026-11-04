import { NextRequest, NextResponse } from 'next/server'
import path from 'node:path'
import { createId } from '@paralleldrive/cuid2'

import db from '@/lib/db'
import { logger } from '@/lib/logger'
import { generateAttachmentKey, getActiveDiskName, getDisk } from '@/lib/storage'
import { getCurrentUserWithAbility } from '@/actions/user'
import { PERMISSIONS_ALLOWED_ACTIONS } from '@/constants/permission'
import {
  FILE_ATTACHMENT_ACCEPTED_TYPE_EXTENSIONS,
  FILE_ATTACHMENT_MAX_SIZE_MB,
  FILE_ATTACHMENT_MODULE_PERMISSIONS,
  FILE_ATTACHMENT_MODULE_UPLOAD_ACTIONS,
  FILE_ATTACHMENT_UPLOAD_MAX_WAIT_MS,
  FILE_ATTACHMENT_UPLOAD_TIMEOUT_MS,
  FileAttachmentModule
} from '@/constants/file-attachment'

const MAX_SIZE_BYTES = FILE_ATTACHMENT_MAX_SIZE_MB * 1024 * 1024

//! a route handler, not a server action, only XHR can report upload progress
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserWithAbility()

    const ability = currentUser?.ability

    if (!currentUser || !ability) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

    const formData = await request.formData()

    const file = formData.get('file')
    const moduleName = String(formData.get('moduleName') ?? '')
    const referenceId = String(formData.get('referenceId') ?? '')

    if (!(file instanceof File)) return NextResponse.json({ message: 'File is required' }, { status: 400 })
    if (!moduleName || !referenceId) return NextResponse.json({ message: 'Module and reference are required' }, { status: 400 })

    //! each module owns its own permission, an unknown module can never upload
    const permission = FILE_ATTACHMENT_MODULE_PERMISSIONS[moduleName as FileAttachmentModule]
    const uploadActions = FILE_ATTACHMENT_MODULE_UPLOAD_ACTIONS[moduleName] ?? [PERMISSIONS_ALLOWED_ACTIONS.CREATE]
    const canUpload = !!permission && uploadActions.some((uploadAction) => ability.can(uploadAction, permission))

    if (!canUpload) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    //! checked again here, the dropzone check is a convenience, not the gate
    if (file.size === 0) return NextResponse.json({ message: 'File is empty' }, { status: 400 })

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ message: `File must be ${FILE_ATTACHMENT_MAX_SIZE_MB}MB or less` }, { status: 400 })
    }

    //! the type and the name both come from the client, so neither is trusted on its own
    const allowedExtensions = FILE_ATTACHMENT_ACCEPTED_TYPE_EXTENSIONS[file.type]

    if (!allowedExtensions) return NextResponse.json({ message: 'File type is not allowed' }, { status: 400 })

    if (!allowedExtensions.includes(path.extname(file.name).toLowerCase())) {
      return NextResponse.json({ message: 'File name does not match its type' }, { status: 400 })
    }

    //* the row's id, also the file name once stored
    const id = createId()
    const diskName = getActiveDiskName()
    const key = generateAttachmentKey({ moduleName, segments: [referenceId], id, originalName: file.name })

    const contents = new Uint8Array(await file.arrayBuffer())

    try {
      const fileAttachment = await db.$transaction(
        async (tx) => {
          const createdFileAttachment = await tx.fileAttachment.create({
            data: {
              id,
              moduleName,
              referenceId,
              disk: diskName,
              key,
              originalName: file.name,
              mimeType: file.type,
              size: file.size,
              uploadedBy: currentUser.userCode
            }
          })

          await getDisk(diskName).put(key, contents)

          return createdFileAttachment
        },
        { timeout: FILE_ATTACHMENT_UPLOAD_TIMEOUT_MS, maxWait: FILE_ATTACHMENT_UPLOAD_MAX_WAIT_MS }
      )

      return NextResponse.json({ data: fileAttachment }, { status: 201 })
    } catch (err: any) {
      //! the commit can still fail after a successful write, so drop the object too
      await getDisk(diskName)
        .delete(key)
        .catch((deleteErr: any) => logger.error(deleteErr, '[UPLOAD_FILE_ATTACHMENT_ROLLBACK_ERROR]:'))

      throw err
    }
  } catch (err: any) {
    logger.error(err, '[UPLOAD_FILE_ATTACHMENT_ERROR]:')
    return NextResponse.json({ message: 'Something went wrong! Please try again later.' }, { status: 500 })
  }
}
