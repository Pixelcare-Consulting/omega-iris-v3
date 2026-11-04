import { NextRequest, NextResponse } from 'next/server'
import { Readable } from 'node:stream'

import db from '@/lib/db'
import { logger } from '@/lib/logger'
import { getDisk } from '@/lib/storage'
import { getCurrentUserWithAbility } from '@/actions/user'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUserWithAbility()

    if (!currentUser) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const fileAttachment = await db.fileAttachment.findUnique({ where: { id } })

    if (!fileAttachment) return NextResponse.json({ message: 'Attachment not found' }, { status: 404 })

    const disk = getDisk(fileAttachment.disk)

    if (!(await disk.exists(fileAttachment.key))) return NextResponse.json({ message: 'File not found' }, { status: 404 })

    const stream = Readable.toWeb(await disk.getStream(fileAttachment.key)) as ReadableStream

    //* inline previews PDFs and images, ?download=1 saves instead
    const isDownload = request.nextUrl.searchParams.get('download') === '1'
    const disposition = isDownload ? 'attachment' : 'inline'

    //! filename* not filename, a quoted filename is never decoded so spaces save as %20
    const encodedName = encodeURIComponent(fileAttachment.originalName)

    return new NextResponse(stream, {
      headers: {
        'Content-Type': fileAttachment.mimeType,
        'Content-Length': String(fileAttachment.size),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff', //! the stored type comes from the client, nosniff stops the browser reading past it
        'Content-Disposition': `${disposition}; filename*=UTF-8''${encodedName}`
      }
    })
  } catch (err: any) {
    logger.error(err, '[GET_FILE_ATTACHMENT_ERROR]:')
    return NextResponse.json({ message: 'Something went wrong! Please try again later.' }, { status: 500 })
  }
}
