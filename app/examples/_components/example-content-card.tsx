'use client'

import { useState } from 'react'

import ContentCard from '@/components/content-card'
import { Icons } from '@/components/icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const RECENT_REQUESTS = [
  { code: 1042, requestor: 'Juan Dela Cruz', item: 'Bond Paper A4', qty: 20, status: 'Pending' },
  { code: 1041, requestor: 'Maria Santos', item: 'Ballpen (Black)', qty: 50, status: 'Approved' },
  { code: 1040, requestor: 'Pedro Reyes', item: 'Toner Cartridge', qty: 2, status: 'Released' }
]

export default function ExampleContentCard() {
  const [isLoading, setIsLoading] = useState(false)

  return (
    <div className='flex flex-col gap-10'>
      <div className='bg-muted/40 flex items-center gap-2 rounded-lg border p-4'>
        <Switch id='content-card-loading' checked={isLoading} onCheckedChange={setIsLoading} />
        <Label htmlFor='content-card-loading'>Toggle loading state of every card below</Label>
      </div>

      <section className='flex flex-col gap-3'>
        <div>
          <h2 className='text-xl font-semibold'>Basic</h2>
          <p className='text-muted-foreground text-sm'>
            Every part of the header is optional — with no `title`, `description`, `icon` or `action` the header is not rendered at all.
          </p>
        </div>

        <div className='grid gap-4 lg:grid-cols-2'>
          <ContentCard title='Item Summary' description='Consumables tracked by the supply office' isLoading={isLoading}>
            <p className='text-muted-foreground'>
              Anything can go in the body — text, a chart, a table, a form. The content area is `flex-1`, so cards in the same grid row keep
              an equal height.
            </p>
          </ContentCard>

          <ContentCard isLoading={isLoading}>
            <p className='text-muted-foreground'>Headerless card — just a padded, themed container for arbitrary content.</p>
          </ContentCard>
        </div>
      </section>

      <section className='flex flex-col gap-3'>
        <div>
          <h2 className='text-xl font-semibold'>With icon, action and header border</h2>
          <p className='text-muted-foreground text-sm'>
            `icon` takes a key from `Icons`, `action` fills the top-right slot, and `hasHeaderBorder` adds the divider used by dashboard
            panels.
          </p>
        </div>

        <ContentCard
          title='Recent Requests'
          description='Latest supply requests across all offices'
          icon='clipboadList'
          hasHeaderBorder
          isLoading={isLoading}
          loadingClassName='h-56'
          action={
            <div className='flex items-center gap-2'>
              <Select defaultValue='7'>
                <SelectTrigger size='sm' className='w-36'>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value='7'>Last 7 days</SelectItem>
                  <SelectItem value='30'>Last 30 days</SelectItem>
                  <SelectItem value='90'>Last 90 days</SelectItem>
                </SelectContent>
              </Select>

              <Button size='sm' variant='outline'>
                <Icons.download /> Export
              </Button>
            </div>
          }
          footer={
            <div className='flex w-full items-center justify-between'>
              <span className='text-muted-foreground text-xs'>Showing 3 of 128 requests</span>

              <Button size='sm' variant='ghost'>
                View all <Icons.arrowRight />
              </Button>
            </div>
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Requestor</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className='text-right'>Qty</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {RECENT_REQUESTS.map((request) => (
                <TableRow key={request.code}>
                  <TableCell className='tabular-nums'>{request.code}</TableCell>
                  <TableCell>{request.requestor}</TableCell>
                  <TableCell>{request.item}</TableCell>
                  <TableCell className='text-right tabular-nums'>{request.qty}</TableCell>
                  <TableCell>
                    <Badge variant={request.status === 'Pending' ? 'soft-slate' : 'pink'}>{request.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ContentCard>
      </section>

      <section className='flex flex-col gap-3'>
        <div>
          <h2 className='text-xl font-semibold'>Sizes</h2>
          <p className='text-muted-foreground text-sm'>`size=&apos;sm&apos;` tightens the card spacing and the title size.</p>
        </div>

        <div className='grid gap-4 lg:grid-cols-2'>
          <ContentCard
            title='Default size'
            description='Uses the default card spacing'
            icon='settings'
            isLoading={isLoading}
            loadingClassName='h-20'
          >
            <p className='text-muted-foreground'>Comfortable padding — the right choice for a full-width page panel.</p>
          </ContentCard>

          <ContentCard
            size='sm'
            title='Small size'
            description='Tighter spacing for dense layouts'
            icon='settings2'
            isLoading={isLoading}
            loadingClassName='h-20'
          >
            <p className='text-muted-foreground'>Use this inside sidebars, dialogs, or grids with many cards.</p>
          </ContentCard>
        </div>
      </section>

      <section className='flex flex-col gap-3'>
        <div>
          <h2 className='text-xl font-semibold'>Custom classes</h2>
          <p className='text-muted-foreground text-sm'>
            `className`, `headerClassName`, `contentClassName` and `footerClassName` target each slot; `loadingClassName` should match the
            real content height so the card does not jump when loading resolves.
          </p>
        </div>

        <ContentCard
          title='Stock Movement'
          description='Received vs released for the current month'
          icon='presentation'
          hasHeaderBorder
          isLoading={isLoading}
          loadingClassName='h-64'
          className='bg-primary/5'
          headerClassName='pb-4'
          contentClassName='pt-4'
          footerClassName='justify-end'
          footer={
            <Button size='sm' variant='outline'>
              <Icons.refresh /> Refresh
            </Button>
          }
        >
          <div className='bg-muted/50 text-muted-foreground flex h-64 items-center justify-center rounded-lg border border-dashed text-sm'>
            Chart goes here
          </div>
        </ContentCard>
      </section>
    </div>
  )
}
