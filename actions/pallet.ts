'use server'

import { action, authenticationMiddleware, tenantMiddleware } from '@/lib/safe-action'

import db from '@/lib/db'
import { Prisma } from '@/prisma/generated/client'
import { DataTableParams, dataTableParamsSchema } from '@/schema/data-table'
import { buildColumnFiltersWhere, buildGlobalFilterWhere, buildOrderBy, getDataTableParams } from '@/lib/data-table'
import { PModels } from '@/types/prisma'
import { codeParamsSchema } from '@/schema/common'
import { logger } from '@/lib/logger'
import { palletFormSchema, palletGenerateFormSchema, palletPrefixesSchema } from '@/schema/pallet'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { isUniqueConstraintError } from '@/lib/duplicate'
import { reserveSequence, previewSequenceValue } from '@/lib/sequence'
import { PALLET_SEQUENCE } from '@/lib/pallet-sequence'
import { formatPalletCode, getPalletPrefixParts } from '@/lib/pallet'
import { FilterOption } from '@/types/data-table'
import { createId } from '@paralleldrive/cuid2'
import { diffActivity, logActivities, logActivity } from '@/lib/activity-log'
import { PALLET_ACTIVITY_CONFIG } from '@/lib/activity-configs/pallet'

const COMMON_PALLET_INCLUDE = { projectCategory: true, customerProject: true, location: true } satisfies Prisma.PalletInclude

export type PalletWithRelations = Prisma.PalletGetPayload<{ include: typeof COMMON_PALLET_INCLUDE }>

type PalletRefs = {
  locationCode: string
  isGeneralPurpose: boolean
  projectCategoryCode?: string | null
  customerProjectCode?: string | null
}

export async function getPalletByCode(dbCode: string | null, code?: string | null) {
  if (!dbCode || !code) return null

  try {
    return await db.pallet.findFirst({ where: { dbCode, code, deletedAt: null }, include: COMMON_PALLET_INCLUDE })
  } catch (err: any) {
    logger.error(err, '[GET_PALLET_BY_CODE_ERROR]:')
    return null
  }
}

//* list filter only, every live pallet so old rows can be found
export async function getPalletOptions(dbCode: string | null): Promise<FilterOption[]> {
  if (!dbCode) return []

  try {
    const pallets = await db.pallet.findMany({ where: { dbCode, deletedAt: null }, select: { code: true }, orderBy: { code: 'asc' } })

    return pallets.map((pallet) => ({ label: pallet.code, value: pallet.code }))
  } catch (err: any) {
    logger.error(err, '[GET_PALLET_OPTIONS_ERROR]:')
    return []
  }
}

//* live active pallets, for the container pickers
export async function getActivePallets(dbCode: string | null) {
  if (!dbCode) return []

  try {
    return await db.pallet.findMany({
      where: { dbCode, deletedAt: null, status: 'ACTIVE' },
      select: { code: true, locationCode: true, isGeneralPurpose: true, projectCategoryCode: true, customerProjectCode: true },
      orderBy: { code: 'asc' }
    })
  } catch (err: any) {
    logger.error(err, '[GET_ACTIVE_PALLETS_ERROR]:')
    return []
  }
}

export const getActivePalletsClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .action(async ({ ctx }) => getActivePallets(ctx.dbCode))

//* live rows only, ordered by code, missing ids drop out
export async function getPalletsByIds(dbCode: string, ids: string[]) {
  try {
    return await db.pallet.findMany({ where: { dbCode, id: { in: ids }, deletedAt: null }, orderBy: { code: 'asc' } })
  } catch (err: any) {
    logger.error(err, '[GET_PALLETS_BY_IDS_ERROR]:')
    return []
  }
}

