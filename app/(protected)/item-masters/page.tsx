import { getCurrentUserWithAbility } from '@/actions/user'
import { getManufacturerOptions } from '@/actions/manufacturer'
import { getCommodityOptions } from '@/actions/commodity'
import { getCurrentDbCode } from '@/lib/sap/access'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { authorizePage } from '@/lib/authorization'
import ContentContainer from '../_components/content-container'
import ItemMasterContent from './_components/item-master-content'

export default async function ItemMastersPage() {
  const dbCode = await getCurrentDbCode()

  const [currentUserWithAbility, manufacturerOptions, commodityOptions] = await Promise.all([
    getCurrentUserWithAbility(),
    getManufacturerOptions(dbCode),
    getCommodityOptions(dbCode)
  ])

  //* check authorization for view
  authorizePage(currentUserWithAbility?.ability, PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.ITEM_MASTERS)

  return (
    <ContentContainer>
      <ItemMasterContent manufacturerOptions={manufacturerOptions} commodityOptions={commodityOptions} />
    </ContentContainer>
  )
}
