//* Usage
//*   pnpm sap:smoke <dbCode>               —— one call, prints the result and the stored session
//*   pnpm sap:smoke <dbCode> --parallel    —— expires the session, then fires 5 calls at once, expect one login
//*
//! runs with --conditions react-server, otherwise the server-only import in lib/sap throws

import 'dotenv/config'

import db from '@/lib/db'
import { sapFetch } from '@/lib/sap/service-layer'

const PARALLEL_CALLS = 5

async function main() {
  const dbCode = process.argv.slice(2).find((arg) => !arg.startsWith('--'))
  const isParallel = process.argv.includes('--parallel')

  if (!dbCode) throw new Error('Pass a dbCode, e.g. pnpm sap:smoke SBODEMO')

  if (isParallel) {
    await db.sapSession.updateMany({ where: { dbCode }, data: { expiresAt: new Date(0) } })

    const calls = Array.from({ length: PARALLEL_CALLS }, () => sapFetch(dbCode, 'company.info'))
    const results = await Promise.all(calls)

    console.log(results.map((result) => (result.ok ? 'ok' : `${result.code}: ${result.message}`)))
  } else {
    const result = await sapFetch(dbCode, 'company.info')
    console.log(result.ok ? { ok: true, status: result.status } : result)
  }

  const stored = await db.sapSession.findUnique({ where: { dbCode }, select: { b1Session: true, routeId: true, expiresAt: true } })
  console.log({ stored: stored && { ...stored, b1Session: `${stored.b1Session.slice(0, 18)}...` } })
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