export async function getDataTablePalletsSvr(dbCode: string, params: DataTableParams) {
  const { perPage, offset, globalFilter, sorting, columnFilters, isExport, isShowDeleted } = getDataTableParams(params)

  const modelName: keyof PModels = 'Pallet'

  //* initialize where input
  const where: Prisma.PalletWhereInput = { dbCode, ...(isShowDeleted ? {} : { deletedAt: null }) }

  //* global filter, status is an enum so contains would fail
  if (globalFilter) {
    const filter = buildGlobalFilterWhere<typeof modelName>(globalFilter, {
      stringFields: ['code', 'projectCategoryCode', 'customerProjectCode', 'locationCode'],
      booleanFields: [{ field: 'isGeneralPurpose' }]
    })

    Object.assign(where, filter)
  }

  //* column filters
  if (columnFilters.length > 0) {
    const currentFilters = where.AND as Prisma.PalletWhereInput[]

    const filters = buildColumnFiltersWhere<typeof modelName>(columnFilters, {
      stringFields: [
        'status',
        { field: 'projectCategoryCode', nullable: true },
        { field: 'customerProjectCode', nullable: true },
        'locationCode'
      ],
      booleanFields: [{ field: 'isGeneralPurpose' }],
      dateFields: [{ field: 'lastCycleCount' }, { field: 'createdAt' }, { field: 'updatedAt' }]
    })

    where.AND = [...(currentFilters ?? []), ...filters]
  }

  //* initialize order input
  const orderBy: Prisma.PalletOrderByWithRelationInput[] = buildOrderBy<typeof modelName>(sorting)

  try {
    const [data, rowCount] = await db.$transaction([
      db.pallet.findMany({ where, include: COMMON_PALLET_INCLUDE, ...(isExport ? {} : { skip: offset, take: perPage }), orderBy }),
      db.pallet.count({ where })
    ])

    return { data, rowCount }
  } catch (err: any) {
    logger.error(err, '[GET_DATA_TABLE_PALLETS_ERROR]:')
    return { data: [], rowCount: 0 }
  }
}

export const getDataTablePalletsSvrClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(dataTableParamsSchema)
  .action(async ({ ctx, parsedInput }) => {
    //* view only, label select all goes through isExport and must not need export
    if (!ctx.ability?.can(PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.PALLETS)) return { data: [], rowCount: 0 }
    return getDataTablePalletsSvr(ctx.dbCode, parsedInput)
  })

//* a message when a reference is unusable, null when all are fine
async function validatePalletRefs(dbCode: string, refs: PalletRefs[]) {
  const locationCodes = [...new Set(refs.map((ref) => ref.locationCode))]
  const projects = refs.filter((ref) => !ref.isGeneralPurpose)
  const categoryCodes = [...new Set(projects.map((ref) => ref.projectCategoryCode ?? ''))]
  const projectCodes = [...new Set(projects.map((ref) => ref.customerProjectCode ?? ''))]

  const [locations, categories, customerProjects] = await Promise.all([
    db.location.findMany({
      where: { dbCode, code: { in: locationCodes }, deletedAt: null, isActive: true, isPalletAllowed: true },
      select: { code: true }
    }),
    db.projectCategory.findMany({
      where: { dbCode, code: { in: categoryCodes }, deletedAt: null, isActive: true },
      select: { code: true }
    }),
    db.customerProject.findMany({
      where: { dbCode, code: { in: projectCodes }, deletedAt: null, isActive: true },
      select: { code: true, categoryCode: true }
    })
  ])

  if (locationCodes.some((code) => !locations.some((row) => row.code === code))) return 'Pick a location that allows pallets!'

  for (const ref of projects) {
    if (!categories.some((row) => row.code === ref.projectCategoryCode))
      return `Project category ${ref.projectCategoryCode} is not available!`

    const project = customerProjects.find((row) => row.code === ref.customerProjectCode)

    if (!project) return `Customer project ${ref.customerProjectCode} is not available!`

    //! a crafted request could pair a project with another category
    if (project.categoryCode !== ref.projectCategoryCode) {
      return `Customer project ${ref.customerProjectCode} does not belong to ${ref.projectCategoryCode}!`
    }
  }

  return null
}

//* the stored fields, general purpose keeps no project
const toPalletProject = (ref: Omit<PalletRefs, 'locationCode'>) => ({
  isGeneralPurpose: ref.isGeneralPurpose,
  projectCategoryCode: ref.isGeneralPurpose ? null : ref.projectCategoryCode,
  customerProjectCode: ref.isGeneralPurpose ? null : ref.customerProjectCode
})

