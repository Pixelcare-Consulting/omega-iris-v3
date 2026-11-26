'use server'

import { headers } from 'next/headers'

import db from '@/lib/db'
import { auth } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { action } from '@/lib/safe-action'
import { signinFormSchema } from '@/schema/auth'
import { getUserByEmail } from './user'
import { safeParseInt } from '@/lib/utils'
import { logActivity } from '@/lib/activity-log'

type SigninUser = { id: string; code: number; name: string } | null

//* the typed email stands in for an unknown user, a logging failure never changes the sign-in result
async function logSignin(action: 'SIGN_IN' | 'SIGN_IN_FAILED' | 'LOCKED_OUT', user: SigninUser, email: string, summary?: string) {
  try {
    await logActivity(db, {
      actor: { userCode: user?.code ?? null, userName: user?.name ?? email, source: 'WEB' },
      module: 'AUTH',
      action,
      ...(user && { entity: { id: user.id, code: user.code, label: user.name } }),
      //* failures and lockouts also show on the user's activity tab, plain sign-ins would crowd it
      ...(user && action !== 'SIGN_IN' && { parent: { module: 'USERS' as const, id: user.id } }),
      ...(summary && { summary })
    })
  } catch (err: any) {
    logger.error(err, '[SIGNIN_ACTIVITY_ERROR]:')
  }
}

export const signinUser = action.inputSchema(signinFormSchema).action(async ({ parsedInput: data }) => {
  const { email, password, callbackUrl } = data

  try {
    const user = await getUserByEmail(email)

    //* Check if user exists
    //! load-bearing for soft deletes - getUserByEmail filters deletedAt, and better-auth's signInEmail below does not.
    //! without this early return a soft-deleted user signs in again with their old password.
    if (!user || !user.email) {
      await logSignin('SIGN_IN_FAILED', null, email, 'Unknown email')
      return { error: true, code: 401, message: 'User does not exist!', action: 'SIGNIN_USER' }
    }

    //* check if user is locked
    if (user.isLocked) {
      await logSignin('SIGN_IN_FAILED', user, email, 'Account is locked')
      return { error: true, code: 401, message: 'Account is locked!. Please contact your administrator.', action: 'SIGNIN_USER' }
    }

    //* signin user using email and password
    const authData = await auth.api.signInEmail({
      body: { email, password },
      headers: await headers() //* optional but would be useful to get the user IP, user agent, etc.
    })

    //* update last sign in
    await db.user.update({ data: { lastSignin: new Date(), failedLoginAttempts: 0 }, where: { id: authData.user.id } })

    await logSignin('SIGN_IN', user, email)

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
        const isLockingNow = !!user && !user.isLocked && user.failedLoginAttempts >= maxSigninAttempts - 1

        if (user && isLockingNow) {
          await db.user.update({
            where: { code: user.code },
            data: { isLocked: true }
          })
        }

        if (isLockingNow) await logSignin('LOCKED_OUT', user, email, `Locked after ${maxSigninAttempts} failed sign-ins`)
        else await logSignin('SIGN_IN_FAILED', user, email, 'Wrong password')

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
