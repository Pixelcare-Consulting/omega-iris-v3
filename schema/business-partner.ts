import { z } from 'zod'

import { dataTableParamsSchema } from '@/schema/data-table'

//* field names match the service layer, so the body maps almost one to one

const optionalText = (max: number) => z.string().trim().max(max, `Must be at most ${max} characters`).nullish()

const optionalEmail = z.union([z.literal(''), z.email('E-Mail is invalid').trim().max(100, 'Must be at most 100 characters')]).nullish()

export const bpAddressFormSchema = z.object({
  AddressName: z.string().trim().min(1, 'Address ID is required').max(50, 'Must be at most 50 characters'),
  AddressName2: optionalText(50),
  AddressName3: optionalText(50),
  AddressType: z.enum(['bo_BillTo', 'bo_ShipTo'], { message: 'Address Type is required' }),
  Street: optionalText(100),
  City: optionalText(100),
  ZipCode: optionalText(20),
  Country: optionalText(3),
  State: optionalText(3)
})

export const contactEmployeeFormSchema = z.object({
  Name: z.string().trim().min(1, 'Contact ID is required').max(50, 'Must be at most 50 characters'),
  Title: optionalText(10),
  Position: optionalText(90),
  E_Mail: optionalEmail,
  Address: optionalText(100),
  Phone1: optionalText(20),
  Phone2: optionalText(20),
  MobilePhone: optionalText(50),
  Active: z.boolean()
})

export const businessPartnerFormSchema = z
  .object({
    CardCode: z.string().trim(), //* empty on create, sap assigns it
    CardType: z.enum(['cCustomer', 'cSupplier', 'cLid'], { message: 'BP Type is required' }),
    CardName: z.string().trim().min(1, 'Name is required').max(100, 'Must be at most 100 characters'),
    GroupCode: z.coerce.number().int().positive('Group is required'),
    Currency: optionalText(3),
    FederalTaxID: optionalText(32),
    CompanyPrivate: z.enum(['cCompany', 'cPrivate', 'cGovernment', 'cEmployee'], { message: 'Type of Business is required' }),
    SalesPersonCode: z.coerce.number().int(),
    Phone1: optionalText(20),
    Phone2: optionalText(20),
    Cellular: optionalText(50),
    EmailAddress: optionalEmail,
    BilltoDefault: optionalText(50),
    ShipToDefault: optionalText(50),
    ContactPerson: optionalText(50),
    isActive: z.boolean(),
    BPAddresses: z.array(bpAddressFormSchema),
    ContactEmployees: z.array(contactEmployeeFormSchema)
  })
  .superRefine((form, ctx) => {
    //* address id is unique per address type
    const addressKeys = form.BPAddresses.map((address) => `${address.AddressType}:${address.AddressName.toLowerCase()}`)
    if (new Set(addressKeys).size !== addressKeys.length) {
      ctx.addIssue({ code: 'custom', path: ['BPAddresses'], message: 'Address ID must be unique per Address Type' })
    }

    const contactNames = form.ContactEmployees.map((contact) => contact.Name.toLowerCase())
    if (new Set(contactNames).size !== contactNames.length) {
      ctx.addIssue({ code: 'custom', path: ['ContactEmployees'], message: 'Contact ID must be unique' })
    }

    //* each default must point at a row in the form
    const hasAddress = (type: string, name?: string | null) =>
      !name || form.BPAddresses.some((address) => address.AddressType === type && address.AddressName === name)

    if (!hasAddress('bo_BillTo', form.BilltoDefault)) {
      ctx.addIssue({ code: 'custom', path: ['BilltoDefault'], message: 'Bill-to Default must be one of the Bill To addresses' })
    }

    if (!hasAddress('bo_ShipTo', form.ShipToDefault)) {
      ctx.addIssue({ code: 'custom', path: ['ShipToDefault'], message: 'Ship-to Default must be one of the Ship To addresses' })
    }

    if (form.ContactPerson && !form.ContactEmployees.some((contact) => contact.Name === form.ContactPerson)) {
      ctx.addIssue({ code: 'custom', path: ['ContactPerson'], message: 'Contact Person must be one of the contacts' })
    }
  })

export const businessPartnerCodeSchema = z.object({ code: z.string().trim().min(1, 'Code is required') })

//* the lookups the list page already fetched, sent along so each table request skips them
export const businessPartnerTableLookupsSchema = z.object({
  groups: z.array(z.object({ Code: z.number(), Name: z.string(), Type: z.enum(['bbpgt_CustomerGroup', 'bbpgt_VendorGroup']) })),
  salesPersons: z.array(z.object({ SalesEmployeeCode: z.number(), SalesEmployeeName: z.string(), Active: z.enum(['tYES', 'tNO']) })),
  currencies: z.array(z.object({ Code: z.string(), Name: z.string() }))
})

export const businessPartnerTableParamsSchema = dataTableParamsSchema.extend({ lookups: businessPartnerTableLookupsSchema })

export type BPAddressForm = z.infer<typeof bpAddressFormSchema>
export type ContactEmployeeForm = z.infer<typeof contactEmployeeFormSchema>
export type BusinessPartnerForm = z.infer<typeof businessPartnerFormSchema>
export type BusinessPartnerTableLookups = z.infer<typeof businessPartnerTableLookupsSchema>
export type BusinessPartnerTableParams = z.infer<typeof businessPartnerTableParamsSchema>
