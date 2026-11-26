import { createElement, type ReactElement } from 'react'
import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'

import { logger } from '@/lib/logger'
import { getCurrentDbCode } from '@/lib/sap/access'
import { getCurrentUserWithAbility } from '@/actions/user'
import { getPackagingUnitByCode } from '@/actions/packaging-unit'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { labelSizeSchema } from '@/schema/label'
import CodeLabelDocument from '@/components/pdf/code-label-document'

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const currentUser = await getCurrentUserWithAbility()

    if (!currentUser?.ability) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

    if (!currentUser.ability.can(PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.PACKAGING_UNITS)) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const dbCode = await getCurrentDbCode()

    if (!dbCode) return NextResponse.json({ message: 'No SAP database selected!' }, { status: 401 })

    const code = decodeURIComponent((await params).code)
    const unit = await getPackagingUnitByCode(dbCode, code)

    if (!unit) return NextResponse.json({ message: 'Unique ID not found!' }, { status: 404 })

    const size = labelSizeSchema.parse(request.nextUrl.searchParams.get('size'))

    const document = createElement(CodeLabelDocument, {
      title: 'Unique ID Label',
      items: [{ id: unit.id, code: unit.code }],
      size
    }) as unknown as ReactElement<DocumentProps>

    const buffer = await renderToBuffer(document)

    //* inline opens in the browser, ?download=1 saves
    const isDownload = request.nextUrl.searchParams.get('download') === '1'
    const disposition = isDownload ? 'attachment' : 'inline'
    const encodedName = encodeURIComponent(`UNIQUE-ID-LABEL-${unit.code}.pdf`)

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(buffer.length),
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `${disposition}; filename*=UTF-8''${encodedName}`
      }
    })
  } catch (err: any) {
    logger.error(err, '[GET_PACKAGING_UNIT_LABEL_PDF_ERROR]:')
    return NextResponse.json({ message: 'Something went wrong! Please try again later.' }, { status: 500 })
  }
}
