import type { Prisma } from '@/prisma/generated/client'
import type { LocationType } from '@/prisma/generated/enums'
import type { LocationCodeParts } from '@/lib/location'

//! no 'use server' here, an export would become a public action

export type LocationCreateRow = LocationCodeParts & {
  code: string
  name: string
  type: LocationType | null
  isActive: boolean
  isPalletAllowed: boolean
}

//* shared by single add, bulk generate and import
export async function createLocationRows(
  tx: Prisma.TransactionClient,
  { dbCode, userCode, rows }: { dbCode: string; userCode: number | null; rows: LocationCreateRow[] }
) {
  if (rows.length === 0) return { createdCount: 0, skippedCodes: [] as string[] }

  //* deleted rows count too, the unique key includes them
  const existing = await tx.location.findMany({ where: { dbCode, code: { in: rows.map((row) => row.code) } }, select: { code: true } })
  const existingCodes = new Set(existing.map((row) => row.code))

  const newRows = rows.filter((row) => !existingCodes.has(row.code))

  //* skipDuplicates covers a run that raced past the check
  const { count } = await tx.location.createMany({
    data: newRows.map((row) => ({
      ...row,
      levelCode: row.levelCode ?? null,
      rackCode: row.rackCode ?? null,
      dbCode,
      createdBy: userCode,
      updatedBy: userCode
    })),
    skipDuplicates: true
  })

  return { createdCount: count, skippedCodes: [...existingCodes] }
}
