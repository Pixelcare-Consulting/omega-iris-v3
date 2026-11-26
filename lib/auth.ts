import { betterAuth, type BetterAuthOptions } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { customSession } from 'better-auth/plugins'
import { nextCookies } from 'better-auth/next-js'

import db from './db'
import { SESSION_COOKIE_MAX_AGE, SESSION_EXPIRES_IN, SESSION_UPDATE_AGE } from '@/constants/auth'

const sessionOptions = {
  session: {
    additionalFields: {
      //! input false, so /update-session cannot set it and skip the role check
      dbCode: { type: 'string', required: false, input: false }
    }
  }
} satisfies BetterAuthOptions

export const auth = betterAuth({
  emailAndPassword: { enabled: true, autoSignIn: false },
  database: prismaAdapter(db, { provider: 'postgresql' }),
  user: {
    additionalFields: {
      code: { type: 'number', required: false, defaultValue: undefined },
      fname: { type: 'string', required: true },
      lname: { type: 'string', required: true },
      mname: { type: 'string', required: false, defaultValue: undefined },
      suffix: { type: 'string', required: false, defaultValue: undefined },
      name: { type: 'string', required: false, defaultValue: undefined },
      username: { type: 'string', required: true },
      roleCode: { type: 'number', required: true },
      isActive: { type: 'boolean', required: false, defaultValue: true },
      lastSignin: { type: 'date', required: false, defaultValue: undefined },
      isDefaultPasswordChanged: { type: 'boolean', required: false, defaultValue: false },
      isLocked: { type: 'boolean', required: false, defaultValue: false },
      isSystem: { type: 'boolean', required: false, defaultValue: false },
      //! input false, so sign up cannot set them, upsertUser owns both
      isInternal: { type: 'boolean', required: false, defaultValue: false, input: false },
      employeeId: { type: 'string', required: false, defaultValue: undefined, input: false }
    }
  },
  session: {
    modelName: 'authSession',
    additionalFields: sessionOptions.session.additionalFields,
    expiresIn: SESSION_EXPIRES_IN,
    updateAge: SESSION_UPDATE_AGE,
    cookieCache: {
      enabled: true,
      maxAge: SESSION_COOKIE_MAX_AGE
    }
  },
  plugins: [
    customSession(async ({ session }) => {
      const existingUser = await db.user.findUnique({
        where: { id: session.userId },
        select: {
          id: true,
          code: true,
          fname: true,
          lname: true,
          mname: true,
          suffix: true,
          name: true,
          email: true,
          emailVerified: true,
          image: true,
          username: true,
          isActive: true,
          isDefaultPasswordChanged: true,
          isLocked: true,
          isSystem: true,
          isInternal: true,
          employeeId: true,
          role: {
            include: {
              rolePermissions: {
                include: { permission: true }
              }
            }
          }
        }
      })

      let sessionUser = null

      if (existingUser) {
        const { id, code, fname, lname, mname, suffix, name, email, emailVerified, image, username, isActive, isDefaultPasswordChanged, isLocked, isSystem, isInternal, employeeId, role } =  existingUser // prettier-ignore

        const rolePermissions = role.rolePermissions.map((rp) => ({
          id: rp.permission.id,
          code: rp.permission.code,
          actions: rp.actions
        }))

        sessionUser = {
          id,
          code,
          fname,
          lname,
          mname,
          suffix,
          name,
          email,
          emailVerified,
          image,
          username,
          isActive,
          isDefaultPasswordChanged,
          isLocked,
          isSystem,
          isInternal,
          employeeId,
          roleCode: role.code,
          roleName: role.name,
          roleKey: role.key,
          roleColor: role.color,
          rolePermissions
        }
      }

      return { user: sessionUser, session }
    }, sessionOptions),
    //! keep last, better-auth needs it after every plugin that sets cookies
    nextCookies()
  ]
})
