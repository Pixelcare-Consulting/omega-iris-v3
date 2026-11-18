import BatchErrorTable from '@/components/batch-error-table'
import { formatDate } from '@/lib/utils'
import { BatchStats } from '@/types/batch'

type BatchResultProps = {
  stats: BatchStats
  entityName: string
  verb: string //* e.g. 'synced', 'imported'
  labelTitle: string
  finishedAt?: string | null //* set when showing a saved result
  actions?: React.ReactNode
}

export default function BatchResult({ stats, entityName, verb, labelTitle, finishedAt, actions }: BatchResultProps) {
  const errorCount = stats.errors.length

  return (
    <>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='flex flex-col gap-0.5'>
          <p className='text-sm font-medium'>
            {stats.succeeded} of {stats.total} {entityName} {verb}, {errorCount} with errors
          </p>

          {finishedAt && (
            <p className='text-muted-foreground text-xs'>Last run: {formatDate(new Date(finishedAt), 'MMM dd, yyyy hh:mm a')}</p>
          )}
        </div>

        {actions && <div className='flex gap-2'>{actions}</div>}
      </div>

      {errorCount > 0 && <BatchErrorTable errors={stats.errors} labelTitle={labelTitle} />}
    </>
  )
}
