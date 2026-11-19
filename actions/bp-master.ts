'use server'

import { action, authenticationMiddleware, tenantMiddleware } from '@/lib/safe-action'
import db from '@/lib/db'
import { Prisma } from '@/prisma/generated/client'
import { buildColumnFiltersWhere, buildGlobalFilterWhere, buildOrderBy, getDataTableParams } from '@/lib/data-table'
import { PModels } from '@/types/prisma'
import { logger } from '@/lib/logger'
import { sapFetch, sapFetchAll } from '@/lib/sap/service-layer'
import { sapString } from '@/lib/sap/endpoints'
import {
  BpMasterForm,
  bpMasterCodeParamsSchema,
  bpMasterFormSchema,
  BpMasterTableParams,
  bpMasterTableParamsSchema,
  bpMasterTypeParamsSchema,
  bpMasterActiveSchema
} from '@/schema/bp-master'
import { z } from 'zod'
import { PERMISSIONS_ALLOWED_ACTIONS } from '@/constants/permission'
import { BP_MASTER_CONFIG, BP_SAP_GROUP_TYPES, BpMasterType } from '@/constants/bp-master'
import { findSameText, isUniqueConstraintError, toDuplicateMessage, toFieldListMessage } from '@/lib/duplicate'
import { DuplicateFields } from '@/types/common'
import { diffActivity, logActivity } from '@/lib/activity-log'
import { BP_MASTER_ACTIVITY_CONFIG } from '@/lib/activity-configs/bp-master'
import { SapCountry, SapCurrency, SapPaymentTermsType, SapState } from '@/types/sap'

const COMMON_BP_MASTER_INCLUDE = {
  addresses: { orderBy: [{ AddrType: 'asc' }, { AddressName: 'asc' }] },
  contacts: { orderBy: { ContactName: 'asc' } }
} satisfies Prisma.BusinessPartnerInclude

export type BpMasterRow = Prisma.BusinessPartnerGetPayload<{ include: typeof COMMON_BP_MASTER_INCLUDE }>

export type BpMasterLookups = {
  groups: { Code: number; Name: string }[]
  currencies: SapCurrency[]
  paymentTerms: SapPaymentTermsType[]
  countries: SapCountry[]
  accountTypes: { Value: string; Description: string }[]
  isError: boolean
}

const FORBIDDEN = { status: 403, error: true, message: 'You are not allowed to do this!' } as const

//* card code numbers below this width get zero padded
const MIN_CODE_DIGITS = 5

export async function getBpMasterByCode(dbCode: string | null, type: BpMasterType, code?: string | null) {
  if (!dbCode || !code) return null

  try {
    //* the type check makes /vendors/C00001 a 404
    return await db.businessPartner.findFirst({
      where: { dbCode, CardType: type, CardCode: code, deletedAt: null },
      include: COMMON_BP_MASTER_INCLUDE
    })
  } catch (err: any) {
    logger.error(err, '[GET_BP_MASTER_BY_CODE_ERROR]:')
    return null
  }
}

//* isError lets a caller tell a failed lookup from an empty one
export async function getBpMasterLookups(dbCode: string, type: BpMasterType): Promise<BpMasterLookups> {
  const [groups, currencies, paymentTerms, countries, userFields] = await Promise.all([
    sapFetch(dbCode, 'bpGroups.list', { query: { $select: 'Code,Name', $filter: `Type eq ${sapString(BP_SAP_GROUP_TYPES[type])}`, $orderby: 'Name' } }), // prettier-ignore
    sapFetch(dbCode, 'currencies.list', { query: { $select: 'Code,Name', $orderby: 'Code' } }),
    sapFetch(dbCode, 'paymentTerms.list', { query: { $select: 'GroupNumber,PaymentTermsGroupName', $orderby: 'PaymentTermsGroupName' } }),
    sapFetch(dbCode, 'countries.list', { query: { $select: 'Code,Name', $orderby: 'Name' } }),
    sapFetch(dbCode, 'userFields.list', { query: { $filter: "TableName eq 'OCRD' and Name eq 'OMEG_AcctType'" } })
  ])

  //* sapFetch already logs a failed call
  return {
    groups: groups.ok ? groups.data.value.map(({ Code, Name }) => ({ Code, Name })) : [],
    currencies: currencies.ok ? currencies.data.value : [],
    paymentTerms: paymentTerms.ok ? paymentTerms.data.value : [],
    countries: countries.ok ? countries.data.value : [],
    accountTypes: userFields.ok ? (userFields.data.value[0]?.ValidValuesMD ?? []) : [],
    isError: !groups.ok || !currencies.ok || !paymentTerms.ok || !countries.ok || !userFields.ok
  }
}

