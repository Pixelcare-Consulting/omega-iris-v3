import { getCurrentUserWithAbility } from '@/actions/user'
import { getItemMasterLookups } from '@/actions/item-master'
import { getCurrentDbCode } from '@/lib/sap/access'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { authorizePage } from '@/lib/authorization'
import ContentContainer from '../_components/content-container'
import ItemMasterContent from './_components/item-master-content'

export default async function ItemMastersPage() {
  const dbCode = await getCurrentDbCode()

  const [currentUserWithAbility, lookups] = await Promise.all([getCurrentUserWithAbility(), dbCode ? getItemMasterLookups(dbCode) : null])

  //* check authorization for view
  authorizePage(currentUserWithAbility?.ability, PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.ITEM_MASTERS)

  //* the table filters on the saved names, so the options carry names
  const manufacturerOptions = (lookups?.manufacturers ?? []).map((m) => ({ value: m.ManufacturerName, label: m.ManufacturerName }))
  const itemGroupOptions = (lookups?.itemGroups ?? []).map((g) => ({ value: g.GroupName, label: g.GroupName }))

  return (
    <ContentContainer>
      <ItemMasterContent
        manufacturerOptions={manufacturerOptions}
        itemGroupOptions={itemGroupOptions}
        userCode={currentUserWithAbility?.userCode ?? null}
      />
    </ContentContainer>
  )
}
