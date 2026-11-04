import { getCurrentUserWithAbility } from '@/actions/user'
import { getProjectCategories } from '@/actions/project-category'
import { getCurrentDbCode } from '@/lib/sap/access'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { authorizePage } from '@/lib/authorization'
import ContentContainer from '../_components/content-container'
import CustomerProjectContent from './_components/customer-project-content'

export default async function CustomerProjectsPage() {
  const [currentUserWithAbility, projectCategories] = await Promise.all([
    getCurrentUserWithAbility(),
    getCurrentDbCode().then((dbCode) => getProjectCategories(dbCode))
  ])

  //* check authorization for view
  authorizePage(currentUserWithAbility?.ability, PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.CUSTOMER_PROJECTS)

  const categoryOptions = projectCategories.map((category) => ({ label: `${category.code} - ${category.name}`, value: category.code }))

  return (
    <ContentContainer>
      <CustomerProjectContent categoryOptions={categoryOptions} />
    </ContentContainer>
  )
}
