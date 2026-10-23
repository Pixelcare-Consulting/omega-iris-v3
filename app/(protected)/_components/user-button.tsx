'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Icons } from '@/components/icons'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { cn, getInitials, titleCase } from '@/lib/utils'
import { getAvatarColorClassName, toBadgeVariant } from '@/lib/color'
import { authClient } from '@/lib/auth-client'
import { logger } from '@/lib/logger'
import { Badge } from '@/components/ui/badge'
import { AuthSessionUser } from '@/types/auth'

export default function UserButton({ user }: { user: AuthSessionUser | null }) {
  const router = useRouter()

  if (!user) return null

  const handleSignOut = async () => {
    try {
      //! better-auth returns its error instead of throwing it
      const { error } = await authClient.signOut({
        fetchOptions: { onSuccess: () => window.location.replace('/signin') }
      })

      if (error) toast.error(error.message ?? 'Failed to sign out.')
    } catch (err) {
      logger.error(err, '[SIGN_OUT_ERROR]:')
      toast.error('Failed to sign out.')
    }
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Avatar className='size-9 cursor-pointer'>
          <AvatarImage className='object-cover object-center' src={user.image ?? ''} />
          <AvatarFallback className={cn('bg-primary text-white', getAvatarColorClassName(user.roleColor))}>
            {getInitials(user.name ?? '').toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent className='min-w-40' align='end' sideOffset={10}>
        <div className='flex flex-col items-center justify-center gap-y-2 px-2 py-1.5'>
          <Avatar className='size-11'>
            <AvatarImage className='object-cover object-center' src={user.image ?? ''} />
            <AvatarFallback className={cn('bg-primary text-white', getAvatarColorClassName(user.roleColor))}>
              {getInitials(user.name).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className='flex flex-col items-center gap-1.5'>
            <h1 className='text-center text-sm font-semibold'>{titleCase(user.name)}</h1>
            <p className='text-muted-foreground text-center text-xs'>{user.email}</p>
            <Badge variant={toBadgeVariant(user.roleColor, 'default')}>{user.roleName}</Badge>
          </div>
        </div>

        <DropdownMenuSeparator />

        {!user.isSystem && (
          <DropdownMenuItem className='cursor-pointer' onClick={() => router.push(`/users/${user.code}/profile`)}>
            <Icons.profile className='mr-2 size-4' />
            <span>Profile</span>
          </DropdownMenuItem>
        )}

        <DropdownMenuItem className='cursor-pointer' onClick={() => handleSignOut()}>
          <Icons.signout className='mr-2 size-4' />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
