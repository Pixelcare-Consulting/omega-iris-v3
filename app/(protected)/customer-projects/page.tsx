import { getCurrentUserWithAbility } from '@/actions/user'
import { getProjectCategoryOptions } from '@/actions/project-category'
import { getCurrentDbCode } from '@/lib/sap/access'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { authorizePage } from '@/lib/authorization'
import ContentContainer from '../_components/content-container'
import CustomerProjectContent from './_components/customer-project-content'

export default async function CustomerProjectsPage() {
  const dbCode = await getCurrentDbCode()

  const [currentUserWithAbility, categoryOptions] = await Promise.all([
    getCurrentUserWithAbility(),
    getProjectCategoryOptions(dbCode)
  ])

  //* check authorization for view
  authorizePage(currentUserWithAbility?.ability, PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.CUSTOMER_PROJECTS)

  return (
    <ContentContainer>
      <CustomerProjectContent categoryOptions={categoryOptions} />
    </ContentContainer>
  )
}
