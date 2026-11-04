import { notFound, redirect } from 'next/navigation'
import { UNAUTHORIZED_ROUTE } from '@/constants/common'

import { getCurrentUserWithAbility } from '@/actions/user'
import { getManufacturerByCode } from '@/actions/manufacturer'
import { getCurrentDbCode } from '@/lib/sap/access'
import { decodeCodeParam } from '@/lib/sap/utils'
import ContentContainer from '../../_components/content-container'
import ManufacturerForm from '../_components/manufacturer-form'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { authorizePage } from '@/lib/authorization'

export default async function ManufacturerPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const isAdd = code === 'add'

  const dbCode = await getCurrentDbCode()

  const [manufacturer, currentUserWithAbility] = await Promise.all([
    isAdd ? null : getManufacturerByCode(dbCode, decodeCodeParam(code).toUpperCase()), //* codes are stored uppercase
    getCurrentUserWithAbility()
  ])

  //* system rows are view only, whatever the ability says
  if (manufacturer?.isSystem) redirect(UNAUTHORIZED_ROUTE)

  //* check authorization for create, edit
  const requiredAction = isAdd ? PERMISSIONS_ALLOWED_ACTIONS.CREATE : PERMISSIONS_ALLOWED_ACTIONS.EDIT
  authorizePage(currentUserWithAbility?.ability, requiredAction, PERMISSIONS_CODES.MANUFACTURERS)

  if (!isAdd && !manufacturer) notFound()

  const pageMetaData = isAdd
    ? { title: 'Add Manufacturer', description: 'Fill in the form to create a new manufacturer.' }
    : { title: 'Edit Manufacturer', description: "Edit the form to update this manufacturer's information." }

  return (
    <ContentContainer>
      <ManufacturerForm pageMetaData={pageMetaData} manufacturer={manufacturer} />
    </ContentContainer>
  )
}