export const getBpMasterLookupsClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(bpMasterTypeParamsSchema)
  .action(async ({ ctx, parsedInput }) => getBpMasterLookups(ctx.dbCode, parsedInput.type))

export async function getStatesByCountry(dbCode: string, country?: string | null): Promise<SapState[]> {
  if (!country) return []

  const result = await sapFetch(dbCode, 'states.list', {
    query: { $select: 'Code,Name,Country', $filter: `Country eq ${sapString(country)}`, $orderby: 'Name' }
  })

  return result.ok ? result.data.value : []
}

export const getStatesByCountryClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(z.object({ country: z.string().trim().min(1) }))
  .action(async ({ ctx, parsedInput }) => getStatesByCountry(ctx.dbCode, parsedInput.country))

//* highest numeric code in sap and the portal plus one, null when sap can't be read
export async function getNextBpCode(dbCode: string, type: BpMasterType): Promise<string | null> {
  const { codePrefix } = BP_MASTER_CONFIG[type]

  //! no card type filter, sap codes are unique across customers, vendors and leads
  const [sapCodes, portalCodes] = await Promise.all([
    sapFetchAll(dbCode, 'bp.list', {
      query: { $select: 'CardCode', $filter: `startswith(CardCode,${sapString(codePrefix)})` },
      pageSize: 1000
    }),
    db.businessPartner.findMany({
      where: { dbCode, CardCode: { startsWith: codePrefix, mode: 'insensitive' } },
      select: { CardCode: true }
    })
  ])

  if (!sapCodes.ok) return null

  const codes = [...sapCodes.data.map((bp) => bp.CardCode), ...portalCodes.map((bp) => bp.CardCode)]

  //! compare numbers, not strings, so C99999 comes before C100000
  let max = 0
  let digits = MIN_CODE_DIGITS

  for (const code of codes) {
    const numberPart = code.slice(codePrefix.length)
    if (!/^\d+$/.test(numberPart)) continue

    max = Math.max(max, Number(numberPart))
    digits = Math.max(digits, numberPart.length)
  }

  return `${codePrefix}${String(max + 1).padStart(digits, '0')}`
}

export const getNextBpCodeClient = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(bpMasterTypeParamsSchema)
  .action(async ({ ctx, parsedInput }) => getNextBpCode(ctx.dbCode, parsedInput.type))

