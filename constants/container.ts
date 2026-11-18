import type { ContainerType } from '@/prisma/generated/enums'

export const CONTAINER_TYPES = ['BOX', 'ESD_BOX', 'TOTE', 'PLASTIC_BIN', 'TRAY', 'REEL_BOX'] as const satisfies readonly ContainerType[]

export const CONTAINER_TYPE_LABELS: Record<ContainerType, string> = {
  BOX: 'Box',
  ESD_BOX: 'ESD Box',
  TOTE: 'Tote',
  PLASTIC_BIN: 'Plastic Bin',
  TRAY: 'Tray',
  REEL_BOX: 'Reel Box'
}

export const CONTAINER_TYPE_OPTIONS = CONTAINER_TYPES.map((value) => ({ label: CONTAINER_TYPE_LABELS[value], value }))

//* bulk generate caps, rows match the label pdf limit
export const CONTAINER_GENERATE_MAX_LINES = 50
export const CONTAINER_GENERATE_MAX_ROWS = 1000
