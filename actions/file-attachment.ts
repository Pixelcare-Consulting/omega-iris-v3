'use server'

import z from 'zod'

import { logger } from '@/lib/logger'
import { DataTableParams, dataTableParamsSchema } from '@/schema/data-table'
import { buildColumnFiltersWhere, buildGlobalFilterWhere, buildOrderBy, getDataTableParams } from '@/lib/data-table'
import { PModels } from '@/types/prisma'
import db from '@/lib/db'
import { action, authenticationMiddleware } from '@/lib/safe-action'
import { Prisma } from '@/prisma/generated/client'
import { getDisk } from '@/lib/storage'
import { AppAbility } from '@/lib/rbac'
import { PERMISSIONS_ALLOWED_ACTIONS } from '@/constants/permission'
import { FILE_ATTACHMENT_MODULE_PERMISSIONS, FileAttachmentModule } from '@/constants/file-attachment'

const COMMON_FILE_ATTACHMENT_INCLUDE = {
  uploadedByUser: { select: { code: true, name: true } }
} satisfies Prisma.FileAttachmentInclude

export type FileAttachmentWithInclude = Prisma.FileAttachmentGetPayload<{ include: typeof COMMON_FILE_ATTACHMENT_INCLUDE }>

//* an attachment follows its module's permission, an unknown module is never allowed
function canUseModule(ability: AppAbility, moduleName: string | null | undefined, actions: string[]) {
  const permission = moduleName ? FILE_ATTACHMENT_MODULE_PERMISSIONS[moduleName as FileAttachmentModule] : undefined
  return !!permission && actions.some((action) => ability?.can(action, permission))
}

export async function getFileAttachments(moduleName?: string | null, referenceId?: string | null) {
  if (!moduleName || !referenceId) return []

  try {
    return await db.fileAttachment.findMany({
      where: { moduleName, referenceId },
      include: COMMON_FILE_ATTACHMENT_INCLUDE,
      orderBy: { uploadedAt: 'desc' }
    })
  } catch (err: any) {
    logger.error(err, '[GET_FILE_ATTACHMENTS_ERROR]:')
    return []
  }
}

export const getFileAttachmentsClient = action
  .use(authenticationMiddleware)
  .inputSchema(z.object({ moduleName: z.string().nullish(), referenceId: z.string().nullish() }))
  .action(async ({ ctx, parsedInput }) => {
    if (!canUseModule(ctx.ability, parsedInput.moduleName, [PERMISSIONS_ALLOWED_ACTIONS.VIEW])) return []
    return getFileAttachments(parsedInput.moduleName, parsedInput.referenceId)
  })

export async function getFileAttachmentById(id?: string | null) {
  if (!id) return null

  try {
    return await db.fileAttachment.findUnique({ where: { id }, include: COMMON_FILE_ATTACHMENT_INCLUDE })
  } catch (err: any) {
    logger.error(err, '[GET_FILE_ATTACHMENT_BY_ID_ERROR]:')
    return null
  }
}

export const getFileAttachmentByIdClient = action
  .use(authenticationMiddleware)
  .inputSchema(z.object({ id: z.string().nullish() }))
  .action(async ({ ctx, parsedInput }) => {
    const fileAttachment = await getFileAttachmentById(parsedInput.id)
    if (!fileAttachment || !canUseModule(ctx.ability, fileAttachment.moduleName, [PERMISSIONS_ALLOWED_ACTIONS.VIEW])) return null
    return fileAttachment
  })

