import type { ActivityConfig } from '@/types/activity-log'
import type { ItemMaster } from '@/prisma/generated/client'

//* the thumbnail is logged by setItemMasterThumbnail, never as a file id
export const ITEM_MASTER_ACTIVITY_CONFIG: ActivityConfig<ItemMaster> = {
  fields: [
    { key: 'ItemCode', label: 'MFG P/N' },
    { key: 'FirmCode', label: 'Manufacturer', format: (row) => row.FirmName ?? row.FirmCode },
    { key: 'ItemName', label: 'Description' },
    { key: 'ItmsGrpCod', label: 'Group', format: (row) => row.ItmsGrpNam ?? row.ItmsGrpCod },
    { key: 'notes', label: 'Notes' },
    { key: 'isActive', label: 'Active' }
  ]
}
