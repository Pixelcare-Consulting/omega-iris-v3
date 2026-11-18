import { createElement, type ReactElement } from 'react'
import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'

import { logger } from '@/lib/logger'
import { formatDate } from '@/lib/utils'
import { getCurrentDbCode } from '@/lib/sap/access'
import { getCurrentUserWithAbility } from '@/actions/user'
import { getLocationsByIds } from '@/actions/location'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { labelsPdfSchema } from '@/schema/label'
import CodeLabelDocument from '@/components/pdf/code-label-document'

//! a route handler, not a server action, the pdf goes back as a file
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserWithAbility()

    if (!currentUser?.ability) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

    if (!currentUser.ability.can(PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.LOCATIONS)) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const dbCode = await getCurrentDbCode()

    if (!dbCode) return NextResponse.json({ message: 'No SAP database selected!' }, { status: 401 })

    const parsed = labelsPdfSchema.safeParse(await request.json().catch(() => null))

    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0]?.message ?? 'Invalid label request' }, { status: 400 })
    }

    const { ids, size, isDownload } = parsed.data

    //* deleted or other database rows drop out
    const locations = await getLocationsByIds(dbCode, ids)

    if (locations.length === 0) return NextResponse.json({ message: 'No locations found!' }, { status: 404 })

    const document = createElement(CodeLabelDocument, {
      title: 'Location Labels',
      items: locations,
      size
    }) as unknown as ReactElement<DocumentProps>

    const buffer = await renderToBuffer(document)

    const disposition = isDownload ? 'attachment' : 'inline'
    const encodedName = encodeURIComponent(`LOCATION-LABELS-${formatDate(new Date(), 'yyyy-MM-dd-HHmmss')}.pdf`)

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(buffer.length),
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `${disposition}; filename*=UTF-8''${encodedName}`
      }
    })
  } catch (err: any) {
    logger.error(err, '[GET_LOCATION_LABELS_PDF_ERROR]:')
    return NextResponse.json({ message: 'Something went wrong! Please try again later.' }, { status: 500 })
  }
}
