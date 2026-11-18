'use server'

import db from '@/lib/db'
import { logger } from '@/lib/logger'
import { action, authenticationMiddleware, tenantMiddleware } from '@/lib/safe-action'
import { sapFetch } from '@/lib/sap/service-layer'
import { sapString } from '@/lib/sap/endpoints'
import { toChangedSinceFilter, toSyncSinceDate } from '@/lib/sap/sync'
import { withoutNulls } from '@/lib/sap/utils'
import { chunkArray } from '@/lib/utils'
import { escapeLikeKeyword } from '@/lib/data-table'
import { Prisma } from '@/prisma/generated/client'
import { PERMISSIONS_ALLOWED_ACTIONS } from '@/constants/permission'
import { SAP_SYNC_BP_PAGE_SIZE } from '@/constants/sap-sync'
import { BP_MASTER_CONFIG, BP_SAP_ADDRESS_TYPES, BP_SAP_CARD_TYPES, BP_SYNC_KEYS, BpAddressType, BpMasterType } from '@/constants/bp-master'
import { completeSapSyncRun, failSapSyncRun, startSapSyncRun } from '@/actions/sap-sync-state'
import {
  bpMasterSyncFailSchema,
  bpMasterSyncFinishSchema,
  bpMasterSyncFromSapPageSchema,
  bpMasterSyncToSapSchema,
  bpMasterTypeParamsSchema,
  CARD_CODE_MAX_LENGTH
} from '@/schema/bp-master'
import { BatchError, BatchErrorEntry, BatchStepResult } from '@/types/batch'
import { SapBusinessPartner, SapBusinessPartnerBody, SapCompanyPrivate, SapState } from '@/types/sap'

const PULL_FIELDS = [
  'CardCode,CardName,CardType,GroupCode,Currency,PayTermsGrpCode,U_OMEG_AcctType,CompanyPrivate',
  'ContactPerson,BilltoDefault,ShipToDefault,BPAddresses,ContactEmployees'
].join(',')

const LOOKUP_CHUNK_SIZE = 500 //* codes per existing row lookup

const FORBIDDEN = { status: 403, error: true, message: 'You are not allowed to do this!' } as const

const toAddrType = (sapType: string): BpAddressType => (sapType === BP_SAP_ADDRESS_TYPES.B ? 'B' : 'S')

//* sap sends '' for some empty fields
const toValue = (value?: string | null) => (value?.trim() ? value : null)

//* only portal flagged partners of this type, and only changed ones after the first sync
function toPullFilter(type: BpMasterType, since: string | null) {
  const base = `CardType eq ${sapString(BP_SAP_CARD_TYPES[type])} and U_Portal_Sync eq 'Y'`
  const changed = toChangedSinceFilter(since)
  return changed ? `${base} and ${changed}` : base
}

const canSync = (ability: any, type: BpMasterType, syncAction: string) => ability?.can(syncAction, BP_MASTER_CONFIG[type].permission)

export const startBpMasterSyncFromSap = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(bpMasterTypeParamsSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { dbCode, userCode, ability } = ctx
    const { type } = parsedInput
    const actionTag = 'START_BP_MASTER_SYNC_FROM_SAP'

    if (!canSync(ability, type, PERMISSIONS_ALLOWED_ACTIONS.SYNC_FROM_SAP)) return { ...FORBIDDEN, action: actionTag }

    try {
      const syncKey = BP_SYNC_KEYS[type].from
      const { startedAt, lastSyncAt } = await startSapSyncRun(dbCode, syncKey, userCode)
      const since = toSyncSinceDate(lastSyncAt)

      const count = await sapFetch(dbCode, 'bp.count', { query: { $filter: toPullFilter(type, since) } })

      if (!count.ok) {
        await failSapSyncRun(dbCode, syncKey, count.message)
        return { status: count.status || 502, error: true, message: count.message, action: actionTag }
      }

      const data = { since, startedAt: startedAt.toISOString(), total: Number(count.data) || 0 }

      return { status: 200, error: false, message: 'Sync started', action: actionTag, data }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)
      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })

