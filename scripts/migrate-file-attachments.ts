import 'dotenv/config'

import { migrateFileAttachments } from '@/lib/file-attachment-migration'
import { logger } from '@/lib/logger'

function getArg(name: string) {
  const prefix = `--${name}=`
  const match = process.argv.find((arg) => arg.startsWith(prefix))

  return match ? match.slice(prefix.length) : undefined
}

async function main() {
  const from = getArg('from')
  const to = getArg('to')

  if (!from || !to) {
    logger.error('[MIGRATE_FILE_ATTACHMENTS_SCRIPT_ERROR]: --from and --to are required')
    process.exit(1)
  }

  const result = await migrateFileAttachments({
    from,
    to,
    moduleName: getArg('module'),
    isDryRun: process.argv.includes('--dry-run'),
    isKeepSource: process.argv.includes('--keep-source')
  })

  if (result.failed.length > 0) process.exit(1)
}

main().catch((err) => {
  logger.error(err, '[MIGRATE_FILE_ATTACHMENTS_SCRIPT_ERROR]:')
  process.exit(1)
})
