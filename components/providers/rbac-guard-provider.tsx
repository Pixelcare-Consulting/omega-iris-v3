'use client'

import { useEffect, useMemo } from 'react'

import { useRouter } from 'nextjs-toploader/app'
import { usePathname } from 'next/navigation'

import { AbilityContext } from '@/contexts/ability'
import { MENU_GROUPS } from '@/constants/config'
import { findMenuItemByUrl } from '@/lib/config'
import { SUPER_USER_ROLE_KEY } from '@/constants/role'
import { AppAbility, buildAbilityFor, DefineRulesUser } from '@/lib/rbac'
import { UNAUTHORIZED_ROUTE } from '@/constants/common'

type RBACGuardProviderProps = {
  children: React.ReactNode
  user: DefineRulesUser | null
}

//* RBAC, permissions are assigned to roles and users are assigned to roles
//! `user` comes from the server layout, never `authClient.useSession()`, the client hook resolves only after hydration
//* `router.refresh()` after a mutation re-renders the layout that feeds this prop
export default function RBACGuardProvider({ children, user }: RBACGuardProviderProps) {
  const router = useRouter()
  const pathname = usePathname()

  //* the ability comes straight from the user, no effect or state needed
  const ability = useMemo<AppAbility | undefined>(() => {
    if (!user) return undefined

    if (user.roleKey === SUPER_USER_ROLE_KEY) {
      return buildAbilityFor({ roleKey: user.roleKey, rolePermissions: [] })
    }

    return buildAbilityFor({ roleKey: user.roleKey, rolePermissions: user.rolePermissions })
  }, [user])

  useEffect(() => {
    if (!ability || !user) return
    if (pathname === UNAUTHORIZED_ROUTE) return

    //* user profile, /users/<USER_CODE>/profile
    const userProfilePaths = /^\/users\/\d+\/profile$/

    //* white list routes
    if (userProfilePaths.test(pathname)) return

    const menuItem = findMenuItemByUrl(MENU_GROUPS, pathname)

    if (!menuItem || !menuItem.actions || !menuItem.subjects) return

    const actions = Array.isArray(menuItem.actions) ? menuItem.actions : [menuItem.actions]
    const subjects = Array.isArray(menuItem.subjects) ? menuItem.subjects : [menuItem.subjects]

    const isAllowed = actions.some((act) => subjects.some((sub) => ability.can(act, sub)))

    if (!isAllowed) router.push(UNAUTHORIZED_ROUTE)
  }, [ability, user, pathname])

  if (ability) return <AbilityContext.Provider value={ability}>{children}</AbilityContext.Provider>

  return <>{children}</>
}
