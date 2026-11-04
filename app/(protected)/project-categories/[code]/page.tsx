import { notFound, redirect } from 'next/navigation'
import { UNAUTHORIZED_ROUTE } from '@/constants/common'

import { getCurrentUserWithAbility } from '@/actions/user'
import { getProjectCategoryByCode } from '@/actions/project-category'
import { getCurrentDbCode } from '@/lib/sap/access'
import { decodeCodeParam } from '@/lib/sap/utils'
import ContentContainer from '../../_components/content-container'
import ProjectCategoryForm from '../_components/project-category-form'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { authorizePage } from '@/lib/authorization'

export default async function ProjectCategoryPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const isAdd = code === 'add'

  const dbCode = await getCurrentDbCode()

  const [projectCategory, currentUserWithAbility] = await Promise.all([
    isAdd ? null : getProjectCategoryByCode(dbCode, decodeCodeParam(code).toUpperCase()), //* codes are stored uppercase
    getCurrentUserWithAbility()
  ])

  //* system rows are view only, whatever the ability says
  if (projectCategory?.isSystem) redirect(UNAUTHORIZED_ROUTE)

  //* check authorization for create, edit
  const requiredAction = isAdd ? PERMISSIONS_ALLOWED_ACTIONS.CREATE : PERMISSIONS_ALLOWED_ACTIONS.EDIT
  authorizePage(currentUserWithAbility?.ability, requiredAction, PERMISSIONS_CODES.PROJECT_CATEGORIES)

  if (!isAdd && !projectCategory) notFound()

  const pageMetaData = isAdd
    ? { title: 'Add Project Category', description: 'Fill in the form to create a new project category.' }
    : { title: 'Edit Project Category', description: "Edit the form to update this project category's information." }

  return (
    <ContentContainer>
      <ProjectCategoryForm pageMetaData={pageMetaData} projectCategory={projectCategory} />
    </ContentContainer>
  )
}
