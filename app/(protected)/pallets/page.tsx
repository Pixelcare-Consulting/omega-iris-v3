import { getCurrentUserWithAbility } from '@/actions/user'
import { getProjectCategoryOptions } from '@/actions/project-category'
import { getCustomerProjectOptions } from '@/actions/customer-project'
import { getLocationOptions } from '@/actions/location'
import { getCurrentDbCode } from '@/lib/sap/access'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { authorizePage } from '@/lib/authorization'
import ContentContainer from '../_components/content-container'
import PalletContent from './_components/pallet-content'

export default async function PalletsPage() {
  const dbCode = await getCurrentDbCode()

  const [currentUserWithAbility, categoryOptions, projectOptions, locationOptions] = await Promise.all([
    getCurrentUserWithAbility(),
    getProjectCategoryOptions(dbCode),
    getCustomerProjectOptions(dbCode),
    getLocationOptions(dbCode)
  ])

  //* check authorization for view
  authorizePage(currentUserWithAbility?.ability, PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.PALLETS)

  return (
    <ContentContainer>
      <PalletContent categoryOptions={categoryOptions} projectOptions={projectOptions} locationOptions={locationOptions} />
    </ContentContainer>
  )
}
