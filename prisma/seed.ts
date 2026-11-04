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

    logger.info('Database seeded successfully!')
  } catch (err: any) {
    logger.error(err, 'Database seeding failed!')
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
