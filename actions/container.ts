'use server'

import { action, authenticationMiddleware, tenantMiddleware } from '@/lib/safe-action'

import db from '@/lib/db'
import { Prisma } from '@/prisma/generated/client'
import { DataTableParams, dataTableParamsSchema } from '@/schema/data-table'
import { buildColumnFiltersWhere, buildGlobalFilterWhere, buildOrderBy, getDataTableParams } from '@/lib/data-table'
import { PModels } from '@/types/prisma'
import { codeParamsSchema } from '@/schema/common'
import { logger } from '@/lib/logger'
import { containerFormSchema, containerGenerateFormSchema, containerPrefixesSchema } from '@/schema/container'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { isUniqueConstraintError } from '@/lib/duplicate'
import { reserveSequence, previewSequenceValue } from '@/lib/sequence'
import { CONTAINER_SEQUENCE } from '@/lib/container-sequence'
import { formatContainerCode, getContainerPrefixParts } from '@/lib/container'
import { createId } from '@paralleldrive/cuid2'
import { diffActivity, logActivities, logActivity } from '@/lib/activity-log'
import { CONTAINER_ACTIVITY_CONFIG } from '@/lib/activity-configs/container'
import { FilterOption } from '@/types/data-table'

const COMMON_CONTAINER_INCLUDE = {
  projectCategory: true,
  customerProject: true,
  location: true,
  pallet: true
} satisfies Prisma.ContainerInclude

export type ContainerWithRelations = Prisma.ContainerGetPayload<{ include: typeof COMMON_CONTAINER_INCLUDE }>

type ContainerRefs = {
  locationCode?: string | null
  palletCode?: string | null
  isGeneralPurpose: boolean
  projectCategoryCode?: string | null
  customerProjectCode?: string | null
}

export async function getContainerByCode(dbCode: string | null, code?: string | null) {
  if (!dbCode || !code) return null

  try {
    return await db.container.findFirst({ where: { dbCode, code, deletedAt: null }, include: COMMON_CONTAINER_INCLUDE })
  } catch (err: any) {
    logger.error(err, '[GET_CONTAINER_BY_CODE_ERROR]:')
    return null
  }
}

//* list filter only, every live container so old rows can be found
export async function getContainerOptions(dbCode: string | null): Promise<FilterOption[]> {
  if (!dbCode) return []

  try {
    const containers = await db.container.findMany({ where: { dbCode, deletedAt: null }, select: { code: true }, orderBy: { code: 'asc' } })

    return containers.map((container) => ({ label: container.code, value: container.code }))
  } catch (err: any) {
    logger.error(err, '[GET_CONTAINER_OPTIONS_ERROR]:')
    return []
  }
}

//* live rows only, ordered by code, missing ids drop out
export async function getContainersByIds(dbCode: string, ids: string[]) {
  try {
    return await db.container.findMany({ where: { dbCode, id: { in: ids }, deletedAt: null }, orderBy: { code: 'asc' } })
  } catch (err: any) {
    logger.error(err, '[GET_CONTAINERS_BY_IDS_ERROR]:')
    return []
  }
}

export async function getDataTableContainersSvr(dbCode: string, params: DataTableParams) {
  const { perPage, offset, globalFilter, sorting, columnFilters, isExport, isShowDeleted } = getDataTableParams(params)

  const modelName: keyof PModels = 'Container'

  //* initialize where input
  const where: Prisma.ContainerWhereInput = { dbCode, ...(isShowDeleted ? {} : { deletedAt: null }) }

  //* global filter, status and type are enums so contains would fail
  if (globalFilter) {
    const filter = buildGlobalFilterWhere<typeof modelName>(globalFilter, {
      stringFields: ['code', 'projectCategoryCode', 'customerProjectCode', 'locationCode', 'palletCode'],
      booleanFields: [{ field: 'isGeneralPurpose' }]
    })

    Object.assign(where, filter)
  }

  //* column filters
  if (columnFilters.length > 0) {
    const currentFilters = where.AND as Prisma.ContainerWhereInput[]

    const filters = buildColumnFiltersWhere<typeof modelName>(columnFilters, {
      stringFields: [
        'status',
        'type',
        { field: 'projectCategoryCode', nullable: true },
        { field: 'customerProjectCode', nullable: true },
        'locationCode',
        { field: 'palletCode', nullable: true }
      ],
      booleanFields: [{ field: 'isGeneralPurpose' }],
      dateFields: [{ field: 'lastCycleCount' }, { field: 'createdAt' }, { field: 'updatedAt' }]
    })

    where.AND = [...(currentFilters ?? []), ...filters]
  }

  //* initialize order input
  const orderBy: Prisma.ContainerOrderByWithRelationInput[] = buildOrderBy<typeof modelName>(sorting)

  try {
    const [data, rowCount] = await db.$transaction([
      db.container.findMany({ where, include: COMMON_CONTAINER_INCLUDE, ...(isExport ? {} : { skip: offset, take: perPage }), orderBy }),
      db.container.count({ where })
    ])

    return { data, rowCount }
  } catch (err: any) {
    logger.error(err, '[GET_DATA_TABLE_CONTAINERS_ERROR]:')
    return { data: [], rowCount: 0 }
  }
}

