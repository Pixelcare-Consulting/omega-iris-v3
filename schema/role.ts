import { z } from 'zod'

const rolePermissionsFormSchema = z.object({
  code: z.string().trim().min(1, { message: 'Id is required' }),
  actions: z.array(z.string().trim())
})

export const roleFormSchema = z.object({
  code: z.coerce.number(),
  key: z.string().trim(),
  name: z.string().trim().min(1, { message: 'Name is required' }),
  description: z.string().trim().nullish(),
  color: z.string().trim().nullish(),
  permissions: z.array(rolePermissionsFormSchema),
  roles: z.array(z.coerce.number()),
  sapDatabases: z.array(z.string().trim()) //* db codes the role may pick
})

export type RoleForm = z.infer<typeof roleFormSchema>
