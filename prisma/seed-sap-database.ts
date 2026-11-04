//* Usage
//*   pnpm db:seed:sap-database    —— upserts the sap databases in DEFAULT_SAP_DATABASES
//*   pnpm db:seed                 —— runs this after the main seed
//*
//* safe to re-run, existing rows only get their name, order and active flag updated

import 'dotenv/config'
import { PrismaClient } from '@/prisma/generated/client'
import { PrismaPg } from '@prisma/adapter-pg'

import { DEFAULT_SAP_DATABASES } from '@/constants/sap'
import logger from '@/lib/logger'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const db = new PrismaClient({ adapter })

async function main() {
  logger.info('Generating SAP Databases...')

  for (const { dbCode, name, order, isActive } of DEFAULT_SAP_DATABASES) {
    await db.sapDatabase.upsert({ where: { dbCode }, create: { dbCode, name, order, isActive }, update: { name, order, isActive } })
  }

  logger.info(`SAP Databases seeded successfully! (${DEFAULT_SAP_DATABASES.map((sapDb) => sapDb.dbCode).join(', ')})`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
