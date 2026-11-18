import { notFound } from 'next/navigation'

import { getCurrentUserWithAbility } from '@/actions/user'
import { getPalletByCode } from '@/actions/pallet'
import { getCurrentDbCode } from '@/lib/sap/access'
import { decodeCodeParam } from '@/lib/sap/utils'
import ContentContainer from '../../_components/content-container'
import PalletForm from '../_components/pallet-form'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { authorizePage } from '@/lib/authorization'

export default async function PalletPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const isAdd = code === 'add'

  const dbCode = await getCurrentDbCode()

  const [pallet, currentUserWithAbility] = await Promise.all([
    isAdd ? null : getPalletByCode(dbCode, decodeCodeParam(code).toUpperCase()), //* codes are stored uppercase
    getCurrentUserWithAbility()
  ])

  //* check authorization for create, edit
  const requiredAction = isAdd ? PERMISSIONS_ALLOWED_ACTIONS.CREATE : PERMISSIONS_ALLOWED_ACTIONS.EDIT
  authorizePage(currentUserWithAbility?.ability, requiredAction, PERMISSIONS_CODES.PALLETS)

  if (!isAdd && !pallet) notFound()

  const pageMetaData = isAdd
    ? { title: 'Add Pallet', description: 'Fill in the form to create a new pallet.' }
    : { title: 'Edit Pallet', description: "Edit the pallet's status." }

  return (
    <ContentContainer>
      <PalletForm pageMetaData={pageMetaData} pallet={pallet} />
    </ContentContainer>
  )
}
