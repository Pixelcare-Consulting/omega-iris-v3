import { useState } from 'react'

import { logger } from '@/lib/logger'
import { BatchError, BatchStats, BatchStatus, BatchStepResult } from '@/types/batch'

export const INITIAL_BATCH_STATS: BatchStats = { total: 0, processed: 0, succeeded: 0, progress: 0, errors: [] }

type RunOptions = {
  total: number
  steps: number
  stepSize: (index: number) => number
  runStep: (index: number) => Promise<BatchStepResult> //* throw to fail the whole step
  failStep: (index: number, message: string) => BatchError[]
}

//* runs steps one after another and merges their results, a step that throws counts all its records as failed
export function useBatchRun() {
  const [stats, setStats] = useState<BatchStats>(INITIAL_BATCH_STATS)
  const [status, setStatus] = useState<BatchStatus>('idle')

  const reset = () => {
    setStats(INITIAL_BATCH_STATS)
    setStatus('idle')
  }

  const run = async ({ total, steps, stepSize, runStep, failStep }: RunOptions) => {
    let current: BatchStats = { ...INITIAL_BATCH_STATS, total, progress: total === 0 ? 100 : 0 }

    setStatus('processing')
    setStats(current)

    for (let index = 0; index < steps; index++) {
      let result: BatchStepResult

      try {
        result = await runStep(index)
      } catch (err: any) {
        logger.error(err, '[BATCH_RUN_STEP_ERROR]:')
        result = { succeeded: 0, errors: failStep(index, err instanceof Error ? err.message : 'Unexpected error') }
      }

      const processed = Math.min(total, current.processed + stepSize(index))

      current = {
        ...current,
        processed,
        succeeded: current.succeeded + result.succeeded,
        progress: total === 0 ? 100 : Math.round((processed / total) * 100),
        errors: [...current.errors, ...result.errors]
      }

      setStats(current)
    }

    setStatus('completed')

    return current
  }

  return { stats, status, run, reset }
}
