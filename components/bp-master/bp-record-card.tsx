'use client'

import { Row } from '@/components/row'
import { Column } from '@/components/column'
import ReadOnlyField from '@/components/read-only-field'
import { Badge } from '@/components/ui/badge'

type BpRecordCardProps = { code: string; name: string; isDefault: boolean; fields: [string, string | null][] }

//* one address or contact on the view page, empty fields are left out
export default function BpRecordCard({ code, name, isDefault, fields }: BpRecordCardProps) {
  return (
    <div className='flex flex-col gap-4 rounded-lg border p-4'>
      <div className='flex items-center gap-2'>
        <h3 className='text-base font-semibold'>{name}</h3>
        <Badge variant='outline'>{code}</Badge>
        {isDefault && <Badge variant='soft-blue'>Default</Badge>}
      </div>

      <Row gap={4}>
        {fields
          .filter(([, value]) => value)
          .map(([title, value]) => (
            <Column key={title} md={6} lg={3}>
              <ReadOnlyField title={title} value={value} />
            </Column>
          ))}
      </Row>
    </div>
  )
}
