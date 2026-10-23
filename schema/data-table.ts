import { z } from 'zod'

export const dataTableParamsSchema = z.object({
  page: z.coerce.number().default(1),
  perPage: z.coerce.number().default(10),
  globalFilter: z.string().optional(),
  sorting: z.array(z.object({ id: z.string(), desc: z.boolean() })).optional(),
  columnFilters: z.array(z.object({ id: z.string(), value: z.unknown() })).optional(),
  isExport: z.boolean().optional(),
  isShowDeleted: z.boolean().optional()
})

export type DataTableParams = z.infer<typeof dataTableParamsSchema>
