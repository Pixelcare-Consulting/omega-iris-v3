import { notFound, redirect } from 'next/navigation'
import { UNAUTHORIZED_ROUTE } from '@/constants/common'

import { getCurrentUserWithAbility } from '@/actions/user'
import { getProcessZoneByCode } from '@/actions/process-zone'
import { getCurrentDbCode } from '@/lib/sap/access'
import { decodeCodeParam } from '@/lib/sap/utils'
import ContentContainer from '../../_components/content-container'
import ProcessZoneForm from '../_components/process-zone-form'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { authorizePage } from '@/lib/authorization'

export default async function ProcessZonePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const isAdd = code === 'add'

  const [processZone, currentUserWithAbility] = await Promise.all([
    isAdd ? null : getCurrentDbCode().then((dbCode) => getProcessZoneByCode(dbCode, decodeCodeParam(code).toUpperCase())), //* codes are stored uppercase
    getCurrentUserWithAbility()
  ])

  //* system rows are view only, whatever the ability says
  if (processZone?.isSystem) redirect(UNAUTHORIZED_ROUTE)

  //* check authorization for create, edit
  const requiredAction = isAdd ? PERMISSIONS_ALLOWED_ACTIONS.CREATE : PERMISSIONS_ALLOWED_ACTIONS.EDIT
  authorizePage(currentUserWithAbility?.ability, requiredAction, PERMISSIONS_CODES.PROCESS_ZONES)

  if (!isAdd && !processZone) notFound()

  const pageMetaData = isAdd
    ? { title: 'Add Process Zone', description: 'Fill in the form to create a new process zone.' }
    : { title: 'Edit Process Zone', description: "Edit the form to update this process zone's information." }

  return (
    <ContentContainer>
      <ProcessZoneForm pageMetaData={pageMetaData} processZone={processZone} />
    </ContentContainer>
  )
}
