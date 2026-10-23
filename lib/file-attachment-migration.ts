import db from '@/lib/db'
import { logger } from '@/lib/logger'
import { getDisk } from '@/lib/storage'

type MigrateFileAttachmentsOptions = {
  from: string
  to: string
  moduleName?: string
  batchSize?: number
  isDryRun?: boolean
  isKeepSource?: boolean
}

export type MigrationResult = {
  migrated: number
  skipped: number
  failed: { id: string; key: string; error: string }[]
}

const DEFAULT_BATCH_SIZE = 25

//* per-row commit makes a rerun resume instead of redo
export async function migrateFileAttachments({
  from,
  to,
  moduleName,
  batchSize = DEFAULT_BATCH_SIZE,
  isDryRun,
  isKeepSource
}: MigrateFileAttachmentsOptions): Promise<MigrationResult> {
  if (from === to) throw new Error('Source and target disks must differ')

  const sourceDisk = getDisk(from)
  const targetDisk = getDisk(to)

  const result: MigrationResult = { migrated: 0, skipped: 0, failed: [] }

  const where = { disk: from, ...(moduleName ? { moduleName } : {}) }

  const total = await db.fileAttachment.count({ where })

  logger.info(`[MIGRATE_FILE_ATTACHMENTS]: ${total} attachment(s) on "${from}"${isDryRun ? ' (dry run)' : ''}`)

  let processed = 0

  //* a failed row keeps its disk, so without this the next batch would hand it back forever
  const handledIds = new Set<string>()

  while (processed < total) {
    const batch = await db.fileAttachment.findMany({
      where: { ...where, ...(handledIds.size > 0 ? { id: { notIn: [...handledIds] } } : {}) },
      take: batchSize,
      orderBy: { uploadedAt: 'asc' }
    })

    if (batch.length === 0) break

    for (const fileAttachment of batch) {
      handledIds.add(fileAttachment.id)

      const { id, key, size } = fileAttachment

      try {
        if (!(await sourceDisk.exists(key))) {
          logger.warn(`[MIGRATE_FILE_ATTACHMENTS]: missing object, skipped: ${key}`)
          result.skipped++
          processed++
          continue
        }

        if (isDryRun) {
          logger.info(`[MIGRATE_FILE_ATTACHMENTS]: would move ${key}`)
          result.migrated++
          processed++
          continue
        }

        //! streamed, not read as a string, `get` decodes UTF-8 and would corrupt a PDF
        await targetDisk.putStream(key, await sourceDisk.getStream(key))

        const { contentLength } = await targetDisk.getMetaData(key)

        //! verify before the row moves, a short write must not be recorded as migrated
        if (Number(contentLength) !== size) throw new Error(`Size mismatch: expected ${size}, wrote ${contentLength}`)

        await db.fileAttachment.update({ where: { id }, data: { disk: to } })

        if (!isKeepSource) await sourceDisk.delete(key)

        result.migrated++
      } catch (err: any) {
        logger.error(err, '[MIGRATE_FILE_ATTACHMENT_ERROR]:')
        result.failed.push({ id, key, error: err instanceof Error ? err.message : String(err) })
      }

      processed++
    }

    //* a dry run never changes `disk`, so the same rows would come back forever
    if (isDryRun) break
  }

  logger.info(`[MIGRATE_FILE_ATTACHMENTS]: migrated ${result.migrated}, skipped ${result.skipped}, failed ${result.failed.length}`)

  return result
}
