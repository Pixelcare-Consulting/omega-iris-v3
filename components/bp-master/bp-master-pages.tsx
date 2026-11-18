import { notFound } from 'next/navigation'

import { getCurrentUserWithAbility } from '@/actions/user'
import { getBpMasterByCode } from '@/actions/bp-master'
import { getCurrentDbCode } from '@/lib/sap/access'
import { authorizePage } from '@/lib/authorization'
import ContentContainer from '@/app/(protected)/_components/content-container'
import { PERMISSIONS_ALLOWED_ACTIONS } from '@/constants/permission'
import { BP_MASTER_CONFIG, BpMasterType } from '@/constants/bp-master'
import BpMasterContent from './bp-master-content'
import BpMasterForm from './bp-master-form'
import ViewBpMaster from './view-bp-master'

type BpMasterPageProps = { type: BpMasterType; params: Promise<{ code: string }> }

//* the route param of an encoded code, a bad escape falls back to the raw value
function toCardCode(code: string) {
  try {
    return decodeURIComponent(code)
  } catch {
    return code
  }
}

//* customers and vendors render these with a fixed type

export async function BpMasterListPage({ type }: { type: BpMasterType }) {
  const currentUserWithAbility = await getCurrentUserWithAbility()

  //* check authorization for view
  authorizePage(currentUserWithAbility?.ability, PERMISSIONS_ALLOWED_ACTIONS.VIEW, BP_MASTER_CONFIG[type].permission)

  return (
    <ContentContainer>
      <BpMasterContent type={type} userCode={currentUserWithAbility?.userCode ?? null} />
    </ContentContainer>
  )
}

export async function BpMasterFormPage({ type, params }: BpMasterPageProps) {
  const { code } = await params
  const { label, permission, canCreate } = BP_MASTER_CONFIG[type]

  //* vendors only come from sap for now
  if (!canCreate) notFound()

  const isAdd = code === 'add'
  const cardCode = toCardCode(code)

  const dbCode = await getCurrentDbCode()

  const [bpMaster, currentUserWithAbility] = await Promise.all([
    isAdd ? null : getBpMasterByCode(dbCode, type, cardCode),
    getCurrentUserWithAbility()
  ])

  //* check authorization for create, edit
  const requiredAction = isAdd ? PERMISSIONS_ALLOWED_ACTIONS.CREATE : PERMISSIONS_ALLOWED_ACTIONS.EDIT
  authorizePage(currentUserWithAbility?.ability, requiredAction, permission)

  if (!isAdd && !bpMaster) notFound()

  const pageMetaData = isAdd
    ? { title: `Add ${label}`, description: `Fill in the form to create a new ${label.toLowerCase()}.` }
    : { title: `Edit ${label}`, description: `Edit the form to update this ${label.toLowerCase()}'s information.` }

  return (
    <ContentContainer>
      <BpMasterForm type={type} pageMetaData={pageMetaData} bpMaster={bpMaster} />
    </ContentContainer>
  )
}

export async function BpMasterViewPage({ type, params }: BpMasterPageProps) {
  const { code } = await params

  const dbCode = await getCurrentDbCode()

  const [bpMaster, currentUserWithAbility] = await Promise.all([
    getBpMasterByCode(dbCode, type, toCardCode(code)),
    getCurrentUserWithAbility()
  ])

  //* check authorization for view
  authorizePage(currentUserWithAbility?.ability, PERMISSIONS_ALLOWED_ACTIONS.VIEW, BP_MASTER_CONFIG[type].permission)

  if (!bpMaster) notFound()

  return (
    <ContentContainer>
      <ViewBpMaster type={type} bpMaster={bpMaster} />
    </ContentContainer>
  )
}
