import { z } from 'zod'

import { toUsername } from '@/lib/user'
import { optionalString } from '@/schema/common'

export const userFormSchema = z
  .object({
    code: z.coerce.number(),
    fname: z.string().trim().min(1, 'First Name is required'),
    lname: z.string().trim().min(1, 'Last Name is required'),
    mname: z.string().trim().nullish(),
    suffix: z.string().trim().nullish(),
    username: z
      .string()
      .trim()
      .min(1, 'Username is required')
      .transform(toUsername)
      //! .min(1) runs before the transform, so an all-punctuation input like '!!!' would otherwise normalize to ''
      .refine((value) => value.length > 0, { message: 'Username must contain at least one letter or number' }),
    email: z.email('Email is invalid').trim().min(1, 'Email is required'),
    employeeId: optionalString.transform((v) => v?.toUpperCase() ?? null),
    isInternal: z.boolean(),
    password: z.string().nullish(),
    confirmPassword: z.string().nullish(),
    roleCode: z.coerce.number().min(1, { message: 'Role is required' }),
    roleKey: z.string().trim().min(1, { message: 'Role key is required' }),
    isActive: z.boolean(),
    newPassword: z.string().nullish(),
    newConfirmPassword: z.string().nullish(),
    isForceToChangePassword: z.boolean().nullish(),
    isLocked: z.boolean().nullish()
  })
  .refine(
    (formObj) => {
      if (formObj.code && formObj.code === -1) {
        if (formObj.password && formObj.password !== null && formObj.password !== undefined) return formObj.password.length >= 8
      } else return true
    },
    { message: 'Password must be at least 8 characters', path: ['password'] }
  )
  .refine(
    (formObj) => {
      if (formObj.code && formObj.code === -1) {
        if (formObj.confirmPassword && formObj.confirmPassword !== null && formObj.confirmPassword !== undefined)
          return formObj.confirmPassword.length >= 8
      } else return true
    },
    { message: 'Confirm password must be at least 8 characters', path: ['confirmPassword'] }
  )
  .refine(
    (formObj) => {
      if (formObj.code && formObj.code === -1) return formObj.password === formObj.confirmPassword
      else return true
    },
    { message: "Passwords don't match", path: ['confirmPassword'] }
  )
  .refine(
    (formObj) => {
      if (formObj.code && formObj.code !== -1) {
        if (formObj.newPassword !== null && formObj.newPassword !== undefined && formObj.newPassword.length > 0) {
          return formObj.newPassword.length >= 8
        }
      }

      return true
    },
    { message: 'New password must be at least 8 characters', path: ['newPassword'] }
  )
  .refine(
    (formObj) => {
      if (formObj.code && formObj.code !== -1) {
        if (
          formObj.newPassword !== null &&
          formObj.newPassword !== undefined &&
          formObj.newPassword.length >= 8 &&
          formObj.newConfirmPassword !== null &&
          formObj.newConfirmPassword !== undefined
        )
          return formObj.newConfirmPassword.length >= 8
      }

      return true
    },
    { message: 'new confirm password must be at least 8 characters', path: ['newConfirmPassword'] }
  )
  .refine(
    (formObj) => {
      if (formObj.code && formObj.code !== -1) {
        if (
          formObj.newPassword !== null &&
          formObj.newPassword !== undefined &&
          formObj.newPassword.length >= 8 &&
          formObj.newConfirmPassword !== null &&
          formObj.newConfirmPassword !== undefined &&
          formObj.newConfirmPassword.length >= 8
        )
          return formObj.newPassword === formObj.newConfirmPassword
      }

      return true
    },
    { message: "New confirm passwords don't match", path: ['newConfirmPassword'] }
  )

export const basicInfoFormSchema = z.object({
  code: z.coerce.number(),
  fname: z.string().trim().min(1, { message: 'First name is required' }),
  lname: z.string().trim().min(1, { message: 'Last name is required' }),
  mname: z.string().trim().nullish(),
  suffix: z.string().trim().nullish(),
  //* same normalization as userFormSchema, the profile form edits the same column
  username: z
    .string()
    .trim()
    .min(1, { message: 'Username is required' })
    .transform(toUsername)
    .refine((value) => value.length > 0, { message: 'Username must contain at least one letter or number' }),
  email: z.string().trim().email().min(1, { message: 'Email is required' }),
  roleCode: z.coerce.number().min(1, { message: 'Role is required' }),
  roleKey: z.string().trim().min(1, { message: 'Role key is required' }),
  isActive: z.boolean()
})

export const changePasswordFormSchema = z
  .object({
    code: z.coerce.number(),
    oldPassword: z.string().min(8, { message: 'Old password must be at least 8 characters long' }).nullish(),
    newPassword: z.string().min(8, { message: 'New password must be at least 8 characters long' }).nullish(),
    newConfirmPassword: z.string().min(8, { message: 'New confirm password must be at least 8 characters long' }).nullish()
  })
  .refine(
    (formObj) => {
      if (formObj.oldPassword && formObj.oldPassword !== null && formObj.oldPassword !== undefined) {
        return formObj.oldPassword.length >= 8
      }

      return true
    },
    { message: 'Old password must be at least 8 characters', path: ['oldPassword'] }
  )
  .refine(
    (formObj) => {
      if (formObj.oldPassword && formObj.oldPassword !== null && formObj.oldPassword !== undefined) {
        if (formObj.newPassword !== null && formObj.newPassword !== undefined) {
          return formObj.newPassword.length >= 8
        } else return true
      }

      return true
    },
    { message: 'New password must be at least 8 characters', path: ['newPassword'] }
  )
  .refine(
    (formObj) => {
      if (formObj.oldPassword && formObj.oldPassword !== null && formObj.oldPassword !== undefined) {
        if (formObj.newConfirmPassword !== null && formObj.newConfirmPassword !== undefined) {
          return formObj.newConfirmPassword.length >= 8
        } else return true
      }

      return true
    },
    { message: 'new confirm password must be at least 8 characters', path: ['newConfirmPassword'] }
  )
  .refine(
    (formObj) => {
      if (formObj.oldPassword && formObj.oldPassword !== null && formObj.oldPassword !== undefined) {
        if (
          formObj.newPassword &&
          formObj.newPassword !== null &&
          formObj.newPassword !== undefined &&
          formObj.newConfirmPassword &&
          formObj.newConfirmPassword !== null &&
          formObj.newConfirmPassword !== undefined
        ) {
          return formObj.newPassword === formObj.newConfirmPassword
        } else return true
      }

      return true
    },
    { message: "New confirm passwords don't match", path: ['newConfirmPassword'] }
  )

export type UserForm = z.infer<typeof userFormSchema>
export type BasicInfoForm = z.infer<typeof basicInfoFormSchema>
export type ChangePasswordForm = z.infer<typeof changePasswordFormSchema>