export const upsertPallet = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(palletFormSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { id, status, locationCode, ...project } = parsedInput
    const { dbCode, userCode, ability } = ctx
    const actionTag = 'UPSERT_PALLET'
    const isCreate = !id

    const requiredAction = isCreate ? PERMISSIONS_ALLOWED_ACTIONS.CREATE : PERMISSIONS_ALLOWED_ACTIONS.EDIT

    if (!ability?.can(requiredAction, PERMISSIONS_CODES.PALLETS)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      //* update pallet
      if (!isCreate) {
        const existing = await db.pallet.findFirst({ where: { id, dbCode, deletedAt: null } })

        if (!existing) return { status: 404, error: true, message: 'Pallet not found!', action: actionTag }

        //! a pallet holding containers stays active, move them off first
        if (status !== 'ACTIVE' && status !== existing.status) {
          const containerCount = await db.container.count({ where: { dbCode, palletCode: existing.code, deletedAt: null } })

          if (containerCount > 0) {
            return { status: 409, error: true, message: 'Pallet has containers on it, move them off first!', action: actionTag }
          }
        }

        //! edit writes status only, the rest is locked after save
        const pallet = await db.$transaction(async (tx) => {
          const result = await tx.pallet.update({ where: { id }, data: { status, updatedBy: userCode } })

          await logActivity(tx, {
            actor: ctx.actor,
            module: 'PALLETS',
            action: 'UPDATE',
            dbCode,
            entity: { id: result.id, code: result.code },
            changes: diffActivity(PALLET_ACTIVITY_CONFIG, existing, result)
          })

          return result
        })

        return { status: 200, error: false, message: 'Pallet updated successfully!', action: actionTag, data: { pallet } }
      }

      const refError = await validatePalletRefs(dbCode, [{ locationCode, ...project }])

      if (refError) return { status: 400, error: true, message: refError, action: actionTag }

      //* create pallet, the number is taken in the same transaction
      const pallet = await db.$transaction(async (tx) => {
        const { scope, first } = await reserveSequence(tx, PALLET_SEQUENCE, { prefixParts: getPalletPrefixParts(project) }, 1)

        const result = await tx.pallet.create({
          data: {
            dbCode,
            code: formatPalletCode(scope, first),
            locationCode,
            status: 'ACTIVE',
            ...toPalletProject(project),
            createdBy: userCode,
            updatedBy: userCode
          }
        })

        await logActivity(tx, {
          actor: ctx.actor,
          module: 'PALLETS',
          action: 'CREATE',
          dbCode,
          entity: { id: result.id, code: result.code },
          changes: diffActivity(PALLET_ACTIVITY_CONFIG, null, result)
        })

        return result
      })

      return { status: 200, error: false, message: `Pallet ${pallet.code} created successfully!`, action: actionTag, data: { pallet } }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      if (isUniqueConstraintError(err)) {
        return { status: 409, error: true, message: 'Code already exists!', action: actionTag }
      }

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })

export const generatePallets = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(palletGenerateFormSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { locationCode, lines } = parsedInput
    const { dbCode, userCode, ability } = ctx
    const actionTag = 'GENERATE_PALLETS'

    if (!ability?.can(PERMISSIONS_ALLOWED_ACTIONS.CREATE, PERMISSIONS_CODES.PALLETS)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      const refError = await validatePalletRefs(
        dbCode,
        lines.map((line) => ({ locationCode, ...line }))
      )

      if (refError) return { status: 400, error: true, message: refError, action: actionTag }

      const codes = await db.$transaction(
        async (tx) => {
          const rows: Prisma.PalletCreateManyInput[] = []

          //* lines in order, so a repeated prefix keeps counting
          for (const line of lines) {
            const { scope, first } = await reserveSequence(tx, PALLET_SEQUENCE, { prefixParts: getPalletPrefixParts(line) }, line.quantity)

            for (let index = 0; index < line.quantity; index++) {
              rows.push({
                dbCode,
                code: formatPalletCode(scope, first + index),
                locationCode,
                status: 'ACTIVE',
                ...toPalletProject(line),
                createdBy: userCode,
                updatedBy: userCode
              })
            }
          }

          await tx.pallet.createMany({ data: rows })

          const created = await tx.pallet.findMany({ where: { dbCode, code: { in: rows.map((row) => row.code) } } })
          const batchId = createId()

          //* one row per pallet, then one summary for the run
          await logActivities(tx, [
            ...created.map((pallet) => ({
              actor: ctx.actor,
              module: 'PALLETS' as const,
              action: 'CREATE' as const,
              dbCode,
              batchId,
              summary: 'Created by bulk generate',
              entity: { id: pallet.id, code: pallet.code },
              changes: diffActivity(PALLET_ACTIVITY_CONFIG, null, pallet)
            })),
            {
              actor: ctx.actor,
              module: 'PALLETS' as const,
              action: 'BULK_CREATE' as const,
              dbCode,
              batchId,
              changes: { fields: [], meta: { created: created.length } }
            }
          ])

          return rows.map((row) => row.code)
        },
        { timeout: 30000 }
      )

      return { status: 200, error: false, message: `${codes.length} pallets created!`, action: actionTag, data: { codes } }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      if (isUniqueConstraintError(err)) {
        return { status: 409, error: true, message: 'A pallet code already exists, try again!', action: actionTag }
      }

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })

