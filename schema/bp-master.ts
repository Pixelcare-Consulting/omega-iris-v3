import { z } from 'zod'

import { codeParamsSchema, optionalNumber, optionalString } from './common'
import { dataTableParamsSchema } from './data-table'

//* sap caps a card code at 15 characters
export const CARD_CODE_MAX_LENGTH = 15

export const bpMasterTypeSchema = z.enum(['C', 'S'])
export const bpAddressTypeSchema = z.enum(['B', 'S'])

//* trimmed and case-insensitive, the same match the save and the pickers use
export function isSameName(a?: string | null, b?: string | null) {
  if (!a || !b) return false
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

//! 'add' is the create page url, a partner with that code could never be opened
export const cardCodeSchema = z
  .string()
  .trim()
  .min(1, { message: 'Code is required' })
  .max(CARD_CODE_MAX_LENGTH, { message: `Code must be at most ${CARD_CODE_MAX_LENGTH} characters` })
  .refine((code) => code.toLowerCase() !== 'add', { message: "Code cannot be 'add'" })

export const bpAddressFormSchema = z.object({
  id: optionalString,
  AddressName: z.string().trim().min(1, { message: 'Address name is required' }).max(50, { message: 'Address name must be at most 50 characters' }), // prettier-ignore
  AddrType: bpAddressTypeSchema,
  Street: optionalString,
  Address2: optionalString,
  Address3: optionalString,
  StreetNo: optionalString,
  BuildingFloorRoom: optionalString,
  Block: optionalString,
  City: optionalString,
  ZipCode: optionalString,
  County: optionalString,
  CountryCode: optionalString,
  StateCode: optionalString
})

export const bpContactFormSchema = z.object({
  id: optionalString,
  ContactName: z.string().trim().min(1, { message: 'Contact name is required' }).max(50, { message: 'Contact name must be at most 50 characters' }), // prettier-ignore
  FirstName: optionalString,
  LastName: optionalString,
  Title: optionalString,
  Position: optionalString,
  Phone1: optionalString,
  Phone2: optionalString,
  MobilePhone: optionalString,
  Email: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v ? v : null))
    .refine((v) => !v || z.email().safeParse(v).success, { message: 'Please enter a valid email' })
})

export const bpMasterFormSchema = z
  .object({
    id: optionalString,
    CardType: bpMasterTypeSchema,
    CardCode: cardCodeSchema,
    CardName: z.string().trim().min(1, { message: 'Name is required' }).max(100, { message: 'Name must be at most 100 characters' }),
    GroupCode: optionalNumber,
    CurrCode: optionalString,
    GroupNum: optionalNumber,
    AcctType: optionalString,
    CmpPrivate: optionalString,
    BillToDef: optionalString,
    ShipToDef: optionalString,
    CntctPrsn: optionalString,
    isActive: z.boolean(),
    addresses: z.array(bpAddressFormSchema),
    contacts: z.array(bpContactFormSchema)
  })
  .superRefine((data, ctx) => {
    //* duplicate names within the arrays, address names only clash within their type
    data.addresses.forEach((address, index) => {
      const isDuplicate = data.addresses.some(
        (other, i) => i < index && other.AddrType === address.AddrType && isSameName(other.AddressName, address.AddressName)
      )
      if (isDuplicate) ctx.addIssue({ code: 'custom', path: ['addresses', index, 'AddressName'], message: 'Address name already exists' })
    })

    data.contacts.forEach((contact, index) => {
      const isDuplicate = data.contacts.some((other, i) => i < index && isSameName(other.ContactName, contact.ContactName))
      if (isDuplicate) ctx.addIssue({ code: 'custom', path: ['contacts', index, 'ContactName'], message: 'Contact name already exists' })
    })

    //* a pick must point at a record in the form
    const billToNames = data.addresses.filter((a) => a.AddrType === 'B').map((a) => a.AddressName)
    const shipToNames = data.addresses.filter((a) => a.AddrType === 'S').map((a) => a.AddressName)

    const picks = [
      { field: 'BillToDef', value: data.BillToDef, names: billToNames, message: 'Pick an existing billing address' },
      { field: 'ShipToDef', value: data.ShipToDef, names: shipToNames, message: 'Pick an existing shipping address' },
      { field: 'CntctPrsn', value: data.CntctPrsn, names: data.contacts.map((c) => c.ContactName), message: 'Pick an existing contact' }
    ]

    picks.forEach((pick) => {
      if (pick.value && !pick.names.some((name) => isSameName(name, pick.value))) {
        ctx.addIssue({ code: 'custom', path: [pick.field], message: pick.message })
      }
    })
  })

export const bpMasterTableParamsSchema = dataTableParamsSchema.extend({ type: bpMasterTypeSchema })

export const bpMasterCodeParamsSchema = codeParamsSchema.extend({ type: bpMasterTypeSchema })

export const bpMasterTypeParamsSchema = z.object({ type: bpMasterTypeSchema })

//* a synced partner only saves its portal fields, sap's own data skips the form rules
export const bpMasterActiveSchema = z.object({ id: z.string().min(1), type: bpMasterTypeSchema, isActive: z.boolean() })

//* the page loads the lookups once and sends them with every page
export const bpMasterSyncFromSapPageSchema = z.object({
  type: bpMasterTypeSchema,
  startedAt: z.iso.datetime(), //* the run's start, ties its activity rows to one batch
  since: z.string().nullable(),
  skip: z.number().int().min(0),
  metaData: z.object({
    groups: z.array(z.object({ Code: z.number(), Name: z.string() })),
    currencies: z.array(z.object({ Code: z.string(), Name: z.string() })),
    paymentTerms: z.array(z.object({ GroupNumber: z.number(), PaymentTermsGroupName: z.string() })),
    countries: z.array(z.object({ Code: z.string(), Name: z.string() }))
  })
})

export const bpMasterSyncFinishSchema = z.object({ type: bpMasterTypeSchema, startedAt: z.iso.datetime(), count: z.number().int().min(0) })

export const bpMasterSyncFailSchema = z.object({ type: bpMasterTypeSchema, message: z.string().min(1) })

export const bpMasterSyncToSapSchema = z.object({ type: bpMasterTypeSchema, ids: z.array(z.string().min(1)).min(1).max(20) })

export type BpAddressForm = z.infer<typeof bpAddressFormSchema>
export type BpContactForm = z.infer<typeof bpContactFormSchema>
export type BpMasterForm = z.infer<typeof bpMasterFormSchema>
export type BpMasterFormValues = z.input<typeof bpMasterFormSchema>
export type BpMasterTableParams = z.infer<typeof bpMasterTableParamsSchema>
export type BpMasterCodeParams = z.infer<typeof bpMasterCodeParamsSchema>
export type BpMasterSyncMetaData = z.infer<typeof bpMasterSyncFromSapPageSchema>['metaData']
