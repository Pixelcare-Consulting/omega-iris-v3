'use server'

import { action, authenticationMiddleware, tenantMiddleware } from '@/lib/safe-action'
import db from '@/lib/db'
import { Prisma } from '@/prisma/generated/client'
import { buildColumnFiltersWhere, buildGlobalFilterWhere, buildOrderBy, getDataTableParams } from '@/lib/data-table'
import { PModels } from '@/types/prisma'
import { logger } from '@/lib/logger'
import { nextSequence } from '@/lib/sequence'
import { BP_ADDRESS_SEQUENCE, BP_CONTACT_PERSON_SEQUENCE, BP_MASTER_SEQUENCES } from '@/lib/bp-master'
import { getCountryName, getStateName } from '@/actions/country-state'
import {
  bpMasterCodeParamsSchema,
  bpMasterFormSchema,
  BpMasterTableParams,
  bpMasterTableParamsSchema,
  isSameName
} from '@/schema/bp-master'
import { PERMISSIONS_ALLOWED_ACTIONS } from '@/constants/permission'
import { BP_MASTER_CONFIG, BpMasterType } from '@/constants/bp-master'
import { findSameText, isUniqueConstraintError, toDuplicateMessage } from '@/lib/duplicate'

const BY_CODE = { orderBy: { code: 'asc' } } as const

const COMMON_BP_MASTER_INCLUDE = {
  addresses: BY_CODE,
  contacts: BY_CODE
} satisfies Prisma.BpMasterInclude

export type BpMasterWithRelations = Prisma.BpMasterGetPayload<{ include: typeof COMMON_BP_MASTER_INCLUDE }>

export async function getBpMasterByCode(dbCode: string | null, type: BpMasterType, code?: string | null) {
  if (!dbCode || !code) return null

  try {
    //* the type check makes /vendors/C00001 a 404
    return await db.bpMaster.findFirst({ where: { dbCode, type, code, deletedAt: null }, include: COMMON_BP_MASTER_INCLUDE })
  } catch (err: any) {
    logger.error(err, '[GET_BP_MASTER_BY_CODE_ERROR]:')
    return null
  }
}

export async function getDataTableBpMastersSvr(dbCode: string, params: BpMasterTableParams) {
  const { perPage, offset, globalFilter, sorting, columnFilters, isExport, isShowDeleted } = getDataTableParams(params)

  const modelName: keyof PModels = 'BpMaster'

  //* initialize where input
  const where: Prisma.BpMasterWhereInput = { dbCode, type: params.type, ...(isShowDeleted ? {} : { deletedAt: null }) }

  //* global filter
  if (globalFilter) {
    const filter = buildGlobalFilterWhere<typeof modelName>(globalFilter, { stringFields: ['code', 'name'] })

    Object.assign(where, filter)
  }

  //* column filters
  if (columnFilters.length > 0) {
    const currentFilters = where.AND as Prisma.BpMasterWhereInput[]

    const filters = buildColumnFiltersWhere<typeof modelName>(columnFilters, {
      dateFields: [{ field: 'createdAt' }, { field: 'updatedAt' }]
    })

    where.AND = [...(currentFilters ?? []), ...filters]
  }

  //* initialize order input
  const orderBy: Prisma.BpMasterOrderByWithRelationInput[] = buildOrderBy<typeof modelName>(sorting)

  try {
    const [data, rowCount] = await db.$transaction([
      db.bpMaster.findMany({
        where,
        ...(isExport ? {} : { skip: offset, take: perPage }),
        orderBy
      }),
      db.bpMaster.count({ where })
    ])

    return { data, rowCount }
  } catch (err: any) {
    logger.error(err, '[GET_DATA_TABLE_BP_MASTERS_ERROR]:')
    return { data: [], rowCount: 0 }
  }
}

export const getDataTableBpMastersSvrClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(bpMasterTableParamsSchema)
  .action(async ({ ctx, parsedInput }) => {
    if (!ctx.ability?.can(PERMISSIONS_ALLOWED_ACTIONS.VIEW, BP_MASTER_CONFIG[parsedInput.type].permission)) {
      return { data: [], rowCount: 0 }
    }

    return getDataTableBpMastersSvr(ctx.dbCode, parsedInput)
  })