export const getDataTableContainersSvrClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(dataTableParamsSchema)
  .action(async ({ ctx, parsedInput }) => {
    //* view only, label select all goes through isExport and must not need export
    if (!ctx.ability?.can(PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.CONTAINERS)) return { data: [], rowCount: 0 }
    return getDataTableContainersSvr(ctx.dbCode, parsedInput)
  })

//* every container rule in one place, gives an error or each ref's location
//* the location decides, a pallet is optional and must already sit there
//* generate passes one location for all its lines
async function validateContainerRefs(
  dbCode: string,
  refs: ContainerRefs[],
  headerLocationCode?: string
): Promise<{ error: string } | { locationCodes: string[] }> {
  const projects = refs.filter((ref) => !ref.isGeneralPurpose)
  const palletCodes = [...new Set(refs.flatMap((ref) => (ref.palletCode ? [ref.palletCode] : [])))]
  const categoryCodes = [...new Set(projects.map((ref) => ref.projectCategoryCode ?? ''))]
  const projectCodes = [...new Set(projects.map((ref) => ref.customerProjectCode ?? ''))]
  const locationCodes = [...new Set(refs.map((ref) => headerLocationCode ?? ref.locationCode ?? ''))]

  //! reloaded on save, the picker the user saw may be stale
  const [pallets, categories, customerProjects, locations] = await Promise.all([
    db.pallet.findMany({
      where: { dbCode, code: { in: palletCodes }, deletedAt: null },
      select: { code: true, status: true, locationCode: true, isGeneralPurpose: true, projectCategoryCode: true, customerProjectCode: true }
    }),
    db.projectCategory.findMany({
      where: { dbCode, code: { in: categoryCodes }, deletedAt: null, isActive: true },
      select: { code: true }
    }),
    db.customerProject.findMany({
      where: { dbCode, code: { in: projectCodes }, deletedAt: null, isActive: true },
      select: { code: true, categoryCode: true }
    }),
    db.location.findMany({
      where: { dbCode, code: { in: locationCodes }, deletedAt: null, isActive: true },
      select: { code: true, isPalletAllowed: true }
    })
  ])

  const resolved: string[] = []

  for (const ref of refs) {
    const locationCode = headerLocationCode ?? ref.locationCode
    const location = locations.find((row) => row.code === locationCode)

    //! deleted or inactive since the picker loaded
    if (!location) return { error: 'Location is not available!' }

    if (!ref.isGeneralPurpose) {
      if (!categories.some((row) => row.code === ref.projectCategoryCode)) {
        return { error: `Project category ${ref.projectCategoryCode} is not available!` }
      }

      const project = customerProjects.find((row) => row.code === ref.customerProjectCode)

      if (!project) return { error: `Customer project ${ref.customerProjectCode} is not available!` }

      //! a crafted request could pair a project with another category
      if (project.categoryCode !== ref.projectCategoryCode) {
        return { error: `Customer project ${ref.customerProjectCode} does not belong to ${ref.projectCategoryCode}!` }
      }
    }

    if (ref.palletCode) {
      //! a crafted request could send a pallet for a location that doesn't take pallets
      if (!location.isPalletAllowed) return { error: `Location ${location.code} does not allow pallets!` }

      const pallet = pallets.find((row) => row.code === ref.palletCode)

      //! deleted or no longer active since the picker loaded
      if (!pallet || pallet.status !== 'ACTIVE') return { error: `Pallet ${ref.palletCode} is not available!` }

      //! a crafted request could put a project container on another project's pallet
      if (
        !ref.isGeneralPurpose &&
        (pallet.projectCategoryCode !== ref.projectCategoryCode || pallet.customerProjectCode !== ref.customerProjectCode)
      ) {
        return { error: `Pallet ${ref.palletCode} belongs to another project!` }
      }

      //! a crafted request could put a general purpose container on a project pallet
      if (ref.isGeneralPurpose && !pallet.isGeneralPurpose) {
        return { error: `Pallet ${ref.palletCode} belongs to a project!` }
      }

      //! the pallet may have moved since the picker loaded
      if (pallet.locationCode !== location.code) return { error: `Pallet ${ref.palletCode} is not at ${location.code}!` }
    }

    resolved.push(location.code)
  }

  return { locationCodes: resolved }
}

