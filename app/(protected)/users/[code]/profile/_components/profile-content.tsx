import Header from '@/components/header'
import { getUserByCode } from '@/actions/user'
import { ScrollArea } from '@/components/ui/scroll-area'
import ProfileBasicInfoForm from './profile-basic-info-form'
import ProfileChangePasswordForm from './profile-change-password-form'

type ProfileContentProps = { user: NonNullable<Awaited<ReturnType<typeof getUserByCode>>> }

export default function ProfileContent({ user }: ProfileContentProps) {
  return (
    <div className='flex h-full w-full flex-1 flex-col gap-5'>
      <Header title={`${user.name}'s Profile`} description='View and edit your profile information' />

      <ScrollArea className='min-h-0 flex-1' type='auto'>
        {/* //* a system user's basic info can't be edited */}
        {!user.isSystem && <ProfileBasicInfoForm user={user} />}
        <ProfileChangePasswordForm user={user} />
      </ScrollArea>
    </div>
  )
}
