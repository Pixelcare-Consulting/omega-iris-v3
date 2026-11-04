import { notFound } from 'next/navigation'

import { getCurrentUserWithAbility } from '@/actions/user'
import { getItemMasterByCode } from '@/actions/item-master'
import { getCurrentDbCode } from '@/lib/sap/access'
import { decodeItemMasterCode } from '@/lib/item-master'
import ContentContainer from '@/app/(protected)/_components/content-container'
import ViewItemMaster from './_components/view-item-master'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { authorizePage } from '@/lib/authorization'

export default async function ItemMasterViewPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const dbCode = await getCurrentDbCode()

  const [itemMaster, currentUserWithAbility] = await Promise.all([
    getItemMasterByCode(dbCode, decodeItemMasterCode(code)),
    getCurrentUserWithAbility()
  ])

  //* check authorization for view
  authorizePage(currentUserWithAbility?.ability, PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.ITEM_MASTERS)

  if (!itemMaster) notFound()

  return (
    <ContentContainer>
      <ViewItemMaster itemMaster={itemMaster} />
    </ContentContainer>
  )
}
