'use server'

import { headers } from 'next/headers'

import db from '@/lib/db'
import { auth } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { action } from '@/lib/safe-action'
import { signinFormSchema } from '@/schema/auth'
import { getUserByEmail } from './user'
import { safeParseInt } from '@/lib/utils'

export const signinUser = action.inputSchema(signinFormSchema).action(async ({ parsedInput: data }) => {
  const { email, password, callbackUrl } = data

  try {
    const user = await getUserByEmail(email)

    //* Check if user exists
    //! load-bearing for soft deletes - getUserByEmail filters deletedAt, and better-auth's signInEmail below does not.
    //! without this early return a soft-deleted user signs in again with their old password.
    if (!user || !user.email) {
      return { error: true, code: 401, message: 'User does not exist!', action: 'SIGNIN_USER' }
    }

    //* check if user is locked
    if (user.isLocked) {
      return { error: true, code: 401, message: 'Account is locked!. Please contact your administrator.', action: 'SIGNIN_USER' }
    }

    //* signin user using email and password
    const authData = await auth.api.signInEmail({
      body: { email, password },
      headers: await headers() //* optional but would be useful to get the user IP, user agent, etc.
    })

    //* update last sign in
    await db.user.update({ data: { lastSignin: new Date(), failedLoginAttempts: 0 }, where: { id: authData.user.id } })

    return { status: 200, message: 'Signed in successfully!', action: 'SIGNIN_USER', data: { authData, callbackUrl } }
  } catch (err: any) {
    logger.error(err, '[SIGNIN_USER_ERROR]:')

    const maxSigninAttempts = safeParseInt(process.env.SIGNIN_MAXIMUM_ATTEMPTS) || 5

    switch (err.statusCode) {
      case 401: {
        const user = await getUserByEmail(email)

        //* if user exist, not locked and user's failed sigin attempts does not reach the limit, then increase failed signin attempts
        if (user && !user.isLocked && user.failedLoginAttempts < maxSigninAttempts) {
          await db.user.update({
            where: { code: user.code },
            data: { failedLoginAttempts: { increment: 1 } }
          })
        }

        //* if user exist , not locked  and user's failed sigin attempts reach the limit, then lock the user
        if (user && !user.isLocked && user.failedLoginAttempts >= maxSigninAttempts - 1) {
          await db.user.update({
            where: { code: user.code },
            data: { isLocked: true }
          })
        }

        return { status: 401, error: true, message: 'Invalid credentials!', action: 'SIGNIN_USER' }
      }

      default:
        return { status: 500, error: true, message: 'Something went wrong! Please try again later', action: 'SIGNIN_USER' }
    }
  }
})

export const signoutUser = action.action(async () => {
  try {
    //* signout user
    await auth.api.signOut({ headers: await headers() })
  } catch (err: any) {
    logger.error(err, '[SIGNOUT_USER_ERROR]:')
    return { status: 500, error: true, message: 'Something went wrong! Please try again later', action: 'SIGNOUT_USER' }
  }
})
