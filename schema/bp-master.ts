import { z } from 'zod'

import { codeParamsSchema, optionalString } from './common'
import { dataTableParamsSchema } from './data-table'

export const bpMasterTypeSchema = z.enum(['C', 'S'])
export const bpAddressTypeSchema = z.enum(['B', 'S'])

//* trimmed and case-insensitive, the same match the save and the pickers use
export function isSameName(a?: string | null, b?: string | null) {
  if (!a || !b) return false
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

export const bpAddressFormSchema = z.object({
  id: optionalString,
  code: optionalString, //* display only, the save generates it
  name: z.string().trim().min(1, { message: 'Address name is required' }),
  type: bpAddressTypeSchema,
  line1: optionalString,
  line2: optionalString,
  line3: optionalString,
  streetNo: optionalString,
  buildingFloorRoom: optionalString,
  block: optionalString,
  city: optionalString,
  zipCode: optionalString,
  countryCode: optionalString,
  stateCode: optionalString
})

export const bpContactPersonFormSchema = z.object({
  id: optionalString,
  code: optionalString, //* display only, the save generates it
  name: z.string().trim().min(1, { message: 'Contact name is required' }),
  email: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v ? v : null))
    .refine((v) => !v || z.email().safeParse(v).success, { message: 'Please enter a valid email' }),
  title: optionalString,
  position: optionalString,
  tel1: optionalString,
  tel2: optionalString,
  phone: optionalString
})

export const bpMasterFormSchema = z
  .object({
    id: optionalString,
    code: optionalString, //* display only, the save generates it
    type: bpMasterTypeSchema,
    name: z.string().trim().min(1, { message: 'Name is required' }).max(100, { message: 'Name must be at most 100 characters' }),
    defaultBillingName: optionalString,
    defaultShippingName: optionalString,
    defaultContactName: optionalString,
    addresses: z.array(bpAddressFormSchema),
    contacts: z.array(bpContactPersonFormSchema)
  })
  .superRefine((data, ctx) => {
    //* duplicate names within the arrays, address names only clash within their type
    data.addresses.forEach((address, index) => {
      const isDuplicate = data.addresses.some(
        (other, i) => i < index && other.type === address.type && isSameName(other.name, address.name)
      )
      if (isDuplicate) ctx.addIssue({ code: 'custom', path: ['addresses', index, 'name'], message: 'Address name already exists' })
    })

    data.contacts.forEach((contact, index) => {
      const isDuplicate = data.contacts.some((other, i) => i < index && isSameName(other.name, contact.name))
      if (isDuplicate) ctx.addIssue({ code: 'custom', path: ['contacts', index, 'name'], message: 'Contact name already exists' })
    })

    //* a pick must point at a record in the form
    const picks = [
      { field: 'defaultBillingName', value: data.defaultBillingName, names: data.addresses.filter((a) => a.type === 'B').map((a) => a.name), message: 'Pick an existing billing address' }, // prettier-ignore
      { field: 'defaultShippingName', value: data.defaultShippingName, names: data.addresses.filter((a) => a.type === 'S').map((a) => a.name), message: 'Pick an existing shipping address' }, // prettier-ignore
      {
        field: 'defaultContactName',
        value: data.defaultContactName,
        names: data.contacts.map((c) => c.name),
        message: 'Pick an existing contact'
      }
    ]

    picks.forEach((pick) => {
      if (pick.value && !pick.names.some((name) => isSameName(name, pick.value))) {
        ctx.addIssue({ code: 'custom', path: [pick.field], message: pick.message })
      }
    })
  })

export const bpMasterTableParamsSchema = dataTableParamsSchema.extend({ type: bpMasterTypeSchema })

export const bpMasterCodeParamsSchema = codeParamsSchema.extend({ type: bpMasterTypeSchema })

export type BpAddressForm = z.infer<typeof bpAddressFormSchema>
export type BpContactPersonForm = z.infer<typeof bpContactPersonFormSchema>
export type BpMasterForm = z.infer<typeof bpMasterFormSchema>
export type BpMasterFormValues = z.input<typeof bpMasterFormSchema>
export type BpMasterTableParams = z.infer<typeof bpMasterTableParamsSchema>
export type BpMasterCodeParams = z.infer<typeof bpMasterCodeParamsSchema>
