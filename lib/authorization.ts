import { redirect } from 'next/navigation'

import { UNAUTHORIZED_ROUTE } from '@/constants/common'
import { Action, AppAbility, Subject } from './rbac'

//! page guards fail closed, no session or no ability redirects instead of rendering
//* takes an already-resolved ability so pages keep fetching it in parallel with their record
export function authorizePage(ability: AppAbility, action: Action, subject: Subject) {
  if (!ability?.can(action, subject)) redirect(UNAUTHORIZED_ROUTE)
}
