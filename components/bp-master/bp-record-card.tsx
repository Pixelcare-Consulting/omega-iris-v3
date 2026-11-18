'use client'

import { Row } from '@/components/row'
import { Column } from '@/components/column'
import ReadOnlyField from '@/components/read-only-field'
import { Badge } from '@/components/ui/badge'
import SapSyncStatusBadge from '@/components/sap-sync-status-badge'
import type { SapSyncStatus } from '@/prisma/generated/enums'

type BpRecordCardProps = { name: string; isDefault: boolean; syncStatus: SapSyncStatus; fields: [string, string | null][] }

//* one address or contact on the view page
export default function BpRecordCard({ name, isDefault, syncStatus, fields }: BpRecordCardProps) {
  return (
    <div className='flex flex-col gap-4 rounded-lg border p-4'>
      <div className='flex items-center gap-2'>
        <h3 className='text-base font-semibold'>{name}</h3>
        <SapSyncStatusBadge status={syncStatus} />
        {isDefault && <Badge variant='soft-blue'>Default</Badge>}
      </div>

      <Row gap={4}>
        {fields.map(([title, value]) => (
          <Column key={title} md={6} lg={3}>
            <ReadOnlyField title={title} value={value} />
          </Column>
        ))}
      </Row>
    </div>
  )
}
