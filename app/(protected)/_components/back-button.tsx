'use client'

import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { useRouter } from 'nextjs-toploader/app'

type BackButton = { className?: string; href?: string }

export default function BackButton({ className, href }: BackButton) {
  const router = useRouter()

  function handleClick(href?: string) {
    if (href) {
      router.push(href)
      return
    }

    router.back()
  }

  return (
    <Button className={className} onClick={() => handleClick(href)}>
      <Icons.arrowLeft /> Go Back
    </Button>
  )
}