//* one page of sap partners into the portal, addresses and contacts merge by name
export const syncBpMastersFromSapPage = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(bpMasterSyncFromSapPageSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { dbCode, userCode, ability } = ctx
    const { type, since, skip, metaData } = parsedInput
    const actionTag = 'SYNC_BP_MASTERS_FROM_SAP_PAGE'

    if (!canSync(ability, type, PERMISSIONS_ALLOWED_ACTIONS.SYNC_FROM_SAP)) return { ...FORBIDDEN, action: actionTag }

    //! blank names would overwrite good ones, so empty lookups fail the page
    if (Object.values(metaData).some((list) => list.length === 0)) {
      return { status: 400, error: true, message: 'SAP lookups are not loaded', action: actionTag }
    }

    try {
      const page = await sapFetch(dbCode, 'bp.list', {
        query: {
          $select: PULL_FIELDS,
          $filter: toPullFilter(type, since),
          $orderby: 'CardCode',
          $top: SAP_SYNC_BP_PAGE_SIZE,
          $skip: skip
        }
      })

      if (!page.ok) throw new Error(page.message)

      const groupNames = new Map(metaData.groups.map((g) => [g.Code, g.Name]))
      const currencyNames = new Map(metaData.currencies.map((c) => [c.Code, c.Name]))
      const paymentTermNames = new Map(metaData.paymentTerms.map((p) => [p.GroupNumber, p.PaymentTermsGroupName]))
      const countryNames = new Map(metaData.countries.map((c) => [c.Code, c.Name]))

      const errors: BatchError[] = []
      const seen = new Set<string>()
      const rows: SapBusinessPartner[] = []

      page.data.value.forEach((bp, index) => {
        const lowered = bp.CardCode?.trim().toLowerCase()

        if (!lowered) {
          errors.push({ key: `skip-${skip + index}`, label: '(no code)', entries: [{ field: 'Code', message: 'Missing required field' }] })
          return
        }

        //* sap keeps codes unique without case, a repeat in one page is skipped
        if (seen.has(lowered)) return
        seen.add(lowered)
        rows.push(bp)
      })

      //* existing partners by lowercased code, deleted ones too
      const existingRows = (
        await Promise.all(
          chunkArray(rows, LOOKUP_CHUNK_SIZE).map((chunk) =>
            db.businessPartner.findMany({
              //! insensitive equals runs as ILIKE, a code ending in \ would throw unless escaped
              where: { dbCode, OR: chunk.map((bp) => ({ CardCode: { equals: escapeLikeKeyword(bp.CardCode), mode: 'insensitive' as const } })) }, // prettier-ignore
              select: { id: true, CardCode: true }
            })
          )
        )
      ).flat()

      const existingByCode = new Map(existingRows.map((row) => [row.CardCode.toLowerCase(), row]))

      //* portal children of the matched partners, keyed by their current code
      const existingCodes = existingRows.map((row) => row.CardCode)

      const [portalAddresses, portalContacts] = await Promise.all([
        db.bpAddress.findMany({ where: { dbCode, CardCode: { in: existingCodes } }, select: { id: true, CardCode: true, AddressName: true, AddrType: true } }), // prettier-ignore
        db.contact.findMany({ where: { dbCode, CardCode: { in: existingCodes } }, select: { id: true, CardCode: true, ContactName: true } })
      ])

      //* states load once per country on this page, a failed load fails the page so names never blank out
      const countries = new Set(rows.flatMap((bp) => (bp.BPAddresses ?? []).flatMap((a) => (a.Country && a.State ? [a.Country] : []))))
      const statesByCountry = new Map<string, SapState[]>(
        await Promise.all(
          [...countries].map(async (country) => {
            const states = await sapFetch(dbCode, 'states.list', { query: { $select: 'Code,Name,Country', $filter: `Country eq ${sapString(country)}` } }) // prettier-ignore
            if (!states.ok) throw new Error(states.message)
            return [country, states.data.value] as const
          })
        )
      )

      const now = new Date()
      const synced = { syncStatus: 'SYNCED' as const, syncedAt: now, syncError: null }

      const partnerOps: Prisma.PrismaPromise<unknown>[] = []
      const partnerCreates: Prisma.BusinessPartnerCreateManyInput[] = []
      const childOps: Prisma.PrismaPromise<unknown>[] = []

      for (const bp of rows) {
        const sapFields = {
          CardCode: bp.CardCode,
          CardName: bp.CardName,
          CardType: type,
          CntctPrsn: toValue(bp.ContactPerson),
          CurrCode: toValue(bp.Currency),
          CurrName: bp.Currency ? (currencyNames.get(bp.Currency) ?? null) : null,
          GroupCode: bp.GroupCode ?? null,
          GroupName: bp.GroupCode !== null && bp.GroupCode !== undefined ? (groupNames.get(bp.GroupCode) ?? null) : null,
          GroupNum: bp.PayTermsGrpCode ?? null,
          PymntGroup: bp.PayTermsGrpCode !== null && bp.PayTermsGrpCode !== undefined ? (paymentTermNames.get(bp.PayTermsGrpCode) ?? null) : null, // prettier-ignore
          ShipToDef: toValue(bp.ShipToDefault),
          BillToDef: toValue(bp.BilltoDefault),
          AcctType: toValue(bp.U_OMEG_AcctType),
          CmpPrivate: toValue(bp.CompanyPrivate),
          ...synced
        }

        const existing = existingByCode.get(bp.CardCode.toLowerCase())

        //* isActive and deletedAt are portal fields, never touched
        if (existing)
          partnerOps.push(db.businessPartner.update({ where: { id: existing.id }, data: { ...sapFields, updatedBy: userCode } }))
        else partnerCreates.push({ ...sapFields, dbCode, createdBy: userCode, updatedBy: userCode })

        const parent = { dbCode, CardCode: bp.CardCode }

        //* match by name without case, portal rows sap doesn't have stay and turn pending
        const addressesByKey = new Map(
          portalAddresses
            .filter((a) => existing && a.CardCode === existing.CardCode)
            .map((a) => [`${a.AddrType}|${a.AddressName.toLowerCase()}`, a.id])
        )
        const contactsByKey = new Map(
          portalContacts.filter((c) => existing && c.CardCode === existing.CardCode).map((c) => [c.ContactName.toLowerCase(), c.id])
        )

        for (const address of bp.BPAddresses ?? []) {
          if (!address.AddressName?.trim()) continue

          const AddrType = toAddrType(address.AddressType)
          const key = `${AddrType}|${address.AddressName.toLowerCase()}`
          const state = address.Country && address.State ? statesByCountry.get(address.Country)?.find((s) => s.Code === address.State) : null // prettier-ignore

          const data = {
            AddressName: address.AddressName,
            AddrType,
            Street: toValue(address.Street),
            Address2: toValue(address.AddressName2),
            Address3: toValue(address.AddressName3),
            StreetNo: toValue(address.StreetNo),
            BuildingFloorRoom: toValue(address.BuildingFloorRoom),
            Block: toValue(address.Block),
            City: toValue(address.City),
            ZipCode: toValue(address.ZipCode),
            County: toValue(address.County),
            CountryCode: toValue(address.Country),
            CountryName: address.Country ? (countryNames.get(address.Country) ?? null) : null,
            StateCode: toValue(address.State),
            StateName: state?.Name ?? null,
            ...synced
          }

          const addressId = addressesByKey.get(key)

          if (addressId) {
            childOps.push(db.bpAddress.update({ where: { id: addressId }, data: { ...data, updatedBy: userCode } }))
            addressesByKey.delete(key)
          } else childOps.push(db.bpAddress.create({ data: { ...data, ...parent, createdBy: userCode, updatedBy: userCode } }))
        }

        for (const contact of bp.ContactEmployees ?? []) {
          if (!contact.Name?.trim()) continue

          const key = contact.Name.toLowerCase()

          const data = {
            ContactName: contact.Name,
            FirstName: toValue(contact.FirstName),
            LastName: toValue(contact.LastName),
            Title: toValue(contact.Title),
            Position: toValue(contact.Position),
            Phone1: toValue(contact.Phone1),
            Phone2: toValue(contact.Phone2),
            MobilePhone: toValue(contact.MobilePhone),
            Email: toValue(contact.E_Mail),
            ...synced
          }

          const contactId = contactsByKey.get(key)

          if (contactId) {
            childOps.push(db.contact.update({ where: { id: contactId }, data: { ...data, updatedBy: userCode } }))
            contactsByKey.delete(key)
          } else childOps.push(db.contact.create({ data: { ...data, ...parent, createdBy: userCode, updatedBy: userCode } }))
        }

        //! never deleted, a portal address or contact may be in use
        const leftAddressIds = [...addressesByKey.values()]
        const leftContactIds = [...contactsByKey.values()]

        if (leftAddressIds.length > 0) childOps.push(db.bpAddress.updateMany({ where: { id: { in: leftAddressIds } }, data: { syncStatus: 'PENDING', updatedBy: userCode } })) // prettier-ignore
        if (leftContactIds.length > 0) childOps.push(db.contact.updateMany({ where: { id: { in: leftContactIds } }, data: { syncStatus: 'PENDING', updatedBy: userCode } })) // prettier-ignore
      }

      //* partners first so a code case change cascades before the children write
      await db.$transaction([...partnerOps, db.businessPartner.createMany({ data: partnerCreates, skipDuplicates: true }), ...childOps])

      const result: BatchStepResult & { fetched: number } = {
        succeeded: partnerOps.length + partnerCreates.length,
        errors,
        fetched: page.data.value.length
      }

      return { status: 200, error: false, message: 'Page synced', action: actionTag, data: result }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)
      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })

