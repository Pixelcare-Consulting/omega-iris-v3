import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import sharp from 'sharp'
import { z } from 'zod'

import db from '@/lib/db'
import { logger } from '@/lib/logger'
import { getDisk } from '@/lib/storage'
import { formatDate } from '@/lib/utils'
import { getCurrentDbCode } from '@/lib/sap/access'
import { getCurrentUserWithAbility } from '@/actions/user'
import { getDataTableItemMastersSvr, ItemMasterRow } from '@/actions/item-master'
import { SAP_SYNC_STATUS_OPTIONS } from '@/constants/sap-sync'
import { dataTableParamsSchema } from '@/schema/data-table'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'

const THUMBNAIL_SIZE_PX = 80
const THUMBNAIL_ROW_HEIGHT = 62 //* points, a bit over the 80px image
const THUMBNAIL_COLUMN_WIDTH = 13 //* characters
const IMAGE_BATCH_SIZE = 5 //* images read at once, keeps a big export from loading every file together

type ExportColumn = { id: string; header: string; width: number; value?: (row: ItemMasterRow) => string }

const toDateText = (date: Date | null) => (date ? formatDate(new Date(date), 'yyyy-MM-dd HH:mm:ss') : '')

//* same ids as the list columns, so the visible ones pick what gets exported
const EXPORT_COLUMNS: ExportColumn[] = [
  { id: 'thumbnail', header: 'Thumbnail', width: THUMBNAIL_COLUMN_WIDTH },
  { id: 'ItemCode', header: 'MFG P/N', width: 24, value: (row) => row.ItemCode },
  { id: 'ItemName', header: 'Description', width: 40, value: (row) => row.ItemName ?? '' },
  { id: 'FirmName', header: 'Manufacturer', width: 28, value: (row) => row.FirmName ?? '' },
  { id: 'ItmsGrpNam', header: 'Group', width: 28, value: (row) => row.ItmsGrpNam ?? '' },
  { id: 'syncStatus', header: 'Sync Status', width: 14, value: (row) => SAP_SYNC_STATUS_OPTIONS.find((o) => o.value === row.syncStatus)?.label ?? row.syncStatus }, // prettier-ignore
  { id: 'syncedAt', header: 'Synced At', width: 20, value: (row) => toDateText(row.syncedAt) },
  { id: 'notes', header: 'Notes', width: 40, value: (row) => row.notes ?? '' },
  { id: 'isActive', header: 'Active', width: 10, value: (row) => (row.isActive ? 'Yes' : 'No') },
  { id: 'createdAt', header: 'Created At', width: 20, value: (row) => formatDate(new Date(row.createdAt), 'yyyy-MM-dd HH:mm:ss') },
  { id: 'updatedAt', header: 'Updated At', width: 20, value: (row) => formatDate(new Date(row.updatedAt), 'yyyy-MM-dd HH:mm:ss') }
]

const exportParamsSchema = dataTableParamsSchema.extend({ columnIds: z.array(z.string()).optional() })

//* the thumbnail as a small png, null when the row or the file is gone
async function readThumbnail(fileAttachmentId: string) {
  try {
    const fileAttachment = await db.fileAttachment.findUnique({ where: { id: fileAttachmentId } })

    if (!fileAttachment) return null

    const bytes = await getDisk(fileAttachment.disk).getBytes(fileAttachment.key)

    //* exceljs takes png or jpeg only, so webp becomes png here too
    return await sharp(bytes).resize(THUMBNAIL_SIZE_PX, THUMBNAIL_SIZE_PX, { fit: 'inside' }).png().toBuffer()
  } catch (err: any) {
    logger.error(err, '[ITEM_MASTER_EXPORT_THUMBNAIL_ERROR]:')
    return null
  }
}

//! a route handler, not a server action, the workbook goes back as a file
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserWithAbility()

    if (!currentUser?.ability) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

    if (!currentUser.ability.can(PERMISSIONS_ALLOWED_ACTIONS.EXPORT, PERMISSIONS_CODES.ITEM_MASTERS)) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const dbCode = await getCurrentDbCode()

    if (!dbCode) return NextResponse.json({ message: 'No SAP database selected!' }, { status: 401 })

    const parsed = exportParamsSchema.safeParse(await request.json())

    if (!parsed.success) return NextResponse.json({ message: 'Invalid export request' }, { status: 400 })

    const { columnIds, ...params } = parsed.data

    const columns = columnIds ? EXPORT_COLUMNS.filter((column) => columnIds.includes(column.id)) : EXPORT_COLUMNS

    if (columns.length === 0) return NextResponse.json({ message: 'No columns available to export!' }, { status: 400 })

    const { data } = await getDataTableItemMastersSvr(dbCode, { ...params, isExport: true })

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('EXPORTED_DATA')

    worksheet.columns = columns.map((column) => ({ header: column.header, key: column.id, width: column.width }))
    worksheet.getRow(1).font = { bold: true }

    data.forEach((row) => {
      worksheet.addRow(Object.fromEntries(columns.map((column) => [column.id, column.value?.(row) ?? ''])))
    })

    //* thumbnails sit over their cell, a row without one stays blank
    const thumbnailColumnIndex = columns.findIndex((column) => column.id === 'thumbnail')

    if (thumbnailColumnIndex !== -1) {
      for (let start = 0; start < data.length; start += IMAGE_BATCH_SIZE) {
        const batch = data.slice(start, start + IMAGE_BATCH_SIZE)

        const images = await Promise.all(batch.map((row) => (row.thumbnail ? readThumbnail(row.thumbnail) : null)))

        images.forEach((image, index) => {
          const rowIndex = start + index + 1 //* 0-based, the header takes row 0
          const sheetRow = worksheet.getRow(rowIndex + 1)

          sheetRow.height = THUMBNAIL_ROW_HEIGHT

          if (!image) return

          const imageId = workbook.addImage({ buffer: image as any, extension: 'png' })

          worksheet.addImage(imageId, {
            tl: { col: thumbnailColumnIndex, row: rowIndex },
            ext: { width: THUMBNAIL_SIZE_PX, height: THUMBNAIL_SIZE_PX }
          })
        })
      }
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const fileName = `item-masters-${formatDate(new Date(), 'MM-dd-yyyy')}.xlsx`

    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'private, no-store'
      }
    })
  } catch (err: any) {
    logger.error(err, '[ITEM_MASTER_EXPORT_ERROR]:')
    return NextResponse.json({ message: 'Something went wrong! Please try again later.' }, { status: 500 })
  }
}
