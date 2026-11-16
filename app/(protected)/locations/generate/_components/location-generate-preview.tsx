'use client'

import { useEffect, useMemo, useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'

import { GeneratedLocation } from '@/lib/location'
import { DataTable } from '@/components/data-table/data-table'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import DataTableContainer from '@/components/data-table/data-table-container'
import DataTableGlobalSearch from '@/components/data-table/data-table-global-search'
import { DataTableTextCell } from '@/components/data-table/data-table-column-cell'
import { useDataTableClient } from '@/hooks/use-data-table-client'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LOCATION_TYPE_LABELS } from '@/constants/location'
import { Icons } from '@/components/icons'

export type PreviewStatus = 'CREATE' | 'EXISTS' | 'DELETED' | 'REPEATED' | 'UNTICKED'

type PreviewRow = GeneratedLocation & { id: string; status: PreviewStatus }

type PreviewFilter = 'ALL' | 'CREATE' | 'SKIPPED'

const STATUS_BADGES: Partial<Record<PreviewStatus, { label: string; variant: 'soft-amber' | 'soft-red' | 'soft-slate' | 'soft-neutral' }>> =
  {
    EXISTS: { label: 'Exists', variant: 'soft-amber' },
    DELETED: { label: 'Deleted', variant: 'soft-red' },
    REPEATED: { label: 'Repeated', variant: 'soft-slate' },
    UNTICKED: { label: 'Unticked', variant: 'soft-neutral' }
  }

//* a row is skipped for one reason, checked in this order
export function getPreviewStatus(row: GeneratedLocation, existing: Map<string, Date | null>, excluded: Set<string>): PreviewStatus {
  if (row.isRepeated) return 'REPEATED'
  if (existing.has(row.code)) return existing.get(row.code) ? 'DELETED' : 'EXISTS'
  if (excluded.has(row.code)) return 'UNTICKED'
  return 'CREATE'
}

type LocationGeneratePreviewProps = {
  rows: GeneratedLocation[]
  existing: Map<string, Date | null>
  excludedCodes: string[]
  isChecking: boolean
  onExcludedChange: (codes: string[]) => void
}

export default function LocationGeneratePreview({
  rows,
  existing,
  excludedCodes,
  isChecking,
  onExcludedChange
}: LocationGeneratePreviewProps) {
  const [filter, setFilter] = useState<PreviewFilter>('ALL')

  const excluded = useMemo(() => new Set(excludedCodes), [excludedCodes])

  const previewRows = useMemo<PreviewRow[]>(
    () =>
      rows.map((row, index) => ({
        ...row,
        id: `${row.lineIndex}-${index}-${row.code}`,
        status: getPreviewStatus(row, existing, excluded)
      })),
    [rows, existing, excluded]
  )

  const counts = useMemo(() => {
    const toCreate = previewRows.filter((row) => row.status === 'CREATE').length
    return { total: previewRows.length, toCreate, skipped: previewRows.length - toCreate }
  }, [previewRows])

  const data = useMemo(() => {
    if (filter === 'CREATE') return previewRows.filter((row) => row.status === 'CREATE')
    if (filter === 'SKIPPED') return previewRows.filter((row) => row.status !== 'CREATE')
    return previewRows
  }, [previewRows, filter])

  const toggleCode = (code: string, isTicked: boolean) => {
    onExcludedChange(isTicked ? excludedCodes.filter((value) => value !== code) : [...excludedCodes, code])
  }

  const columns = useMemo<ColumnDef<PreviewRow>[]>(
    () => [
      {
        id: 'select',
        enableSorting: false,
        enableHiding: false,
        minSize: 44,
        maxSize: 44,
        header: () => null,
        cell: ({ row: { original } }) => {
          const isLocked = original.status !== 'CREATE' && original.status !== 'UNTICKED'

          return (
            <div className='flex justify-center'>
              <Checkbox
                checked={original.status === 'CREATE'}
                disabled={isLocked}
                aria-label={`Create ${original.code}`}
                onCheckedChange={(checked) => toggleCode(original.code, !!checked)}
              />
            </div>
          )
        }
      },
      {
        accessorKey: 'code',
        header: ({ column }) => <DataTableColumnHeader column={column} title='Code' />,
        cell: ({ row: { original } }) => <DataTableTextCell value={original.code} />
      },
      {
        accessorKey: 'type',
        header: ({ column }) => <DataTableColumnHeader column={column} title='Type' />,
        cell: ({ row: { original } }) => <DataTableTextCell value={original.type ? LOCATION_TYPE_LABELS[original.type] : null} />
      },
      {
        accessorKey: 'processZoneCode',
        header: ({ column }) => <DataTableColumnHeader column={column} title='Process Zone' />,
        cell: ({ row: { original } }) => <DataTableTextCell value={original.processZoneCode} />
      },
      {
        accessorKey: 'bayCode',
        header: ({ column }) => <DataTableColumnHeader column={column} title='Bay' />,
        cell: ({ row: { original } }) => <DataTableTextCell value={original.bayCode} />
      },
      {
        accessorKey: 'levelCode',
        header: ({ column }) => <DataTableColumnHeader column={column} title='Level' />,
        cell: ({ row: { original } }) => <DataTableTextCell value={original.levelCode} />
      },
      {
        accessorKey: 'rackCode',
        header: ({ column }) => <DataTableColumnHeader column={column} title='Rack' />,
        cell: ({ row: { original } }) => <DataTableTextCell value={original.rackCode} />
      },
      {
        accessorKey: 'isPalletAllowed',
        header: ({ column }) => <DataTableColumnHeader column={column} title='Pallet Allowed' />,
        cell: ({ row: { original } }) => <DataTableTextCell value={original.isPalletAllowed ? 'Yes' : 'No'} />
      },
      {
        accessorKey: 'status',
        enableSorting: false,
        header: ({ column }) => <DataTableColumnHeader column={column} title='Status' />,
        cell: ({ row: { original } }) => {
          const badge = STATUS_BADGES[original.status]
          return badge ? <Badge variant={badge.variant}>{badge.label}</Badge> : null
        }
      }
    ],
    [excludedCodes]
  )

  //* stay on the page while unticking
  const { table } = useDataTableClient({ data, columns, getRowId: (row) => row.id, autoResetPageIndex: false })

  //* a changed run or filter starts at page one, unticks don't
  const runKey = useMemo(() => rows.map((row) => row.code).join('|'), [rows])

  useEffect(() => {
    table.setPageIndex(0)
  }, [runKey, filter, table])

  //* each filter carries its own count
  const filterButton = (value: PreviewFilter, label: string, count: number) => {
    const isActive = filter === value

    return (
      <Button type='button' size='sm' variant={isActive ? 'default' : 'outline'} onClick={() => setFilter(value)}>
        {label}
        <Badge variant={isActive ? 'secondary' : 'soft-neutral'} className='ml-1 px-1.5'>
          {count}
        </Badge>
      </Button>
    )
  }

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex flex-wrap items-center gap-2 text-sm'>
        {filterButton('ALL', 'All', counts.total)}
        {filterButton('CREATE', 'To Create', counts.toCreate)}
        {filterButton('SKIPPED', 'Skipped', counts.skipped)}

        {isChecking && (
          <span className='text-muted-foreground ml-auto flex items-center gap-1'>
            <Icons.spinner className='size-4 animate-spin' /> Checking existing codes...
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
