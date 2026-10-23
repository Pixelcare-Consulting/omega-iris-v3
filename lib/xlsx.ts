import { CellStyle, WorkSheet, utils, read, writeFile } from 'xlsx-js-style'

type StyleWorkSheet = {
  worksheet: WorkSheet
  cellStyle: CellStyle
  headerStyle?: CellStyle
}

export function styleWorkSheet({ worksheet, cellStyle, headerStyle }: StyleWorkSheet) {
  const range = utils.decode_range(worksheet['!ref'] ?? '')
  const rowCount = range.e.r
  const columnCount = range.e.c

  for (let row = 0; row <= rowCount; row++) {
    for (let col = 0; col <= columnCount; col++) {
      const cellRef = utils.encode_cell({ r: row, c: col })

      //* add styles to cells
      worksheet[cellRef].s = cellStyle

      if (headerStyle && row === 0) {
        //* add styles to header
        worksheet[cellRef].s = {
          ...worksheet[cellRef].s,
          ...headerStyle
        }
      }
    }
  }
}

type ExportToExcel = {
  fileName: string
  sheetName?: string
  headers: string[]
  rows: (string | number | boolean | null | undefined)[][]
  cellStyle?: CellStyle
  headerStyle?: CellStyle
}

export function exportToExcel({ fileName, sheetName = 'Sheet1', headers, rows, cellStyle, headerStyle }: ExportToExcel) {
  //* normalize null/undefined so every cell actually exists on the sheet
  const safeRows = rows.map((row) => row.map((value) => value ?? ''))

  const worksheet = utils.aoa_to_sheet([headers, ...safeRows])

  styleWorkSheet({
    worksheet,
    cellStyle: cellStyle ?? { alignment: { vertical: 'center' } },
    headerStyle: headerStyle ?? { font: { bold: true }, fill: { fgColor: { rgb: 'EFEFEF' } } }
  })

  worksheet['!cols'] = headers.map((header, colIndex) => {
    const maxLength = safeRows.reduce((max, row) => Math.max(max, String(row[colIndex]).length), header.length)
    return { wch: maxLength + 4 }
  })

  const workbook = utils.book_new()
  utils.book_append_sheet(workbook, worksheet, sheetName)

  writeFile(workbook, fileName)
}

type parseExcelFile = {
  file: File
  header: string[]
  isRaw?: boolean
}

export type ExcelParseData = { [key: string]: any }

export function parseExcelFile({ file, header, isRaw }: parseExcelFile) {
  return new Promise<ExcelParseData[]>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = e.target?.result

        //* check if data exist, if not reject promise
        if (!data) {
          reject(new Error('Failed to parse excel file: Data not found!'))
          return
        }

        //* parse excel file
        //* default to read the first sheet
        const wb = read(data, { type: 'array' })
        const sheet = wb.Sheets[wb.SheetNames[0]]

        const jsonData = utils.sheet_to_json(sheet, {
          header,
          range: 1,
          defval: '',
          raw: isRaw
        }) as ExcelParseData[]

        //* resolve promise with json data
        return resolve(jsonData)
      } catch (error: any) {
        reject(new Error('Failed to parse excel file: ' + error?.message || 'Parsing Error'))
      }
    }

    reader.onerror = (error: any) => {
      reject(new Error('Failed to read file: ' + error?.message || 'File Reading Error'))
    }

    reader.readAsArrayBuffer(file)
  })
}
