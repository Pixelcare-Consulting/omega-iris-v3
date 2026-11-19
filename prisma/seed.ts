import 'dotenv/config'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { PrismaClient } from '@/prisma/generated/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { betterAuth } from 'better-auth'

import { logger } from '@/lib/logger'
import { DEFAULT_PERMISSIONS } from '@/constants/permission'
import { DEFAULT_ROLES } from '@/constants/role'
import { DEFAULT_SAP_DATABASES } from '@/constants/sap'
import { DEFAULT_PROJECT_CATEGORIES } from '@/constants/project-category'
import { DEFAULT_SITES } from '@/constants/site'
import { DEFAULT_PROCESS_ZONES } from '@/constants/process-zones'
import { createId } from '@paralleldrive/cuid2'
import { SYSTEM_ACTOR } from '@/constants/activity-log'
import { diffActivity, logActivities } from '@/lib/activity-log'
import { ROLE_ACTIVITY_CONFIG, ROLE_ACTIVITY_INCLUDE } from '@/lib/activity-configs/role'
import { USER_ACTIVITY_CONFIG } from '@/lib/activity-configs/user'
import { PROJECT_CATEGORY_ACTIVITY_CONFIG } from '@/lib/activity-configs/project-category'
import { SITE_ACTIVITY_CONFIG } from '@/lib/activity-configs/site'
import { PROCESS_ZONE_ACTIVITY_CONFIG } from '@/lib/activity-configs/process-zone'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const db = new PrismaClient({ adapter })

const auth = betterAuth({
  emailAndPassword: { enabled: true, autoSignIn: false },
  database: prismaAdapter(db, { provider: 'postgresql' }),
  user: {
    additionalFields: {
      code: { type: 'number', required: false, defaultValue: undefined },
      fname: { type: 'string', required: true },
      lname: { type: 'string', required: true },
      mname: { type: 'string', required: false, defaultValue: undefined },
      suffix: { type: 'string', required: false, defaultValue: undefined },
      username: { type: 'string', required: true },
      roleCode: { type: 'number', required: true },
      isActive: { type: 'boolean', required: false, defaultValue: true },
      lastSignin: { type: 'date', required: false, defaultValue: undefined },
      isSystem: { type: 'boolean', required: false, defaultValue: false },
      isDefaultPasswordChanged: { type: 'boolean', required: false, defaultValue: false }
    }
  },
  session: { modelName: 'authSession' }
})

async function main() {
  try {
    const activeSapDatabase = DEFAULT_SAP_DATABASES.filter((sapDb) => sapDb.isActive)

    logger.info('Database seeding...')

    //* reset code sequence
    logger.info('Reset code sequence..')
    await Promise.all([
      db.$executeRaw`ALTER SEQUENCE "User_code_seq" RESTART WITH 1`,
      db.$executeRaw`ALTER SEQUENCE "Role_code_seq" RESTART WITH 1`
    ])

    //* create default permissions
    logger.info('Create default permissions...')
    await db.permission.createMany({ data: DEFAULT_PERMISSIONS })

    //* create default roles
    logger.info('Create default roles...')
    await db.role.createMany({ data: DEFAULT_ROLES })

    //* create admin user
    logger.info('Create admin user...')
    await auth.api.signUpEmail({
      body: {
        fname: 'System',
        lname: 'Admin',
        name: 'System Admin',
        email: 'admin@omega.com',
        username: 'admin',
        roleCode: 1,
        password: 'admin123',
        isSystem: true,
        isDefaultPasswordChanged: true
      }
    })

    //* sign up cannot set it, the field is input false
    await db.user.update({ where: { username: 'admin' }, data: { isInternal: true } })

    //* one copy of each default per sap database, flagged system so they stay view only
    logger.info('Create default project categories...')
    await db.projectCategory.createMany({
      data: activeSapDatabase.flatMap(({ dbCode }) => DEFAULT_PROJECT_CATEGORIES.map((row) => ({ ...row, dbCode, isSystem: true })))
    })

    logger.info('Create default sites...')
    await db.site.createMany({
      data: activeSapDatabase.flatMap(({ dbCode }) => DEFAULT_SITES.map((row) => ({ ...row, dbCode, isSystem: true })))
    })

    logger.info('Create default process zones...')
    await db.processZone.createMany({
      data: activeSapDatabase.flatMap(({ dbCode }) => DEFAULT_PROCESS_ZONES.map((row) => ({ ...row, dbCode, isSystem: true })))
    })

    //* one batch for the whole run, so the audit log can list everything the seed made
    logger.info('Log seeded records...')

    const [roles, users, projectCategories, sites, processZones] = await Promise.all([
      db.role.findMany({ include: ROLE_ACTIVITY_INCLUDE }),
      db.user.findMany({ include: { role: true } }),
      db.projectCategory.findMany(),
      db.site.findMany(),
      db.processZone.findMany()
    ])

    const seeded = { actor: SYSTEM_ACTOR, action: 'CREATE' as const, batchId: createId(), summary: 'Created by seed' }

    await logActivities(db, [
      ...roles.map((row) => ({
        ...seeded,
        module: 'ROLES' as const,
        entity: { id: row.id, code: row.code, label: row.name },
        changes: diffActivity(ROLE_ACTIVITY_CONFIG, null, row)
      })),
      ...users.map((row) => ({
        ...seeded,
        module: 'USERS' as const,
        entity: { id: row.id, code: row.code, label: row.name },
        changes: diffActivity(USER_ACTIVITY_CONFIG, null, row)
      })),
      ...projectCategories.map((row) => ({
        ...seeded,
        module: 'PROJECT_CATEGORIES' as const,
        dbCode: row.dbCode,
        entity: { id: row.id, code: row.code, label: row.name },
        changes: diffActivity(PROJECT_CATEGORY_ACTIVITY_CONFIG, null, row)
      })),
      ...sites.map((row) => ({
        ...seeded,
        module: 'SITES' as const,
        dbCode: row.dbCode,
        entity: { id: row.id, code: row.code, label: row.name },
        changes: diffActivity(SITE_ACTIVITY_CONFIG, null, row)
      })),
      ...processZones.map((row) => ({
        ...seeded,
        module: 'PROCESS_ZONES' as const,
        dbCode: row.dbCode,
        entity: { id: row.id, code: row.code, label: row.name },
        changes: diffActivity(PROCESS_ZONE_ACTIVITY_CONFIG, null, row)
      }))
    ])

    logger.info('Database seeded successfully!')
  } catch (err: any) {
    logger.error(err, 'Database seeding failed!')
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
