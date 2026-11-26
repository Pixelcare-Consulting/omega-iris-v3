import { BatchErrorEntry } from '@/types/batch'

export const IMPORT_BATCH_SIZE = 50

export const IMPORT_GENERIC_ERROR_ENTRY: BatchErrorEntry = { field: 'General', message: 'Something went wrong while saving this row' }

export const IMPORT_TEMPLATE_PATHS = {
  INBOUND_ITEMS: '/import-templates/inbound-item-import-template.xlsx'
}

//* an inbound import is all or nothing, so the whole file goes in one call
export const INBOUND_ITEM_IMPORT_MAX_ROWS = 500

//* model field to sheet header, mandatory qc comes from the project's category
//! columns map by position, keep this order in sync with the template
export const INBOUND_ITEM_IMPORT_COLUMNS = {
  owner: 'Owner',
  mpn: 'MFG_PN',
  partNumber: 'Part_Number',
  commodityCode: 'Commodity_Code',
  dateCode: 'DC',
  countryOfOrigin: 'COO',
  lotCode: 'Lot_Code',
  packagingTypeCode: 'Packaging_Type_Code',
  spq: 'SPQ',
  cost: 'Cost',
  totalStock: 'Total_Stock',
  notes: 'Notes'
} as const

export const INBOUND_ITEM_IMPORT_HEADERS = Object.values(INBOUND_ITEM_IMPORT_COLUMNS)
