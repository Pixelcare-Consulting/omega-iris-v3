export type FormDebugProps = {
  form: any
  keys?: string[] | undefined
}

export function FormDebug({ form, keys = undefined }: FormDebugProps) {
  if (process.env.NODE_ENV === 'production') return null

  return (
    <div className='my-8 flex justify-between gap-3 text-xs'>
      <div className='min-h-50 w-[50%] overflow-auto'>
        <h6 className='mb-3 font-semibold'>Form Data</h6>
        <pre>{JSON.stringify(form.watch(keys), null, 2)}</pre>
      </div>

      <div className='min-h-50 w-[50%] overflow-auto'>
        <h6 className='mb-3 font-semibold'>Form Errors</h6>
        <pre>{JSON.stringify(form.formState.errors, null, 2)}</pre>
      </div>
    </div>
  )
}
