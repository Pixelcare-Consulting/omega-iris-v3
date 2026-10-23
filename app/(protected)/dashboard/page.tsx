import { getCurrentUserWithAbility } from '@/actions/user'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { authorizePage } from '@/lib/authorization'
import ContentContainer from '../_components/content-container'

export default async function DashboardPage() {
  const currentUserWithAbility = await getCurrentUserWithAbility()

  //* check authorization for view
  authorizePage(currentUserWithAbility?.ability, PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.DASHBOARD)

  return (
    <ContentContainer>
      <h1>Dashboard</h1>
    </ContentContainer>
  )
}