//* the stored fields, general purpose keeps no project
const toContainerProject = (ref: ContainerRefs) => ({
  isGeneralPurpose: ref.isGeneralPurpose,
  projectCategoryCode: ref.isGeneralPurpose ? null : ref.projectCategoryCode,
  customerProjectCode: ref.isGeneralPurpose ? null : ref.customerProjectCode,
  palletCode: ref.palletCode || null
})

export const upsertContainer = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(containerFormSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { id, status, type, ...refs } = parsedInput
    const { dbCode, userCode, ability } = ctx
    const actionTag = 'UPSERT_CONTAINER'
    const isCreate = !id

    const requiredAction = isCreate ? PERMISSIONS_ALLOWED_ACTIONS.CREATE : PERMISSIONS_ALLOWED_ACTIONS.EDIT

    if (!ability?.can(requiredAction, PERMISSIONS_CODES.CONTAINERS)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      //* update container
      if (!isCreate) {
        const existing = await db.container.findFirst({ where: { id, dbCode, deletedAt: null } })

        if (!existing) return { status: 404, error: true, message: 'Container not found!', action: actionTag }

        //! edit writes status only, the rest is locked after save
        const container = await db.$transaction(async (tx) => {
          const updated = await tx.container.update({ where: { id }, data: { status, updatedBy: userCode } })

          await logActivity(tx, {
            actor: ctx.actor,
            module: 'CONTAINERS',
            action: 'UPDATE',
            dbCode,
            entity: { id: updated.id, code: updated.code },
            changes: diffActivity(CONTAINER_ACTIVITY_CONFIG, existing, updated)
          })

          return updated
        })

        return { status: 200, error: false, message: 'Container updated successfully!', action: actionTag, data: { container } }
      }

      const result = await validateContainerRefs(dbCode, [refs])

      if ('error' in result) return { status: 400, error: true, message: result.error, action: actionTag }

      //* create container, the number is taken in the same transaction
      const container = await db.$transaction(async (tx) => {
        const { scope, first } = await reserveSequence(tx, CONTAINER_SEQUENCE, { prefixParts: getContainerPrefixParts(refs) }, 1)

        const created = await tx.container.create({
          data: {
            dbCode,
            code: formatContainerCode(scope, first),
            locationCode: result.locationCodes[0],
            type,
            status: 'ACTIVE',
            ...toContainerProject(refs),
            createdBy: userCode,
            updatedBy: userCode
          }
        })

        await logActivity(tx, {
          actor: ctx.actor,
          module: 'CONTAINERS',
          action: 'CREATE',
          dbCode,
          entity: { id: created.id, code: created.code },
          changes: diffActivity(CONTAINER_ACTIVITY_CONFIG, null, created)
        })

        return created
      })

      return {
        status: 200,
        error: false,
        message: `Container ${container.code} created successfully!`,
        action: actionTag,
        data: { container }
      }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      if (isUniqueConstraintError(err)) {
        return { status: 409, error: true, message: 'Code already exists!', action: actionTag }
      }

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })

