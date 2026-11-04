import { createContext } from 'react'

//* images picked on a form, uploaded only when it saves
export type StagedImages = {
  //* staged file per field name
  files: Record<string, File>
  //* upload percent per field name while saving
  progress: Record<string, number>
  onStage: (name: string, file: File | null) => void
}

export const StagedImagesContext = createContext<StagedImages | null>(null)
