import { notFound, redirect } from 'next/navigation'

import { getCurrentUserWithAbility, getUserByCode } from '@/actions/user'
import ContentContainer from '@/app/(protected)/_components/content-container'
import { UNAUTHORIZED_ROUTE } from '@/constants/common'
import ProfileContent from './_components/profile-content'

export default async function UserProfilePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const [user, currentUserWithAbility] = await Promise.all([getUserByCode(parseInt(code)), getCurrentUserWithAbility()])

  if (!user) return notFound()

  //! profile is self-only, so there is no ability to check - admin edits go through /users/[code]
  if (currentUserWithAbility?.userCode !== user.code) redirect(UNAUTHORIZED_ROUTE)

  return (
    <ContentContainer>
      <ProfileContent user={user} />
    </ContentContainer>
  )
}
