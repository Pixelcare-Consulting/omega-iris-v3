export const FULLSCREEN_STORAGE_KEY = 'fullscreen_state'

export const FULLSCREEN_SHORTCUT_KEY = 'F8'

//* sessionStorage fires no event for its own tab, this one tells the store to re-read
export const FULLSCREEN_STORAGE_EVENT = 'fullscreen-state-change'

//* the indicator opens wide then shrinks, so it stops competing with the content
export const FULLSCREEN_INDICATOR_COLLAPSE_DELAY_MS = 3000