export async function getDataTableFileAttachmentsSvr(moduleName: string, referenceId: string, params: DataTableParams) {
  const { perPage, offset, globalFilter, sorting, columnFilters, isExport } = getDataTableParams(params)

  const modelName: keyof PModels = 'FileAttachment'

  //* initialize where input
  //* scoped to one record, attachments have no soft delete
  const where: Prisma.FileAttachmentWhereInput = { moduleName, referenceId }

  //* global filter
  if (globalFilter) {
    const filter = buildGlobalFilterWhere<typeof modelName>(globalFilter, {
      stringFields: ['originalName'],
      relationFields: [{ relation: 'uploadedByUser', fields: ['name'], relationNullable: true }]
    })

    Object.assign(where, filter)
  }

  //* column filters
  if (columnFilters.length > 0) {
    const currentFilters = where.AND as Prisma.FileAttachmentWhereInput[]

    const filters = buildColumnFiltersWhere<typeof modelName>(columnFilters, { dateFields: [{ field: 'uploadedAt' }] })

    where.AND = [...(currentFilters ?? []), ...filters]
  }

  //* initialize order input
  //* the cards have no sort UI, so only the newest-first default arrives here
  const orderBy = buildOrderBy<typeof modelName>(sorting) as Prisma.FileAttachmentOrderByWithRelationInput[]

  try {
    const [data, rowCount] = await db.$transaction([
      db.fileAttachment.findMany({
        where,
        ...(isExport ? {} : { skip: offset, take: perPage }),
        orderBy,
        include: COMMON_FILE_ATTACHMENT_INCLUDE
      }),
      db.fileAttachment.count({ where })
    ])

    return { data, rowCount }
  } catch (err: any) {
    logger.error(err, '[GET_DATA_TABLE_FILE_ATTACHMENTS_ERROR]:')
    return { data: [], rowCount: 0 }
  }
}

export const getDataTableFileAttachmentsSvrClient = action
  .use(authenticationMiddleware)
  .inputSchema(dataTableParamsSchema.extend({ moduleName: z.string(), referenceId: z.string() }))
  .action(async ({ ctx, parsedInput }) => {
    const { moduleName, referenceId, ...params } = parsedInput
    if (!canUseModule(ctx.ability, moduleName, [PERMISSIONS_ALLOWED_ACTIONS.VIEW])) return { data: [], rowCount: 0 }
    return getDataTableFileAttachmentsSvr(moduleName, referenceId, params)
  })

export const deleteFileAttachment = action
  .use(authenticationMiddleware)
  .inputSchema(z.object({ id: z.string() }))
  .action(async ({ ctx, parsedInput }) => {
    const { id } = parsedInput
    const actionTag = 'DELETE_FILE_ATTACHMENT'

    try {
      const fileAttachment = await db.fileAttachment.findUnique({ where: { id } })

      if (!fileAttachment) return { error: true, status: 404, message: 'Attachment not found!', action: actionTag }

      //* removing a file is editing its record
      if (!canUseModule(ctx.ability, fileAttachment.moduleName, [PERMISSIONS_ALLOWED_ACTIONS.EDIT])) {
        return { error: true, status: 403, message: 'You are not allowed to do this!', action: actionTag }
      }

      //! the object delete sits inside the transaction, a disk failure rolls the row back
      await db.$transaction(async (tx) => {
        await tx.fileAttachment.delete({ where: { id } })
        await getDisk(fileAttachment.disk).delete(fileAttachment.key)
      })

      return { status: 200, message: 'Attachment deleted successfully!', action: actionTag, data: { fileAttachment } }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      return {
        error: true,
        status: 500,
        message: err instanceof Error ? err.message : 'Something went wrong!',
        action: actionTag
      }
    }
  })

//* used by deleteItem so a removed record leaves no orphan objects
export async function deleteFileAttachmentsByReference(moduleName: string, referenceId: string) {
  try {
    const fileAttachments = await db.fileAttachment.findMany({ where: { moduleName, referenceId } })

    if (fileAttachments.length === 0) return

    await db.fileAttachment.deleteMany({ where: { moduleName, referenceId } })

    //* rows go first, a failed object delete only leaves a stray file
    await Promise.all(
      fileAttachments.map(async (fileAttachment) => {
        try {
          await getDisk(fileAttachment.disk).delete(fileAttachment.key)
        } catch (err: any) {
          logger.error(err, '[DELETE_FILE_ATTACHMENT_OBJECT_ERROR]:')
        }
      })
    )
  } catch (err: any) {
    logger.error(err, '[DELETE_FILE_ATTACHMENTS_BY_REFERENCE_ERROR]:')
  }
}