//* next number and scope per prefix, e.g. { scope: BB-SNAP-26J, value: 11 }
export const previewPalletCodesClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(palletPrefixesSchema)
  .action(async ({ parsedInput }) => {
    try {
      //* same order as sent, the month in each scope comes from the server
      return await Promise.all(parsedInput.prefixes.map((prefixParts) => previewSequenceValue(PALLET_SEQUENCE, { prefixParts })))
    } catch (err: any) {
      logger.error(err, '[PREVIEW_PALLET_CODES_ERROR]:')
      return []
    }
  })

export const deletePallet = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(codeParamsSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { dbCode, userCode, ability } = ctx
    const actionTag = 'DELETE_PALLET'

    if (!ability?.can(PERMISSIONS_ALLOWED_ACTIONS.DELETE, PERMISSIONS_CODES.PALLETS)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      const pallet = await db.pallet.findFirst({ where: { dbCode, code: parsedInput.code, deletedAt: null } })

      if (!pallet) return { status: 404, error: true, message: 'Pallet not found!', action: actionTag }

      //! live containers on this pallet would lose their pallet
      const containerCount = await db.container.count({ where: { dbCode, palletCode: pallet.code, deletedAt: null } })

      if (containerCount > 0) {
        return { status: 409, error: true, message: 'Pallet is in use by containers!', action: actionTag }
      }

      await db.$transaction(async (tx) => {
        await tx.pallet.update({ where: { id: pallet.id }, data: { deletedAt: new Date(), deletedBy: userCode } })
        await logActivity(tx, {
          actor: ctx.actor,
          module: 'PALLETS',
          action: 'DELETE',
          dbCode,
          entity: { id: pallet.id, code: pallet.code }
        })
      })

      return { status: 200, error: false, message: 'Pallet deleted successfully!', action: actionTag }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })

export const restorePallet = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(codeParamsSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { dbCode, userCode, ability } = ctx
    const actionTag = 'RESTORE_PALLET'

    if (!ability?.can(PERMISSIONS_ALLOWED_ACTIONS.RESTORE, PERMISSIONS_CODES.PALLETS)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      const pallet = await db.pallet.findFirst({ where: { dbCode, code: parsedInput.code }, include: COMMON_PALLET_INCLUDE })

      if (!pallet) return { status: 404, error: true, message: 'Pallet not found!', action: actionTag }

      //! a live pallet on a deleted parent is not allowed
      if (pallet.location.deletedAt) return { status: 409, error: true, message: 'Restore the location first!', action: actionTag }

      //! the location may have changed since the pallet was deleted
      if (!pallet.location.isActive) return { status: 409, error: true, message: 'The location is inactive!', action: actionTag }
      if (!pallet.location.isPalletAllowed) {
        return { status: 409, error: true, message: 'The location no longer allows pallets!', action: actionTag }
      }

      if (pallet.projectCategory?.deletedAt) {
        return { status: 409, error: true, message: 'Restore the project category first!', action: actionTag }
      }
      if (pallet.customerProject?.deletedAt) {
        return { status: 409, error: true, message: 'Restore the customer project first!', action: actionTag }
      }

      await db.$transaction(async (tx) => {
        await tx.pallet.update({ where: { id: pallet.id }, data: { deletedAt: null, deletedBy: null, updatedBy: userCode } })
        await logActivity(tx, {
          actor: ctx.actor,
          module: 'PALLETS',
          action: 'RESTORE',
          dbCode,
          entity: { id: pallet.id, code: pallet.code }
        })
      })

      return { status: 200, error: false, message: 'Pallet restored successfully!', action: actionTag }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })
