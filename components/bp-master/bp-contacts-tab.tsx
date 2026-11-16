'use client'

import { BpMasterRow } from '@/actions/bp-master'
import ContentWrapper from '@/components/content-wrapper'
import ReadOnlyFieldHeader from '@/components/read-only-field-header'
import { ScrollArea } from '@/components/ui/scroll-area'
import EmptyState from '@/components/empty-state'
import { Icons } from '@/components/icons'
import { isSameName } from '@/schema/bp-master'
import BpRecordCard from './bp-record-card'

type BpContactsTabProps = { bpMaster: BpMasterRow }

type Contact = BpMasterRow['contacts'][number]

const toContactFields = (c: Contact): [string, string | null][] => [
  ['First Name', c.FirstName],
  ['Last Name', c.LastName],
  ['Email', c.Email],
  ['Title', c.Title],
  ['Position', c.Position],
  ['Tel 1', c.Phone1],
  ['Tel 2', c.Phone2],
  ['Mobile Phone', c.MobilePhone]
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
              <BpRecordCard
                key={c.id}
                name={c.ContactName}
                isDefault={isSameName(c.ContactName, bpMaster.CntctPrsn)}
                syncStatus={c.syncStatus}
                fields={toContactFields(c)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </ContentWrapper>
  )
}