export const finishBpMasterSyncFromSap = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(bpMasterSyncFinishSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { dbCode, ability } = ctx
    const { type, startedAt, count } = parsedInput
    const actionTag = 'FINISH_BP_MASTER_SYNC_FROM_SAP'

    if (!canSync(ability, type, PERMISSIONS_ALLOWED_ACTIONS.SYNC_FROM_SAP)) return { ...FORBIDDEN, action: actionTag }

    try {
      const isCompleted = await completeSapSyncRun(dbCode, BP_SYNC_KEYS[type].from, { startedAt: new Date(startedAt), count })

      if (!isCompleted) return { status: 409, error: true, message: 'A newer sync replaced this one, its result was not saved', action: actionTag } // prettier-ignore

      return { status: 200, error: false, message: 'Sync completed', action: actionTag }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)
      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })

export const failBpMasterSyncFromSap = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(bpMasterSyncFailSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { dbCode, ability } = ctx
    const { type, message } = parsedInput
    const actionTag = 'FAIL_BP_MASTER_SYNC_FROM_SAP'

    if (!canSync(ability, type, PERMISSIONS_ALLOWED_ACTIONS.SYNC_FROM_SAP)) return { ...FORBIDDEN, action: actionTag }

    try {
      await failSapSyncRun(dbCode, BP_SYNC_KEYS[type].from, message)
      return { status: 200, error: false, message: 'Sync failure saved', action: actionTag }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)
      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })

