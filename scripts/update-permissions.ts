//* syncs DEFAULT_PERMISSIONS into the db, adds and updates only
//! never deletes a permission or removes an action, and never touches role grants
//*
//* Usage
//*   pnpm db:update-permission    - adds new permissions and actions, safe on any database
//*
import 'dotenv/config'

import db from '@/lib/db'
import { logger } from '@/lib/logger'
import { DEFAULT_PERMISSIONS } from '@/constants/permission'

async function main() {
  //* parents first, parentCode is a foreign key
  const permissions = [...DEFAULT_PERMISSIONS].sort((a, b) => Number(!!a.parentCode) - Number(!!b.parentCode))

  let createdCount = 0
  let updatedCount = 0
  const addedActions: string[] = []

  await db.$transaction(async (tx) => {
    for (const permission of permissions) {
      const { code, name, description, isParent, parentCode, isSystem } = permission
      const allowedActions = (permission.allowedActions ?? []) as string[]

      const existing = await tx.permission.findUnique({ where: { code } })

      //* create if missing
      if (!existing) {
        await tx.permission.create({ data: { code, name, description, isParent, parentCode, isSystem, allowedActions } })
        createdCount++
        continue
      }

      //* keep existing actions, append new ones
      const newActions = allowedActions.filter((act) => !existing.allowedActions.includes(act))

      await tx.permission.update({
        where: { code },
        data: { name, description, isParent, parentCode, isSystem, allowedActions: [...existing.allowedActions, ...newActions] }
      })

      updatedCount++
      if (newActions.length > 0) addedActions.push(`${code}: +${newActions.join(', +')}`)
    }
  })

  logger.info(`Permissions created: ${createdCount}, updated: ${updatedCount}`)
  addedActions.forEach((line) => logger.info(line))
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error(err, '[UPDATE_PERMISSIONS_ERROR]:')
    process.exit(1)
  })
