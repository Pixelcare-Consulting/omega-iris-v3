//* shared by sap sync and import, a batch runs in steps and collects errors per record

export type BatchErrorEntry = { field: string; message: string }

//* label is what the user reads, e.g. 'Row 5' or an item code
export type BatchError = { key: string; label: string; entries: BatchErrorEntry[] }

export type BatchStepResult = { succeeded: number; errors: BatchError[] }

export type BatchStats = { total: number; processed: number; succeeded: number; progress: number; errors: BatchError[] }

export type BatchStatus = 'idle' | 'processing' | 'completed'

export type LastBatchResult = { finishedAt: string; stats: BatchStats }
