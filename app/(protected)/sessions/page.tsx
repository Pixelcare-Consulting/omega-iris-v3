import { getCurrentUserWithAbility } from '@/actions/user'
import { getSessionFilterOptions, getSessionSiteOptions } from '@/actions/session'
import { getCurrentDbCode } from '@/lib/sap/access'
import { authorizePage } from '@/lib/authorization'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import ContentContainer from '../_components/content-container'
import SessionContent from './_components/session-content'

export default async function SessionsPage() {
  const dbCode = await getCurrentDbCode()

  const [currentUserWithAbility, sites, filterOptions] = await Promise.all([
    getCurrentUserWithAbility(),
    getSessionSiteOptions(dbCode),
    getSessionFilterOptions(dbCode)
  ])

  //* check authorization for view
  authorizePage(currentUserWithAbility?.ability, PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.SESSIONS)

  return (
    <ContentContainer>
      {/* //* renderedAt changes on every router.refresh, so the session bar's actions reload the cards too */}
      <SessionContent
        sites={sites}
        siteOptions={filterOptions.siteOptions}
        userOptions={filterOptions.userOptions}
        renderedAt={Date.now()}
      />
    </ContentContainer>
  )
}
