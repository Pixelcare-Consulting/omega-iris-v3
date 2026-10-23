import { DEFAULT_USERNAME_SEPARATOR } from '@/constants/user'

type NameParts = { fname: string; mname?: string | null; lname: string; suffix?: string | null }

//* format fullName
export function toFullName({ fname, mname, lname, suffix }: NameParts) {
  return [fname, mname, lname, suffix]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ')
}

//* every run of punctuation folds into the separator, so 'John  Doe' and 'john.doe@x' both land on a dash-joined username
//! the trailing replace strips edge separators, which .trim() alone can't (e.g. '(john)' to '-john-' to 'john')
export function toUsername(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, DEFAULT_USERNAME_SEPARATOR)
    .replace(/^-+|-+$/g, '')
}

//* keystroke variant for InputField's `transform`, same folding but it must stay typable mid-word
//! no .trim() and no trailing-separator strip, or the dash in 'john-doe' would vanish the moment it's typed
//* only a leading separator is dropped, so a username can never start with one
export function toUsernameInput(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, DEFAULT_USERNAME_SEPARATOR)
    .replace(/^-+/, '')
}