export const generateContainers = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(containerGenerateFormSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { locationCode, lines } = parsedInput
    const { dbCode, userCode, ability } = ctx
    const actionTag = 'GENERATE_CONTAINERS'

    if (!ability?.can(PERMISSIONS_ALLOWED_ACTIONS.CREATE, PERMISSIONS_CODES.CONTAINERS)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      const result = await validateContainerRefs(dbCode, lines, locationCode)

      if ('error' in result) return { status: 400, error: true, message: result.error, action: actionTag }

      const codes = await db.$transaction(
        async (tx) => {
          const rows: Prisma.ContainerCreateManyInput[] = []

          //* lines in order, so a repeated prefix keeps counting
          for (const [lineIndex, line] of lines.entries()) {
            const { scope, first } = await reserveSequence(
              tx,
              CONTAINER_SEQUENCE,
              { prefixParts: getContainerPrefixParts(line) },
              line.quantity
            )

            for (let index = 0; index < line.quantity; index++) {
              rows.push({
                dbCode,
                code: formatContainerCode(scope, first + index),
                locationCode: result.locationCodes[lineIndex],
                type: line.type,
                status: 'ACTIVE',
                ...toContainerProject(line),
                createdBy: userCode,
                updatedBy: userCode
              })
            }
          }

          await tx.container.createMany({ data: rows })

          const created = await tx.container.findMany({ where: { dbCode, code: { in: rows.map((row) => row.code) } } })
          const batchId = createId()

          //* one row per container, then one summary for the run
          await logActivities(tx, [
            ...created.map((container) => ({
              actor: ctx.actor,
              module: 'CONTAINERS' as const,
              action: 'CREATE' as const,
              dbCode,
              batchId,
              summary: 'Created by bulk generate',
              entity: { id: container.id, code: container.code },
              changes: diffActivity(CONTAINER_ACTIVITY_CONFIG, null, container)
            })),
            {
              actor: ctx.actor,
              module: 'CONTAINERS' as const,
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

      return { status: 200, error: false, message: `${codes.length} containers created!`, action: actionTag, data: { codes } }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      if (isUniqueConstraintError(err)) {
        return { status: 409, error: true, message: 'A container code already exists, try again!', action: actionTag }
      }

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })

//* next number and scope per prefix, e.g. { scope: BB-SNAP-26J, value: 11 }
export const previewContainerCodesClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(containerPrefixesSchema)
  .action(async ({ parsedInput }) => {
    try {
      //* same order as sent, the month in each scope comes from the server
      return await Promise.all(parsedInput.prefixes.map((prefixParts) => previewSequenceValue(CONTAINER_SEQUENCE, { prefixParts })))
    } catch (err: any) {
      logger.error(err, '[PREVIEW_CONTAINER_CODES_ERROR]:')
      return []
    }
  })

export const deleteContainer = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(codeParamsSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { dbCode, userCode, ability } = ctx
    const actionTag = 'DELETE_CONTAINER'

    if (!ability?.can(PERMISSIONS_ALLOWED_ACTIONS.DELETE, PERMISSIONS_CODES.CONTAINERS)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      const container = await db.container.findFirst({ where: { dbCode, code: parsedInput.code, deletedAt: null } })

      if (!container) return { status: 404, error: true, message: 'Container not found!', action: actionTag }

      await db.$transaction(async (tx) => {
        await tx.container.update({ where: { id: container.id }, data: { deletedAt: new Date(), deletedBy: userCode } })
        await logActivity(tx, {
          actor: ctx.actor,
          module: 'CONTAINERS',
          action: 'DELETE',
          dbCode,
          entity: { id: container.id, code: container.code }
        })
      })

      return { status: 200, error: false, message: 'Container deleted successfully!', action: actionTag }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })

export const restoreContainer = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(codeParamsSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { dbCode, userCode, ability } = ctx
    const actionTag = 'RESTORE_CONTAINER'

    if (!ability?.can(PERMISSIONS_ALLOWED_ACTIONS.RESTORE, PERMISSIONS_CODES.CONTAINERS)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      const container = await db.container.findFirst({ where: { dbCode, code: parsedInput.code }, include: COMMON_CONTAINER_INCLUDE })

      if (!container) return { status: 404, error: true, message: 'Container not found!', action: actionTag }

      //! a live container on a deleted parent is not allowed
      if (container.location.deletedAt) return { status: 409, error: true, message: 'Restore the location first!', action: actionTag }
      if (container.pallet?.deletedAt) return { status: 409, error: true, message: 'Restore the pallet first!', action: actionTag }

      //! the location or pallet may have changed since the container was deleted
      if (!container.location.isActive) return { status: 409, error: true, message: 'The location is inactive!', action: actionTag }
      if (container.pallet && container.pallet.status !== 'ACTIVE') {
        return { status: 409, error: true, message: 'The pallet is no longer active!', action: actionTag }
      }
      if (container.pallet && container.pallet.locationCode !== container.locationCode) {
        return { status: 409, error: true, message: 'The pallet has moved to another location!', action: actionTag }
      }
      if (container.projectCategory?.deletedAt) {
        return { status: 409, error: true, message: 'Restore the project category first!', action: actionTag }
      }
      if (container.customerProject?.deletedAt) {
        return { status: 409, error: true, message: 'Restore the customer project first!', action: actionTag }
      }

      await db.$transaction(async (tx) => {
        await tx.container.update({ where: { id: container.id }, data: { deletedAt: null, deletedBy: null, updatedBy: userCode } })
        await logActivity(tx, {
          actor: ctx.actor,
          module: 'CONTAINERS',
          action: 'RESTORE',
          dbCode,
          entity: { id: container.id, code: container.code }
        })
      })

      return { status: 200, error: false, message: 'Container restored successfully!', action: actionTag }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })
