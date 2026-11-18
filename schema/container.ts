import { z } from 'zod'

import { optionalString } from './common'
import { CONTAINER_GENERATE_MAX_LINES, CONTAINER_GENERATE_MAX_ROWS, CONTAINER_TYPES } from '@/constants/container'
import { STORAGE_UNIT_STATUSES } from '@/constants/storage-unit'

const containerProjectShape = {
  isGeneralPurpose: z.boolean(),
  projectCategoryCode: optionalString,
  customerProjectCode: optionalString,
  palletCode: optionalString
}

type ContainerProjectValues = {
  isGeneralPurpose: boolean
  projectCategoryCode?: string | null
  customerProjectCode?: string | null
  palletCode?: string | null
}

//* category and project are required unless general purpose, the pallet is always optional
const refineContainerProject = (data: ContainerProjectValues, ctx: z.RefinementCtx) => {
  if (data.isGeneralPurpose) return

  if (!data.projectCategoryCode) ctx.addIssue({ code: 'custom', path: ['projectCategoryCode'], message: 'Project category is required' })
  if (!data.customerProjectCode) ctx.addIssue({ code: 'custom', path: ['customerProjectCode'], message: 'Customer project is required' })
}

//* a cleared picker sends '', read as not picked
const containerTypeSchema = z.preprocess((value) => value || undefined, z.enum(CONTAINER_TYPES, { message: 'Type is required' }))

export const containerFormSchema = z
  .object({
    id: optionalString,
    code: optionalString, //* display only, the server assigns it
    locationCode: z.string().trim().min(1, { message: 'Location is required' }),
    type: containerTypeSchema,
    status: z.enum(STORAGE_UNIT_STATUSES, { message: 'Pick a valid status' }),
    ...containerProjectShape
  })
  .superRefine(refineContainerProject)

export type ContainerForm = z.infer<typeof containerFormSchema>

export const containerGenerateLineSchema = z
  .object({
    ...containerProjectShape,
    type: containerTypeSchema,
    quantity: z.coerce.number<number>().int({ message: 'Whole numbers only' }).min(1, { message: 'At least 1' })
  })
  .superRefine(refineContainerProject)

export type ContainerGenerateLine = z.infer<typeof containerGenerateLineSchema>

export const containerGenerateFormSchema = z
  .object({
    locationCode: z.string().trim().min(1, { message: 'Location is required' }),
    //* caps keep a crafted request from making too many
    lines: z
      .array(containerGenerateLineSchema)
      .min(1, { message: 'Add at least one line' })
      .max(CONTAINER_GENERATE_MAX_LINES, { message: `A run can have at most ${CONTAINER_GENERATE_MAX_LINES} lines` })
  })
  .superRefine((data, ctx) => {
    const total = data.lines.reduce((sum, line) => sum + line.quantity, 0)

    if (total > CONTAINER_GENERATE_MAX_ROWS) {
      ctx.addIssue({ code: 'custom', path: ['lines'], message: `A run can make at most ${CONTAINER_GENERATE_MAX_ROWS} containers` })
    }
  })

export type ContainerGenerateForm = z.infer<typeof containerGenerateFormSchema>

//* [] is general purpose, otherwise [category, project], kept apart since codes can hold '-'
export const containerPrefixesSchema = z.object({ prefixes: z.array(z.array(z.string()).max(2)).max(CONTAINER_GENERATE_MAX_LINES) })