export const upsertBpMaster = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(bpMasterFormSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { id, type, name, addresses, contacts, defaultBillingName, defaultShippingName, defaultContactName } = parsedInput
    const { dbCode, userCode, ability } = ctx
    const { label, permission } = BP_MASTER_CONFIG[type]
    const actionTag = 'UPSERT_BP_MASTER'
    const isCreate = !id

    const requiredAction = isCreate ? PERMISSIONS_ALLOWED_ACTIONS.CREATE : PERMISSIONS_ALLOWED_ACTIONS.EDIT

    if (!ability?.can(requiredAction, permission)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      //! runs before nextSequence, a failed check uses up no code
      const sameNames = await db.bpMaster.findMany({
        where: { dbCode, type, name: { equals: name, mode: 'insensitive' }, ...(id && { NOT: { id } }) }
      })

      const existingName = findSameText(sameNames, (row) => row.name, name)

      if (existingName) {
        const message = toDuplicateMessage('Name', existingName.deletedAt)
        return { status: 401, error: true, message, action: actionTag, paths: [{ field: 'name', message }] }
      }

      const existing = isCreate
        ? null
        : await db.bpMaster.findFirst({ where: { id, dbCode, type, deletedAt: null }, include: COMMON_BP_MASTER_INCLUDE })

      if (!isCreate && !existing) return { status: 404, error: true, message: `${label} not found!`, action: actionTag }

      //! a submitted child id must belong to this bp
      const addressIds = new Set(existing?.addresses.map((a) => a.id) ?? [])
      const contactIds = new Set(existing?.contacts.map((c) => c.id) ?? [])

      if (addresses.some((a) => a.id && !addressIds.has(a.id))) {
        return { status: 400, error: true, message: 'Address not found!', action: actionTag }
      }

      if (contacts.some((c) => c.id && !contactIds.has(c.id))) {
        return { status: 400, error: true, message: 'Contact not found!', action: actionTag }
      }

      const addressRows = await Promise.all(
        addresses.map(async ({ id: _id, code: _code, ...address }) => {
          const [countryName, stateName] = await Promise.all([getCountryName(address.countryCode), getStateName(address.countryCode, address.stateCode)]) // prettier-ignore
          const pick = address.type === 'B' ? defaultBillingName : defaultShippingName

          //* a state from another country is dropped
          return {
            ...address,
            countryCode: countryName ? address.countryCode : null,
            countryName,
            stateCode: stateName ? address.stateCode : null,
            stateName,
            isDefault: isSameName(address.name, pick)
          }
        })
      )

      const bpMaster = await db.$transaction(async (tx) => {
        const saved = existing
          ? await tx.bpMaster.update({ where: { id: existing.id }, data: { name, updatedBy: userCode } })
          : await tx.bpMaster.create({
              data: { dbCode, type, name, code: await nextSequence(tx, BP_MASTER_SEQUENCES[type], { dbCode }), createdBy: userCode, updatedBy: userCode } // prettier-ignore
            })

        const parent = { dbCode, bpCode: saved.code }

        //* children left out of the form are deleted for good
        const keptAddressIds = addresses.flatMap((a) => (a.id ? [a.id] : []))
        const keptContactIds = contacts.flatMap((c) => (c.id ? [c.id] : []))

        await tx.bpAddress.deleteMany({ where: { ...parent, id: { notIn: keptAddressIds } } })
        await tx.bpContactPerson.deleteMany({ where: { ...parent, id: { notIn: keptContactIds } } })

        for (const [index, address] of addressRows.entries()) {
          const addressId = addresses[index].id

          if (addressId) await tx.bpAddress.update({ where: { id: addressId }, data: { ...address, updatedBy: userCode } })
          else {
            const code = await nextSequence(tx, BP_ADDRESS_SEQUENCE, parent)
            await tx.bpAddress.create({ data: { ...address, ...parent, code, createdBy: userCode, updatedBy: userCode } })
          }
        }

        for (const { id: contactId, code: _code, ...contact } of contacts) {
          const data = { ...contact, isDefault: isSameName(contact.name, defaultContactName) }

          if (contactId) await tx.bpContactPerson.update({ where: { id: contactId }, data: { ...data, updatedBy: userCode } })
          else {
            const code = await nextSequence(tx, BP_CONTACT_PERSON_SEQUENCE, parent)
            await tx.bpContactPerson.create({ data: { ...data, ...parent, code, createdBy: userCode, updatedBy: userCode } })
          }
        }

        return saved
      })

      const message = `${label} ${isCreate ? 'created' : 'updated'} successfully!`

      //* the form resets from this, new children get their id and code back
      const saved = await db.bpMaster.findUnique({ where: { id: bpMaster.id }, include: COMMON_BP_MASTER_INCLUDE })

      return {
        status: 200,
        error: false,
        message,
        action: actionTag,
        data: { bpMaster: saved ?? { ...bpMaster, addresses: [], contacts: [] } }
      }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      //* a save that raced past the check above
      if (isUniqueConstraintError(err)) {
        return { status: 409, error: true, message: 'Name already exists!', action: actionTag }
      }

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })

export const deleteBpMaster = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(bpMasterCodeParamsSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { dbCode, userCode, ability } = ctx
    const { code, type } = parsedInput
    const { label, permission } = BP_MASTER_CONFIG[type]
    const actionTag = 'DELETE_BP_MASTER'

    if (!ability?.can(PERMISSIONS_ALLOWED_ACTIONS.DELETE, permission)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      const bpMaster = await db.bpMaster.findFirst({ where: { dbCode, type, code, deletedAt: null } })

      if (!bpMaster) return { status: 404, error: true, message: `${label} not found!`, action: actionTag }

      //* children stay, a restore brings them back
      await db.bpMaster.update({ where: { id: bpMaster.id }, data: { deletedAt: new Date(), deletedBy: userCode } })

      return { status: 200, error: false, message: `${label} deleted successfully!`, action: actionTag }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })

export const restoreBpMaster = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(bpMasterCodeParamsSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { dbCode, userCode, ability } = ctx
    const { code, type } = parsedInput
    const { label, permission } = BP_MASTER_CONFIG[type]
    const actionTag = 'RESTORE_BP_MASTER'

    if (!ability?.can(PERMISSIONS_ALLOWED_ACTIONS.RESTORE, permission)) {
      return { status: 403, error: true, message: 'You are not allowed to do this!', action: actionTag }
    }

    try {
      const bpMaster = await db.bpMaster.findFirst({ where: { dbCode, type, code } })

      if (!bpMaster) return { status: 404, error: true, message: `${label} not found!`, action: actionTag }

      await db.bpMaster.update({ where: { id: bpMaster.id }, data: { deletedAt: null, deletedBy: null, updatedBy: userCode } })

      return { status: 200, error: false, message: `${label} restored successfully!`, action: actionTag }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })
