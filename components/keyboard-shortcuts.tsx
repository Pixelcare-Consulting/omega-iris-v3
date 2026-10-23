'use client'

import { Button } from '@/components/ui/button'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Icons } from '@/components/icons'
import { TooltipWrapper } from '@/components/tooltip-wrapper'
import { SHORTCUTS } from '@/constants/shortcut'

export default function KeyboardShortcuts() {
  return (
    <Popover>
      <TooltipWrapper label='Keyboard shortcuts'>
        <PopoverTrigger asChild>
          <Button variant='ghost' size='icon-sm'>
            <Icons.help className='text-muted-foreground size-5' />
          </Button>
        </PopoverTrigger>
      </TooltipWrapper>

      <PopoverContent align='end' className='w-64 p-3'>
        <p className='mb-2.5 text-sm font-medium'>Keyboard shortcuts</p>

        <div className='flex flex-col gap-2'>
          {SHORTCUTS.map((shortcut) => (
            <div key={shortcut.label} className='flex items-center justify-between gap-3'>
              <span className='text-muted-foreground text-sm'>{shortcut.label}</span>

              <KbdGroup>
                {shortcut.keys.map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
              </KbdGroup>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
