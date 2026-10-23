'use client'

import Highlighter from 'react-highlight-words'

import { splitGlobalFilterKeywords } from '@/lib/data-table'

type WordsHighlighterProps = {
  value?: string | null
  highlight?: string
}

export function WordsHighlighter({ value, highlight }: WordsHighlighterProps) {
  if (!highlight) return <>{value}</>

  //! split the same way the search does, or `rey*gomera` is hunted for literally and never highlights
  const searchWords = splitGlobalFilterKeywords(highlight)

  if (searchWords.length === 0) return <>{value}</>

  return (
    <Highlighter
      searchWords={searchWords}
      autoEscape
      textToHighlight={value ?? ''}
      highlightClassName='bg-yellow-200 dark:bg-yellow-500/30 rounded-sm px-0.5'
    />
  )
}
