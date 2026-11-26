import { getCurrentUserWithAbility } from '@/actions/user'
import { getCustomerProjectOptions } from '@/actions/customer-project'
import { getLocationOptions } from '@/actions/location'
import { getContainerOptions } from '@/actions/container'
import { getCurrentDbCode } from '@/lib/sap/access'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { authorizePage } from '@/lib/authorization'
import ContentContainer from '../_components/content-container'
import PackagingUnitContent from './_components/packaging-unit-content'

export default async function PackagingUnitsPage() {
  const dbCode = await getCurrentDbCode()

  const [currentUserWithAbility, projectOptions, locationOptions, containerOptions] = await Promise.all([
    getCurrentUserWithAbility(),
    getCustomerProjectOptions(dbCode),
    getLocationOptions(dbCode),
    getContainerOptions(dbCode)
  ])

  //* check authorization for view
  authorizePage(currentUserWithAbility?.ability, PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.PACKAGING_UNITS)

  return (
    <ContentContainer>
      <PackagingUnitContent projectOptions={projectOptions} locationOptions={locationOptions} containerOptions={containerOptions} />
    </ContentContainer>
  )
}
