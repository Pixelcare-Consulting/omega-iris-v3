import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { auth } from '@/lib/auth'
import { getSapDatabaseAccess, setSessionDbCode } from '@/lib/sap/access'
import { CHOOSE_DATABASE_ROUTE, PATHNAME_HEADER } from '@/constants/routes'
import RBACGuardProvider from '@/components/providers/rbac-guard-provider'
import AppPanelLayout from './_components/app-panel-layout'
import { SapDatabase } from '@/prisma/generated/client'

export default async function ProtectedRouteLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers()

  //* the ability-driven sidebar needs the session at render time, so it is resolved here and passed down rather than fetched client-side
  const session = await auth.api.getSession({ headers: requestHeaders })

  let sapDatabases: SapDatabase[] = []

  //* the session keeps the database it was given, so access removed after picking is caught here
  if (session?.session.dbCode) {
    const access = await getSapDatabaseAccess(session.session.dbCode, session.user?.roleCode)
    const { isAllowed, isError } = access

    //* passed to the switcher so its label has the name on first render
    sapDatabases = access.sapDatabases

    //! a failed lookup is not lost access, show the error page instead of clearing the database
    if (isError) throw new Error('Could not check SAP database access.')

    //* clear it rather than send them to /unauthorized, the choose page lets them pick again or sign out
    if (!isAllowed) {
      await setSessionDbCode(session.session.token, null)

      const pathname = requestHeaders.get(PATHNAME_HEADER)
      redirect(pathname ? `${CHOOSE_DATABASE_ROUTE}?callbackUrl=${encodeURIComponent(pathname)}` : CHOOSE_DATABASE_ROUTE)
    }
  }

  const user = session?.user ? { roleKey: session.user.roleKey, rolePermissions: session.user.rolePermissions } : null

  return (
    <RBACGuardProvider user={user}>
      <AppPanelLayout user={session?.user ?? null} dbCode={session?.session.dbCode ?? null} sapDatabases={sapDatabases}>
        {children}
      </AppPanelLayout>
    </RBACGuardProvider>
  )
}
