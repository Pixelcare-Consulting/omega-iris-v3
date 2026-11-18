'use client'

import { useEffect, useMemo } from 'react'
import { ColumnDef } from '@tanstack/react-table'

import { ContainerPreviewLine } from '@/lib/container'
import { DataTable } from '@/components/data-table/data-table'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import DataTableContainer from '@/components/data-table/data-table-container'
import DataTableGlobalSearch from '@/components/data-table/data-table-global-search'
import { DataTableTextCell } from '@/components/data-table/data-table-column-cell'
import { useDataTableClient } from '@/hooks/use-data-table-client'
import { Badge } from '@/components/ui/badge'
import { Icons } from '@/components/icons'
import { CONTAINER_TYPE_LABELS } from '@/constants/container'

type PreviewRow = {
  id: string
  code: string
  line: number
  type: string | null
  palletCode: string | null
  isGeneralPurpose: boolean
  projectCategoryCode: string | null
  customerProjectCode: string | null
}

type ContainerGeneratePreviewProps = { lines: ContainerPreviewLine[]; isLoading: boolean }

export default function ContainerGeneratePreview({ lines, isLoading }: ContainerGeneratePreviewProps) {
  const data = useMemo<PreviewRow[]>(
    () =>
      lines.flatMap((line) =>
        line.codes.map((code) => ({
          id: code,
          code,
          line: line.lineNumber,
          type: line.type ? CONTAINER_TYPE_LABELS[line.type] : null,
          palletCode: line.palletCode || null,
          isGeneralPurpose: line.isGeneralPurpose,
          projectCategoryCode: line.isGeneralPurpose ? null : (line.projectCategoryCode ?? null),
          customerProjectCode: line.isGeneralPurpose ? null : (line.customerProjectCode ?? null)
        }))
      ),
    [lines]
  )

  const columns = useMemo<ColumnDef<PreviewRow>[]>(
    () => [
      {
        accessorKey: 'line',
        header: ({ column }) => <DataTableColumnHeader column={column} title='Line' />,
        cell: ({ row: { original } }) => <DataTableTextCell value={String(original.line)} />
      },
      {
        accessorKey: 'code',
        header: ({ column }) => <DataTableColumnHeader column={column} title='Code' />,
        cell: ({ row: { original } }) => <DataTableTextCell value={original.code} />
      },
      {
        accessorKey: 'type',
        header: ({ column }) => <DataTableColumnHeader column={column} title='Type' />,
        cell: ({ row: { original } }) => <DataTableTextCell value={original.type} />
      },
      {
        accessorKey: 'palletCode',
        header: ({ column }) => <DataTableColumnHeader column={column} title='Pallet' />,
        cell: ({ row: { original } }) => <DataTableTextCell value={original.palletCode} />
      },
      {
        id: 'isGeneralPurpose',
        accessorFn: (row) => (row.isGeneralPurpose ? 'Yes' : 'No'),
        header: ({ column }) => <DataTableColumnHeader column={column} title='General Purpose' />,
        cell: ({ row: { original } }) => <DataTableTextCell value={original.isGeneralPurpose ? 'Yes' : 'No'} />
      },
      {
        accessorKey: 'projectCategoryCode',
        header: ({ column }) => <DataTableColumnHeader column={column} title='Category' />,
        cell: ({ row: { original } }) => <DataTableTextCell value={original.projectCategoryCode} />
      },
      {
        accessorKey: 'customerProjectCode',
        header: ({ column }) => <DataTableColumnHeader column={column} title='Project' />,
        cell: ({ row: { original } }) => <DataTableTextCell value={original.customerProjectCode} />
      }
    ],
    []
  )

  const { table } = useDataTableClient({
    data,
    columns,
    getRowId: (row) => row.id,
    autoResetPageIndex: false,
    initialState: { sorting: [{ id: 'line', desc: false }] }
  })

  //* a changed run starts at page one
  const runKey = useMemo(() => data.map((row) => row.code).join('|'), [data])

  //* back to page one when the run changes
  useEffect(() => {
    table.setPageIndex(0)
  }, [runKey, table])

  return (
    <div className='flex flex-col gap-3'>
      <div className='text-muted-foreground flex flex-wrap items-center gap-2 text-sm'>
        <Badge variant='soft-neutral'>Estimated</Badge>
        <span>These numbers can change if someone else saves first, the final codes show after you generate</span>

        {isLoading && (
          <span className='ml-auto flex items-center gap-1'>
            <Icons.spinner className='size-4 animate-spin' /> Loading next numbers...
          </span>
        )}
      </div>

      <DataTableContainer className='h-120 flex-none'>
        <DataTableGlobalSearch table={table} />
        <DataTable table={table} />
      </DataTableContainer>
    </div>
  )
}
