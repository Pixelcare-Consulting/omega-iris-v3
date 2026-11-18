import { getCurrentUserWithAbility } from '@/actions/user'
import { getProjectCategoryOptions } from '@/actions/project-category'
import { getCustomerProjectOptions } from '@/actions/customer-project'
import { getLocationOptions } from '@/actions/location'
import { getPalletOptions } from '@/actions/pallet'
import { getCurrentDbCode } from '@/lib/sap/access'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { authorizePage } from '@/lib/authorization'
import ContentContainer from '../_components/content-container'
import ContainerContent from './_components/container-content'

export default async function ContainersPage() {
  const dbCode = await getCurrentDbCode()

  const [currentUserWithAbility, categoryOptions, projectOptions, locationOptions, palletOptions] = await Promise.all([
    getCurrentUserWithAbility(),
    getProjectCategoryOptions(dbCode),
    getCustomerProjectOptions(dbCode),
    getLocationOptions(dbCode),
    getPalletOptions(dbCode)
  ])

  //* check authorization for view
  authorizePage(currentUserWithAbility?.ability, PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.CONTAINERS)

  return (
    <ContentContainer>
      <ContainerContent
        categoryOptions={categoryOptions}
        projectOptions={projectOptions}
        locationOptions={locationOptions}
        palletOptions={palletOptions}
      />
    </ContentContainer>
  )
}
