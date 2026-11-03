import { getCurrentUserWithAbility } from '@/actions/user'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { authorizePage } from '@/lib/authorization'
import ContentContainer from '../_components/content-container'
import UnderDevelopment from '@/components/under-development'

export default async function DashboardPage() {
  const currentUserWithAbility = await getCurrentUserWithAbility()

  //* check authorization for view
  authorizePage(currentUserWithAbility?.ability, PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.DASHBOARD)

  return (
    <ContentContainer>
      <UnderDevelopment title='Dashboard' description='The dashboard is under development. Check back soon.' />
    </ContentContainer>
  )
}
