import { Document, Page, Path, Rect, StyleSheet, Svg, Text } from '@react-pdf/renderer'

import { LABEL_SIZES, LabelSize } from '@/constants/label'
import { getQrPath } from '@/lib/qr'

const QR_QUIET_ZONE = 4 //* modules of white around the code
const CODE_CHAR_WIDTH = 0.62 //* helvetica bold width per font size, rough
const QR_MAX_WIDTH_RATIO = 0.45 //* leave room for the code on narrow labels

//* shrink the code to fit one line
const fitFontSize = (text: string, maxSize: number, width: number) =>
  Math.min(maxSize, width / (Math.max(text.length, 1) * CODE_CHAR_WIDTH))

const styles = StyleSheet.create({
  page: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', color: '#000000', fontFamily: 'Helvetica' },
  compactPage: { flexDirection: 'column', justifyContent: 'center' },
  code: { flex: 1, fontFamily: 'Helvetica-Bold', maxLines: 1 },
  compactCode: { flex: 0, textAlign: 'center' }
})

//* one path per code, so big batches stay light
function PdfQrCode({ value, size }: { value: string; size: number }) {
  const { viewSize, d } = getQrPath(value, QR_QUIET_ZONE)

  return (
    <Svg viewBox={`0 0 ${viewSize} ${viewSize}`} width={size} height={size}>
      <Rect x={0} y={0} width={viewSize} height={viewSize} fill='#ffffff' />
      <Path d={d} fill='#000000' />
    </Svg>
  )
}

type CodeLabelDocumentProps = { title: string; items: { id: string; code: string }[]; size: LabelSize }

//* one qr label per page, the qr holds the code only
export default function CodeLabelDocument({ title, items, size }: CodeLabelDocumentProps) {
  const { width, height, isCompact } = LABEL_SIZES[size]

  const padding = height * 0.06
  const qrSize = Math.min(height - padding * 2, width * QR_MAX_WIDTH_RATIO)
  const textWidth = width - padding * 3 - qrSize

  return (
    <Document title={title}>
      {items.map((item) => {
        if (isCompact) {
          //* qr centered, code below it
          const compactFontSize = fitFontSize(item.code, height * 0.16, width - padding * 2)
          const compactQrSize = height - padding * 2 - compactFontSize * 1.2

          return (
            //! no wrap, overflow would feed a blank label
            <Page key={item.id} size={[width, height]} style={[styles.page, styles.compactPage, { padding }]} wrap={false}>
              <PdfQrCode value={item.code} size={compactQrSize} />
              <Text style={[styles.code, styles.compactCode, { fontSize: compactFontSize }]}>{item.code}</Text>
            </Page>
          )
        }

        return (
          //! no wrap, overflow would feed a blank label
          <Page key={item.id} size={[width, height]} style={[styles.page, { padding, gap: padding }]} wrap={false}>
            <PdfQrCode value={item.code} size={qrSize} />
            <Text style={[styles.code, { fontSize: fitFontSize(item.code, height * 0.2, textWidth) }]}>{item.code}</Text>
          </Page>
        )
      })}
    </Document>
  )
}
