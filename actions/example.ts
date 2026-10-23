'use server'

import { faker } from '@faker-js/faker'
import { logger } from '@/lib/logger'

import db from '@/lib/db'
import { action } from '@/lib/safe-action'
import { DataTableParams, dataTableParamsSchema } from '@/schema/data-table'
import { Prisma } from '@/prisma/generated/client'
import { DEFAULT_PAGINATION_PAGE_INDEX, DEFAULT_PAGINATION_PAGE_SIZE } from '@/constants/data-table'
import { buildColumnFiltersWhere, buildGlobalFilterWhere } from '@/lib/data-table'
import { PModels } from '@/types/prisma'

export async function getDataTableTestDataClientSide() {
  try {
    return db.dataTableTestData.findMany()
  } catch (err: any) {
    logger.error(err, err?.message || 'Something went wrong!')

    return []
  }
}

export async function getDataTableTestDataServerSide(params: DataTableParams) {
  const page = params?.page ?? DEFAULT_PAGINATION_PAGE_INDEX + 1
  const perPage = params?.perPage ?? DEFAULT_PAGINATION_PAGE_SIZE
  const offset = (page - 1) * perPage
  const globalFilter = params?.globalFilter ?? ''
  const sorting = params?.sorting ?? []
  const columnFilters = params?.columnFilters ?? []
  const isExport = params?.isExport ?? false

  const modelName: keyof PModels = 'DataTableTestData'

  //? NOTE: if status or column refers to an ID but not really the acual name, much better to do prisma extension to pre-process the data before running the query
  //? Can include nullable = true in numericFields and dateFields for buildColumnFiltersWhere to check is empty or not empty

  //* initialize where input
  const where: Prisma.DataTableTestDataWhereInput = {}

  //* global filter
  if (globalFilter) {
    const filter = buildGlobalFilterWhere<typeof modelName>(globalFilter, {
      stringFields: ['customer', 'email', 'status'],
      booleanFields: [{ field: 'isValid' }],
      numericFields: ['amount']
    })

    Object.assign(where, filter)
  }

  //* column filters
  if (columnFilters.length > 0) {
    const currentFilters = where.AND as Prisma.DataTableTestDataWhereInput[]

    const filters = buildColumnFiltersWhere<'DataTableTestData'>(columnFilters, {
      stringFields: ['customer', 'status'],
      booleanFields: [{ field: 'isValid' }],
      numericFields: [{ field: 'amount' }],
      dateFields: [{ field: 'createdAt' }]
    })

    where.AND = [...(currentFilters ?? []), ...filters]
  }

  console.dir({ params, where }, { depth: Infinity })

  //* initialize order input
  const orderBy: Prisma.DataTableTestDataOrderByWithRelationInput[] = sorting.map(({ id, desc }) => ({ [id]: desc ? 'desc' : 'asc' }))

  try {
    const [data, rowCount] = await db.$transaction([
      db.dataTableTestData.findMany({ where, ...(isExport ? {} : { skip: offset, take: perPage }), orderBy }),
      db.dataTableTestData.count({ where })
    ])

    return { data, rowCount }
  } catch (err: any) {
    logger.error(err, err?.message || 'Something went wrong!')
    return { data: [], rowCount: 0 }
  }
}

export const getDataTableTestDataClientSideClient = action.action(async () => getDataTableTestDataClientSide())

export const getDataTableTestDataServerSideClient = action
  .inputSchema(dataTableParamsSchema)
  .action(async ({ parsedInput }) => getDataTableTestDataServerSide(parsedInput))

export default async function seedDataTableTestData() {
  try {
    faker.seed(123)

    const result = Array.from({ length: 20_000 }, () => ({
      id: faker.string.alphanumeric(8),
      createdAt: faker.date.past(),
      customer: faker.person.fullName(),
      email: faker.internet.email(),
      status: faker.helpers.arrayElement(['pending', 'processing', 'success', 'failed']),
      amount: faker.number.int({
        min: 50,
        max: 1000
      }),
      isValid: faker.datatype.boolean(),
      link: faker.internet.url()
    }))

    await db.$transaction(async (tx) => {
      //* delete all DataTableTestData
      await tx.dataTableTestData.deleteMany()

      //* insert new DataTableTestData
      await tx.dataTableTestData.createMany({ data: result })
    })

    return { status: 200, message: 'Data Table Test Data seeded!', action: 'SEED_DATA_TABLE_TEST_DATA' }
  } catch (err: any) {
    logger.error(err, err?.message || 'Something went wrong!')

    return {
      status: 500,
      error: true,
      message: err?.message ?? 'Something went wrong!',
      action: 'SEED_DATA_TABLE_TEST_DATA'
    }
  }
}

export const seedDataTableTestDataClient = action.action(async () => seedDataTableTestData())
