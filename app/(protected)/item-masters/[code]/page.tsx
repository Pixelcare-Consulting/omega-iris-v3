import { notFound } from 'next/navigation'

import { getCurrentUserWithAbility } from '@/actions/user'
import { getItemMasterByCode } from '@/actions/item-master'
import { getCurrentDbCode } from '@/lib/sap/access'
import { decodeItemMasterCode } from '@/lib/item-master'
import ContentContainer from '../../_components/content-container'
import ItemMasterForm from '../_components/item-master-form'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { authorizePage } from '@/lib/authorization'

export default async function ItemMasterPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const isAdd = code === 'add'

  const dbCode = await getCurrentDbCode()

  const [itemMaster, currentUserWithAbility] = await Promise.all([
    isAdd ? null : getItemMasterByCode(dbCode, decodeItemMasterCode(code)),
    getCurrentUserWithAbility()
  ])

  //* check authorization for create, edit
  const requiredAction = isAdd ? PERMISSIONS_ALLOWED_ACTIONS.CREATE : PERMISSIONS_ALLOWED_ACTIONS.EDIT
  authorizePage(currentUserWithAbility?.ability, requiredAction, PERMISSIONS_CODES.ITEM_MASTERS)

  if (!isAdd && !itemMaster) notFound()

  const pageMetaData = isAdd
    ? { title: 'Add Item', description: 'Fill in the form to create a new item.' }
    : { title: 'Edit Item', description: "Edit the form to update this item's information." }

  return (
    <ContentContainer>
      <ItemMasterForm pageMetaData={pageMetaData} itemMaster={itemMaster} />
    </ContentContainer>
  )
}