//* pushes pending or failed partners to sap with their addresses and contacts, the server reloads each row by id
export const syncBpMastersToSap = action
  .use(authenticationMiddleware)
  .use(tenantMiddleware)
  .inputSchema(bpMasterSyncToSapSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { dbCode, userCode, ability } = ctx
    const { type, ids } = parsedInput
    const actionTag = 'SYNC_BP_MASTERS_TO_SAP'

    if (!canSync(ability, type, PERMISSIONS_ALLOWED_ACTIONS.SYNC_TO_SAP) || !BP_MASTER_CONFIG[type].canCreate) {
      return { ...FORBIDDEN, action: actionTag }
    }

    try {
      const rows = await db.businessPartner.findMany({
        where: { id: { in: ids }, dbCode, CardType: type, deletedAt: null, syncStatus: { in: ['PENDING', 'FAILED'] } },
        include: { addresses: true, contacts: true }
      })

      const errors: BatchError[] = []
      let succeeded = 0

      //* an id that didn't load was synced or deleted since the list loaded
      const loadedIds = new Set(rows.map((row) => row.id))
      const { label } = BP_MASTER_CONFIG[type]

      ids
        .filter((id) => !loadedIds.has(id))
        .forEach((id) => errors.push({ key: id, label: id, entries: [{ field: label, message: `${label} is already synced or was deleted` }] })) // prettier-ignore

      //* one at a time, sapFetch queues per database anyway
      for (const row of rows) {
        const entries: BatchErrorEntry[] = []

        //* check required fields, names match the form labels
        if (!row.CardCode) entries.push({ field: 'Code', message: 'Missing required field' })
        else if (row.CardCode.length > CARD_CODE_MAX_LENGTH) entries.push({ field: 'Code', message: `Must be at most ${CARD_CODE_MAX_LENGTH} characters` }) // prettier-ignore

        if (!row.CardName) entries.push({ field: 'Name', message: 'Missing required field' })

        if (entries.length > 0) {
          errors.push({ key: row.id, label: row.CardCode, entries })
          continue
        }

        //* a blank optional field is left out, sap uses its defaults
        const body = withoutNulls({
          CardCode: row.CardCode,
          CardName: row.CardName,
          CardType: BP_SAP_CARD_TYPES[type],
          GroupCode: row.GroupCode,
          Currency: row.CurrCode,
          PayTermsGrpCode: row.GroupNum,
          U_OMEG_AcctType: row.AcctType,
          CompanyPrivate: row.CmpPrivate as SapCompanyPrivate | null,
          ContactPerson: row.CntctPrsn,
          BilltoDefault: row.BillToDef,
          ShipToDefault: row.ShipToDef,
          U_Portal_Sync: 'Y' as const,
          BPAddresses: row.addresses.map((a) =>
            withoutNulls({
              AddressName: a.AddressName,
              AddressType: BP_SAP_ADDRESS_TYPES[a.AddrType as BpAddressType],
              Street: a.Street,
              AddressName2: a.Address2,
              AddressName3: a.Address3,
              StreetNo: a.StreetNo,
              BuildingFloorRoom: a.BuildingFloorRoom,
              Block: a.Block,
              City: a.City,
              ZipCode: a.ZipCode,
              County: a.County,
              Country: a.CountryCode,
              State: a.StateCode
            })
          ),
          ContactEmployees: row.contacts.map((c) =>
            withoutNulls({
              Name: c.ContactName,
              FirstName: c.FirstName,
              LastName: c.LastName,
              Title: c.Title,
              Position: c.Position,
              Phone1: c.Phone1,
              Phone2: c.Phone2,
              MobilePhone: c.MobilePhone,
              E_Mail: c.Email
            })
          )
        }) as SapBusinessPartnerBody

        const result = await sapFetch(dbCode, 'bp.create', { body })

        if (result.ok) {
          const now = new Date()

          //! only the row as sent, a rename during the call would link the wrong code
          const isLinked = await db.$transaction(async (tx) => {
            const linked = await tx.businessPartner.updateMany({
              where: { id: row.id, CardCode: row.CardCode, syncStatus: { not: 'SYNCED' } },
              data: { syncStatus: 'SYNCED', syncedAt: now, syncError: null, updatedBy: userCode }
            })

            if (linked.count === 0) return false

            const children = { where: { dbCode, CardCode: row.CardCode }, data: { syncStatus: 'SYNCED' as const, syncedAt: now, syncError: null } } // prettier-ignore
            await tx.bpAddress.updateMany(children)
            await tx.contact.updateMany(children)

            return true
          })

          if (isLinked) succeeded++
          else errors.push({ key: row.id, label: row.CardCode, entries: [{ field: label, message: `Created in SAP as ${row.CardCode}, but the ${label.toLowerCase()} changed meanwhile. Run Sync from SAP to link it.` }] }) // prettier-ignore

          continue
        }

        //! never turn a synced row back to failed, another push may have won the race
        await db.businessPartner.updateMany({
          where: { id: row.id, syncStatus: { not: 'SYNCED' } },
          data: { syncStatus: 'FAILED', syncError: result.message, updatedBy: userCode }
        })

        const message = /already exist/i.test(result.message) ? `${result.message.replace(/\.$/, '')}. Run Sync from SAP to link it.` : result.message // prettier-ignore
        errors.push({ key: row.id, label: row.CardCode, entries: [{ field: 'SAP Error', message }] })
      }

      const data: BatchStepResult = { succeeded, errors }

      return { status: 200, error: false, message: `${succeeded} of ${ids.length} synced to SAP`, action: actionTag, data }
    } catch (err: any) {
      logger.error(err, `[${actionTag}_ERROR]:`)
      return { status: 500, error: true, message: err instanceof Error ? err.message : 'Something went wrong!', action: actionTag }
    }
  })
