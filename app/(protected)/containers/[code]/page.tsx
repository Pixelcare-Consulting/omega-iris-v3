import { notFound } from 'next/navigation'

import { getCurrentUserWithAbility } from '@/actions/user'
import { getContainerByCode } from '@/actions/container'
import { getCurrentDbCode } from '@/lib/sap/access'
import { decodeCodeParam } from '@/lib/sap/utils'
import ContentContainer from '../../_components/content-container'
import ContainerForm from '../_components/container-form'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { authorizePage } from '@/lib/authorization'

export default async function ContainerPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const isAdd = code === 'add'

  const dbCode = await getCurrentDbCode()

  const [container, currentUserWithAbility] = await Promise.all([
    isAdd ? null : getContainerByCode(dbCode, decodeCodeParam(code).toUpperCase()), //* codes are stored uppercase
    getCurrentUserWithAbility()
  ])

  //* check authorization for create, edit
  const requiredAction = isAdd ? PERMISSIONS_ALLOWED_ACTIONS.CREATE : PERMISSIONS_ALLOWED_ACTIONS.EDIT
  authorizePage(currentUserWithAbility?.ability, requiredAction, PERMISSIONS_CODES.CONTAINERS)

  if (!isAdd && !container) notFound()

  const pageMetaData = isAdd
    ? { title: 'Add Container', description: 'Fill in the form to create a new container.' }
    : { title: 'Edit Container', description: "Edit the container's status." }

  return (
    <ContentContainer>
      <ContainerForm pageMetaData={pageMetaData} container={container} />
    </ContentContainer>
  )
}
