'use client'

import { toast } from 'sonner'

import { useSapDatabase } from '@/hooks/use-sap-database'
import { useSapDatabases } from '@/hooks/safe-actions/sap-database'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Icons } from './icons'
import SapDatabaseSwitchingOverlay from './sap-database-switching-overlay'

export default function SapDatabaseSwitcher({ dbCode }: { dbCode: string | null }) {
  const { stage, targetDbCode, retryAttempt, isSwitching, switchDatabase } = useSapDatabase()
  const { data: sapDatabases, isLoading } = useSapDatabases()

  const current = sapDatabases.find((sapDb) => sapDb.dbCode === dbCode)
  const target = sapDatabases.find((sapDb) => sapDb.dbCode === targetDbCode)

  const handleSelect = async (nextDbCode: string) => {
    if (!nextDbCode || nextDbCode === dbCode) return

    //* switchDatabase navigates on success
    const { isSwitched, message } = await switchDatabase(nextDbCode)

    if (!isSwitched) toast.error(message)
  }

  if (!dbCode) return null

  return (
    <>
      <SapDatabaseSwitchingOverlay stage={stage} databaseName={target?.name ?? targetDbCode} retryAttempt={retryAttempt} />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' size='sm' disabled={isSwitching || isLoading}>
            <Icons.database className='text-muted-foreground size-4' />
            <span className='max-w-40 truncate text-sm font-medium'>{current?.name ?? dbCode}</span>
            <Icons.upDown className='text-muted-foreground size-3.5' />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align='end' className='min-w-56'>
          <DropdownMenuLabel className='text-muted-foreground text-xs font-semibold tracking-wide uppercase'>Company</DropdownMenuLabel>

          <DropdownMenuRadioGroup value={dbCode} onValueChange={handleSelect}>
            {sapDatabases.map((sapDb) => (
              <DropdownMenuRadioItem key={sapDb.dbCode} value={sapDb.dbCode}>
                {sapDb.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
