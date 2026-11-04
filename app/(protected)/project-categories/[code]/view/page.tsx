import { notFound } from 'next/navigation'

import { getCurrentUserWithAbility } from '@/actions/user'
import { getProjectCategoryByCode } from '@/actions/project-category'
import { getCurrentDbCode } from '@/lib/sap/access'
import { decodeCodeParam } from '@/lib/sap/utils'
import ContentContainer from '@/app/(protected)/_components/content-container'
import ViewProjectCategory from './_components/view-project-category'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { authorizePage } from '@/lib/authorization'

export default async function ProjectCategoryViewPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const dbCode = await getCurrentDbCode()

  const [projectCategory, currentUserWithAbility] = await Promise.all([
    getProjectCategoryByCode(dbCode, decodeCodeParam(code).toUpperCase()),
    getCurrentUserWithAbility()
  ])

  //* check authorization for view
  authorizePage(currentUserWithAbility?.ability, PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.PROJECT_CATEGORIES)

  if (!projectCategory) notFound()

  return (
    <ContentContainer>
      <ViewProjectCategory projectCategory={projectCategory} />
    </ContentContainer>
  )
}
