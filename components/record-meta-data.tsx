'use client'

import ReadOnlyField from '@/components/read-only-field'
import { useUserByCode } from '@/hooks/safe-actions/user'

import { format, isValid } from 'date-fns'
import { Column } from './column'

type RecordMetaDataProps = {
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date | null
  createdBy?: number | null
  updatedBy?: number | null
  deletedBy?: number | null
}

export default function RecordMetaData({ createdAt, updatedAt, deletedAt, createdBy, updatedBy, deletedBy }: RecordMetaDataProps) {
  const createdByValue = useUserByCode(createdBy)
  const updatedByValue = useUserByCode(updatedBy)
  const deletedByValue = useUserByCode(deletedBy)

  const renderValue = ({ data, isLoading }: ReturnType<typeof useUserByCode>) => {
    if (isLoading) return ''
    return data?.name ?? ''
  }

  return (
    <>
      <Column md={6} lg={4}>
        <ReadOnlyField title='Create At' value={format(createdAt, 'MM-dd-yyyy hh:mm a')} />
      </Column>

      <Column md={6} lg={4}>
        <ReadOnlyField title='Created By' value={renderValue(createdByValue)} isLoading={createdByValue.isLoading} />
      </Column>

      <Column md={6} lg={4}>
        <ReadOnlyField title='Updated At' value={format(updatedAt, 'MM-dd-yyyy hh:mm a')} />
      </Column>

      <Column md={6} lg={4}>
        <ReadOnlyField title='Updated By' value={renderValue(updatedByValue)} isLoading={updatedByValue.isLoading} />
      </Column>

      <Column md={6} lg={4}>
        <ReadOnlyField title='Deleted At' value={deletedAt && isValid(deletedAt) ? format(deletedAt, 'MM-dd-yyyy hh:mm a') : ''} />
      </Column>

      <Column md={6} lg={4}>
        <ReadOnlyField title='Deleted By' value={renderValue(deletedByValue)} isLoading={deletedByValue.isLoading} />
      </Column>
    </>
  )
}
