import { notFound } from 'next/navigation'

import { getCurrentUserWithAbility } from '@/actions/user'
import { getItemByCode } from '@/actions/item'
import { getCurrentDbCode } from '@/lib/sap/access'
import { decodeCodeParam } from '@/lib/sap/utils'
import ContentContainer from '../../_components/content-container'
import ItemForm from '../_components/item-form'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { authorizePage } from '@/lib/authorization'

export default async function ItemPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const isAdd = code === 'add'

  const [result, currentUserWithAbility] = await Promise.all([
    isAdd ? null : getCurrentDbCode().then((dbCode) => getItemByCode(dbCode, decodeCodeParam(code))),
    getCurrentUserWithAbility()
  ])

  //* check authorization for create, edit
  const requiredAction = isAdd ? PERMISSIONS_ALLOWED_ACTIONS.CREATE : PERMISSIONS_ALLOWED_ACTIONS.EDIT
  authorizePage(currentUserWithAbility?.ability, requiredAction, PERMISSIONS_CODES.ITEMS)

  if (!isAdd && (!result || (!result.ok && result.status === 404))) notFound()

  //* any other sap failure goes to the error page instead of an empty form
  if (result && !result.ok) throw new Error(result.message)

  const pageMetaData = isAdd
    ? { title: 'Add Item', description: 'Fill in the form to create a new item in SAP.' }
    : { title: 'Edit Item', description: "Edit the form to update this item's information in SAP." }

  return (
    <ContentContainer>
      <ItemForm pageMetaData={pageMetaData} item={result?.ok ? result.data : null} />
    </ContentContainer>
  )
}
