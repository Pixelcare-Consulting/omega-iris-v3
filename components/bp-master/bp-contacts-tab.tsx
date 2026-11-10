'use client'

import { BpMasterWithRelations } from '@/actions/bp-master'
import ContentWrapper from '@/components/content-wrapper'
import ReadOnlyFieldHeader from '@/components/read-only-field-header'
import { ScrollArea } from '@/components/ui/scroll-area'
import EmptyState from '@/components/empty-state'
import { Icons } from '@/components/icons'
import BpRecordCard from './bp-record-card'

type BpContactsTabProps = { bpMaster: BpMasterWithRelations }

type Contact = BpMasterWithRelations['contacts'][number]

const toContactFields = (c: Contact): [string, string | null][] => [
  ['Email', c.email],
  ['Title', c.title],
  ['Position', c.position],
  ['Tel 1', c.tel1],
  ['Tel 2', c.tel2],
  ['Mobile Phone', c.phone]
]

export default function BpContactsTab({ bpMaster }: BpContactsTabProps) {
  return (
    <ContentWrapper className='h-full'>
      <ScrollArea className='min-h-0 flex-1 p-4' type='auto'>
        <div className='flex flex-col gap-4'>
          <ReadOnlyFieldHeader title='Contacts' description='Contact person details' />

          {bpMaster.contacts.length === 0 ? (
            <EmptyState
              title='No contacts'
              description='This record has no contact person yet.'
              icon={<Icons.contact />}
              className='min-h-40'
            />
          ) : (
            bpMaster.contacts.map((c) => (
              <BpRecordCard key={c.id} code={c.code} name={c.name} isDefault={c.isDefault} fields={toContactFields(c)} />
            ))
          )}
        </div>
      </ScrollArea>
    </ContentWrapper>
  )
}
