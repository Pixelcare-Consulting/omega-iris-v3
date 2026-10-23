import { Icons } from '@/components/icons'

//TODO: replace with the final name, office, and photo
export const ABOUT_FEATURED_OFFICIAL = {
  name: 'Hon. Alfonso C. Lahora Jr.',
  title: 'Vice Mayor',
  office: 'Presiding Officer, Sangguniang Bayan',
  //* falls back to initials until the photo exists
  image: '/images/vice-mayor.jpg',
  initials: 'AL',
  statement:
    'Every ordinance and resolution we pass belongs to the people we serve. Putting our records in one secure, searchable system is how we make that service faster, cleaner, and open to scrutiny.'
} as const

export type AboutCapability = {
  title: string
  description: string
  icon: keyof typeof Icons
}

export const ABOUT_CAPABILITIES: AboutCapability[] = []

export const ABOUT_GOALS = []