export async function getDataTableBpMastersSvr(dbCode: string, params: BpMasterTableParams) {
  const { perPage, offset, globalFilter, sorting, columnFilters, isExport, isShowDeleted } = getDataTableParams(params)

  const modelName: keyof PModels = 'BusinessPartner'

  //* initialize where input
  const where: Prisma.BusinessPartnerWhereInput = { dbCode, CardType: params.type, ...(isShowDeleted ? {} : { deletedAt: null }) }

  //* global filter
  if (globalFilter) {
    const filter = buildGlobalFilterWhere<typeof modelName>(globalFilter, {
      stringFields: ['CardCode', 'CardName', 'GroupName', 'CurrName', 'PymntGroup'],
      booleanFields: [{ field: 'isActive' }]
    })

    Object.assign(where, filter)
  }

  //* column filters
  if (columnFilters.length > 0) {
    const currentFilters = where.AND as Prisma.BusinessPartnerWhereInput[]

    const filters = buildColumnFiltersWhere<typeof modelName>(columnFilters, {
      stringFields: ['syncStatus', { field: 'GroupName', nullable: true }, { field: 'CurrName', nullable: true }],
      booleanFields: [{ field: 'isActive' }],
      dateFields: [{ field: 'createdAt' }, { field: 'updatedAt' }, { field: 'syncedAt', nullable: true }]
    })

    where.AND = [...(currentFilters ?? []), ...filters]
  }

  //* initialize order input
  const orderBy: Prisma.BusinessPartnerOrderByWithRelationInput[] = buildOrderBy<typeof modelName>(sorting)

  try {
    const [data, rowCount] = await db.$transaction([
      db.businessPartner.findMany({ where, ...(isExport ? {} : { skip: offset, take: perPage }), orderBy }),
      db.businessPartner.count({ where })
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

type PickedNames = { GroupName: string | null; CurrName: string | null; PymntGroup: string | null }

//* names the picked codes from sap, null when sap is unreachable
async function resolveSapNames(dbCode: string, type: BpMasterType, data: BpMasterForm) {
  const lookups = await getBpMasterLookups(dbCode, type)

  if (lookups.isError) return null

  const group = data.GroupCode !== null ? lookups.groups.find((g) => g.Code === data.GroupCode) : null
  const currency = data.CurrCode ? lookups.currencies.find((c) => c.Code === data.CurrCode) : null
  const paymentTerm = data.GroupNum !== null ? lookups.paymentTerms.find((p) => p.GroupNumber === data.GroupNum) : null
  const accountType = data.AcctType ? lookups.accountTypes.find((a) => a.Value === data.AcctType) : null

  const unavailable: DuplicateFields = []

  if (data.GroupCode !== null && !group) unavailable.push({ field: 'GroupCode', name: 'Group', message: 'Group is not available!' })
  if (data.CurrCode && !currency) unavailable.push({ field: 'CurrCode', name: 'Currency', message: 'Currency is not available!' })
  if (data.GroupNum !== null && !paymentTerm) unavailable.push({ field: 'GroupNum', name: 'Payment Terms', message: 'Payment Terms is not available!' }) // prettier-ignore
  if (data.AcctType && !accountType) unavailable.push({ field: 'AcctType', name: 'Account Type', message: 'Account Type is not available!' }) // prettier-ignore

  const names: PickedNames = {
    GroupName: group?.Name ?? null,
    CurrName: currency?.Name ?? null,
    PymntGroup: paymentTerm?.PaymentTermsGroupName ?? null
  }

  return { unavailable, names, countries: lookups.countries }
}

export const upsertBpMaster = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(bpMasterFormSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { id, CardType: type, addresses, contacts, ...input } = parsedInput
    const { dbCode, userCode, ability, actor } = ctx
    const { label, permission, canCreate } = BP_MASTER_CONFIG[type]
    const actionTag = 'UPSERT_BP_MASTER'
    const activityModule = type === 'C' ? 'CUSTOMERS' : 'VENDORS'
    const isCreate = !id

    const requiredAction = isCreate ? PERMISSIONS_ALLOWED_ACTIONS.CREATE : PERMISSIONS_ALLOWED_ACTIONS.EDIT

    if (!ability?.can(requiredAction, permission) || !canCreate) return { ...FORBIDDEN, action: actionTag }

    try {
      const existing = isCreate
        ? null
        : await db.businessPartner.findFirst({ where: { id, dbCode, CardType: type, deletedAt: null }, include: COMMON_BP_MASTER_INCLUDE })

      if (!isCreate && !existing) return { status: 404, error: true, message: `${label} not found!`, action: actionTag }

      //* sap owns a synced partner, only portal fields save
      if (existing?.syncStatus === 'SYNCED') {
        const saved = await db.$transaction(async (tx) => {
          const result = await tx.businessPartner.update({
            where: { id: existing.id },
            data: { isActive: input.isActive, updatedBy: userCode },
            include: COMMON_BP_MASTER_INCLUDE
          })

          await logActivity(tx, {
            actor,
            module: activityModule,
            action: 'UPDATE',
            dbCode,
            entity: { id: result.id, code: result.CardCode, label: result.CardName },
            changes: diffActivity(BP_MASTER_ACTIVITY_CONFIG, existing, result)
          })

          return result
        })

        return { status: 200, error: false, message: `${label} updated successfully!`, action: actionTag, data: { bpMaster: saved } }
      }

      //* deleted rows count too, the unique key includes them
      const sameCodes = await db.businessPartner.findMany({
        where: { dbCode, CardCode: { equals: input.CardCode, mode: 'insensitive' }, ...(id && { NOT: { id } }) }
      })

      const existingCode = findSameText(sameCodes, (row) => row.CardCode, input.CardCode)

      if (existingCode) {
        const message = toDuplicateMessage('Code', existingCode.deletedAt)
        return { status: 401, error: true, message, action: actionTag, paths: [{ field: 'CardCode', message }] }
      }

      //! a submitted child id must belong to this partner
      const addressIds = new Set(existing?.addresses.map((a) => a.id) ?? [])
      const contactIds = new Set(existing?.contacts.map((c) => c.id) ?? [])

      if (addresses.some((a) => a.id && !addressIds.has(a.id))) return { status: 400, error: true, message: 'Address not found!', action: actionTag } // prettier-ignore
      if (contacts.some((c) => c.id && !contactIds.has(c.id))) return { status: 400, error: true, message: 'Contact not found!', action: actionTag } // prettier-ignore

      //* only a changed pick asks sap, keeping a code sap dropped is fine
      const isPickChanged =
        !existing ||
        existing.GroupCode !== input.GroupCode ||
        existing.CurrCode !== input.CurrCode ||
        existing.GroupNum !== input.GroupNum ||
        existing.AcctType !== input.AcctType

      const previousAddresses = new Map(existing?.addresses.map((a) => [a.id, a]) ?? [])

      //* an address keeps its names unless its country or state changed
      const isAddressPlaceChanged = addresses.some((a) => {
        const previous = a.id ? previousAddresses.get(a.id) : null
        return (a.CountryCode || a.StateCode) && (!previous || previous.CountryCode !== a.CountryCode || previous.StateCode !== a.StateCode)
      })

      const hasPicks = input.GroupCode !== null || !!input.CurrCode || input.GroupNum !== null || !!input.AcctType

      let names: PickedNames = {
        GroupName: existing?.GroupName ?? null,
        CurrName: existing?.CurrName ?? null,
        PymntGroup: existing?.PymntGroup ?? null
      }

      let countries: SapCountry[] = []

      //* blank pickers need no names, so sap is skipped
      if (isPickChanged && !hasPicks) names = { GroupName: null, CurrName: null, PymntGroup: null }

      if ((isPickChanged && hasPicks) || isAddressPlaceChanged) {
        const resolved = await resolveSapNames(dbCode, type, parsedInput)

        if (!resolved) return { status: 502, error: true, message: 'Could not load SAP lookups', action: actionTag }

        if (resolved.unavailable.length > 0) {
          const paths = resolved.unavailable.map((u) => ({ field: u.field, message: u.message }))
          const message = toFieldListMessage(resolved.unavailable, 'is not available!', 'are not available!')
          return { status: 401, error: true, message, action: actionTag, paths }
        }

        if (isPickChanged) names = resolved.names
        countries = resolved.countries
      }

      //* states load once per country that changed
      const changedCountries = new Set(
        addresses.flatMap((a) => {
          const previous = a.id ? previousAddresses.get(a.id) : null
          const isChanged = !previous || previous.CountryCode !== a.CountryCode || previous.StateCode !== a.StateCode
          return isChanged && a.CountryCode && a.StateCode ? [a.CountryCode] : []
        })
      )

      const statesByCountry = new Map(
        await Promise.all([...changedCountries].map(async (country) => [country, await getStatesByCountry(dbCode, country)] as const))
      )

      const addressRows = addresses.map(({ id: addressId, ...address }) => {
        const previous = addressId ? previousAddresses.get(addressId) : null

        if (previous && previous.CountryCode === address.CountryCode && previous.StateCode === address.StateCode) {
          return { id: addressId, data: { ...address, CountryName: previous.CountryName, StateName: previous.StateName } }
        }

        const country = address.CountryCode ? countries.find((c) => c.Code === address.CountryCode) : null
        const state = address.CountryCode && address.StateCode ? statesByCountry.get(address.CountryCode)?.find((s) => s.Code === address.StateCode) : null // prettier-ignore

        //* a state from another country is dropped
        return {
          id: addressId,
          data: {
            ...address,
            CountryCode: country ? address.CountryCode : null,
            CountryName: country?.Name ?? null,
            StateCode: state ? address.StateCode : null,
            StateName: state?.Name ?? null
          }
        }
      })

      const partnerData = {
        ...input,
        ...names,
        ...(existing?.syncStatus === 'FAILED' && { syncStatus: 'PENDING' as const, syncError: null }),
        updatedBy: userCode
      }

      const bpMaster = await db.$transaction(async (tx) => {
        //* a code rename cascades to the children
        const saved = existing
          ? await tx.businessPartner.update({ where: { id: existing.id }, data: partnerData })
          : await tx.businessPartner.create({ data: { ...partnerData, dbCode, CardType: type, createdBy: userCode } })

        const parent = { dbCode, CardCode: saved.CardCode }

        //* children left out of the form are deleted for good
        const keptAddressIds = addressRows.flatMap((a) => (a.id ? [a.id] : []))
        const keptContactIds = contacts.flatMap((c) => (c.id ? [c.id] : []))

        await tx.bpAddress.deleteMany({ where: { ...parent, id: { notIn: keptAddressIds } } })
        await tx.contact.deleteMany({ where: { ...parent, id: { notIn: keptContactIds } } })

        for (const address of addressRows) {
          if (address.id) await tx.bpAddress.update({ where: { id: address.id }, data: { ...address.data, updatedBy: userCode } })
          else await tx.bpAddress.create({ data: { ...address.data, ...parent, createdBy: userCode, updatedBy: userCode } })
        }

        for (const { id: contactId, ...contact } of contacts) {
          if (contactId) await tx.contact.update({ where: { id: contactId }, data: { ...contact, updatedBy: userCode } })
          else await tx.contact.create({ data: { ...contact, ...parent, createdBy: userCode, updatedBy: userCode } })
        }

        //* the form resets from this, new children get their id back
        const reloaded = await tx.businessPartner.findUnique({ where: { id: saved.id }, include: COMMON_BP_MASTER_INCLUDE })

        await logActivity(tx, {
          actor,
          module: activityModule,
          action: existing ? 'UPDATE' : 'CREATE',
          dbCode,
          entity: { id: saved.id, code: saved.CardCode, label: saved.CardName },
          changes: diffActivity(BP_MASTER_ACTIVITY_CONFIG, existing, reloaded)
        })

        //! written in this same transaction, so it always exists
        return reloaded!
      })

      return {
        status: 200,
        error: false,
        message: `${label} ${isCreate ? 'created' : 'updated'} successfully!`,
        action: actionTag,
        data: { bpMaster }
      }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      //* a save that raced past the check above
      if (isUniqueConstraintError(err)) return { status: 409, error: true, message: 'Code already exists!', action: actionTag }

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })

//* the save for a synced partner, sap owns everything else
export const setBpMasterActive = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(bpMasterActiveSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { id, type, isActive } = parsedInput
    const { dbCode, userCode, ability } = ctx
    const { label, permission, canCreate } = BP_MASTER_CONFIG[type]
    const actionTag = 'SET_BP_MASTER_ACTIVE'

    if (!ability?.can(PERMISSIONS_ALLOWED_ACTIONS.EDIT, permission) || !canCreate) return { ...FORBIDDEN, action: actionTag }

    try {
      const existing = await db.businessPartner.findFirst({ where: { id, dbCode, CardType: type, deletedAt: null }, include: COMMON_BP_MASTER_INCLUDE }) // prettier-ignore

      if (!existing) return { status: 404, error: true, message: `${label} not found!`, action: actionTag }

      const bpMaster = await db.$transaction(async (tx) => {
        const result = await tx.businessPartner.update({ where: { id }, data: { isActive, updatedBy: userCode }, include: COMMON_BP_MASTER_INCLUDE }) // prettier-ignore

        await logActivity(tx, {
          actor: ctx.actor,
          module: type === 'C' ? 'CUSTOMERS' : 'VENDORS',
          action: 'UPDATE',
          dbCode,
          entity: { id: result.id, code: result.CardCode, label: result.CardName },
          changes: diffActivity(BP_MASTER_ACTIVITY_CONFIG, existing, result)
        })

        return result
      })

      return { status: 200, error: false, message: `${label} updated successfully!`, action: actionTag, data: { bpMaster: bpMaster! } }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

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

    if (!ability?.can(PERMISSIONS_ALLOWED_ACTIONS.DELETE, permission)) return { ...FORBIDDEN, action: actionTag }

    try {
      const bpMaster = await db.businessPartner.findFirst({ where: { dbCode, CardType: type, CardCode: code, deletedAt: null } })

      if (!bpMaster) return { status: 404, error: true, message: `${label} not found!`, action: actionTag }

      if (bpMaster.syncStatus === 'SYNCED') {
        return { status: 409, error: true, message: `Synced ${label.toLowerCase()}s can't be deleted!`, action: actionTag }
      }

      //* children stay, a restore brings them back
      await db.$transaction(async (tx) => {
        await tx.businessPartner.update({ where: { id: bpMaster.id }, data: { deletedAt: new Date(), deletedBy: userCode } })

        await logActivity(tx, {
          actor: ctx.actor,
          module: type === 'C' ? 'CUSTOMERS' : 'VENDORS',
          action: 'DELETE',
          dbCode,
          entity: { id: bpMaster.id, code: bpMaster.CardCode, label: bpMaster.CardName }
        })
      })

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

    if (!ability?.can(PERMISSIONS_ALLOWED_ACTIONS.RESTORE, permission)) return { ...FORBIDDEN, action: actionTag }

    try {
      const bpMaster = await db.businessPartner.findFirst({ where: { dbCode, CardType: type, CardCode: code } })

      if (!bpMaster) return { status: 404, error: true, message: `${label} not found!`, action: actionTag }

      await db.$transaction(async (tx) => {
        await tx.businessPartner.update({ where: { id: bpMaster.id }, data: { deletedAt: null, deletedBy: null, updatedBy: userCode } })

        await logActivity(tx, {
          actor: ctx.actor,
          module: type === 'C' ? 'CUSTOMERS' : 'VENDORS',
          action: 'RESTORE',
          dbCode,
          entity: { id: bpMaster.id, code: bpMaster.CardCode, label: bpMaster.CardName }
        })
      })

      return { status: 200, error: false, message: `${label} restored successfully!`, action: actionTag }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)

      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })
