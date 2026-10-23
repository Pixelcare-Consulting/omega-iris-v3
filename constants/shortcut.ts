//* `keys` renders one Kbd per entry, so a chord is a list and a single key is a list of one
export type Shortcut = { label: string; keys: string[] }

export const SHORTCUTS: Shortcut[] = [
  { label: 'Search', keys: ['Ctrl', 'K'] },
  { label: 'Toggle sidebar', keys: ['Ctrl', 'B'] },
  { label: 'Toggle fullscreen', keys: ['F8'] }
]
