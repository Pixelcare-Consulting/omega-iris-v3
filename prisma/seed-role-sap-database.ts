//* Usage
//*   pnpm db:seed:role-sap-database                    —— links every sap database to each live role that has none yet
//*   pnpm db:seed:role-sap-database DB_A DB_B          —— same, but only the listed sap databases
//*
//* first time setup only, a role that already has any database is skipped, so access set on the role form is never undone
//! run after db:seed:sap-database, the links need the sap database rows

import 'dotenv/config'
import { PrismaClient } from '@/prisma/generated/client'
import { PrismaPg } from '@prisma/adapter-pg'

import { SUPER_USER_ROLE_KEY } from '@/constants/role'
import logger from '@/lib/logger'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const db = new PrismaClient({ adapter })

const DB_CODES = process.argv.slice(2)

async function main() {
  logger.info('Generating Role SAP Databases...')

  const [roles, databases] = await Promise.all([
    //* super user already gets every database, so it needs no links
    db.role.findMany({
      where: { deletedAt: null, key: { not: SUPER_USER_ROLE_KEY }, roleSapDatabases: { none: {} } },
      select: { code: true }
    }),
    db.sapDatabase.findMany({ where: DB_CODES.length > 0 ? { dbCode: { in: DB_CODES } } : {}, select: { dbCode: true } })
  ])

  //* codes with no sap database row are skipped
  const unknown = DB_CODES.filter((dbCode) => !databases.some((database) => database.dbCode === dbCode))

  if (unknown.length > 0) logger.info(`Skipped unknown SAP database(s): ${unknown.join(', ')}`)

  const { count } = await db.roleSapDatabase.createMany({
    data: roles.flatMap((role) => databases.map((database) => ({ roleCode: role.code, sapDatabaseCode: database.dbCode }))),
    skipDuplicates: true
  })

  logger.info(
    `Role SAP Databases seeded successfully! (${count} links, ${roles.length} roles without a database x ${databases.map((database) => database.dbCode).join(', ') || 'none'})`
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
