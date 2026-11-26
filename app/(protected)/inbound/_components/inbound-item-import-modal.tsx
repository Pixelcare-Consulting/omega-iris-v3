'use client'

import { useAction } from 'next-safe-action/hooks'

import ImportModal from '@/components/import-modal'
import { importInboundItems } from '@/actions/inbound'
import { IMPORT_TEMPLATE_PATHS, INBOUND_ITEM_IMPORT_HEADERS, INBOUND_ITEM_IMPORT_MAX_ROWS } from '@/constants/import'

type InboundItemImportModalProps = {
  isOpen: boolean
  inboundCode: string
  userCode: number | null
  onClose: () => void
  onImported: () => void
}

export default function InboundItemImportModal({ isOpen, inboundCode, userCode, onClose, onImported }: InboundItemImportModalProps) {
  const importInboundItemsAction = useAction(importInboundItems)

  //* a refused import comes back as a message, the modal marks every row with it
  const importBatch = async (rows: Parameters<typeof importInboundItemsAction.executeAsync>[0]['rows']) => {
    const response = await importInboundItemsAction.executeAsync({ inboundCode, rows })
    const result = response?.data

    if (!result) return undefined
    if (result.data) return result.data

    throw new Error(result.message)
  }

  return (
    <ImportModal
      isOpen={isOpen}
      userCode={userCode}
      title='Import Packages'
      description='Upload an .xlsx file using the template.'
      moduleName='inbound-items'
      entityName='packages'
      headers={INBOUND_ITEM_IMPORT_HEADERS}
      templatePath={IMPORT_TEMPLATE_PATHS.INBOUND_ITEMS}
      batchSize={INBOUND_ITEM_IMPORT_MAX_ROWS}
      importBatch={importBatch}
      onClose={onClose}
      onImported={onImported}
    />
  )
}
