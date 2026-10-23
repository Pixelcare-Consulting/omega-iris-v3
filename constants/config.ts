import { Icon, Icons } from '@/components/icons'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from './permission'

export const APP_CONFIG = {
  name: 'PXC Portal',
  fullName: 'Pixelcare Consulting Corporation Portal',
  description: 'A internal portal for Pixelcare Consulting.',
  creator: 'PXC Dev Team',
  features: ['Lead Management', 'Quotations', 'Reports', 'User Management', 'Role-Based Access', 'Multi-Tenant Access'],
  tagLine: 'WE DEVELOP, WE CARE',
  company: 'Pixelcare Consulting Corporation',
  offices: ['Singapore', 'Malaysia', 'Philippines'],
  sidebar: {
    title: 'PXC Portal',
    subtitle: 'Pixelcare Consulting Corp.'
  },
  signin: {
    eyebrow: 'PXC PORTAL · INTERNAL',
    title: 'Built for the people',
    titleHighlight: 'behind the projects.',
    description: "Pixelcare's internal workspace. The tools and records the team needs to keep daily work moving, all in one place."
  }
} as const

export type MenuItem = {
  title: string
  url: string
  icon?: Icon
  isDisabled?: boolean
  isExternal?: boolean
  items: MenuItem[]
  subjects?: string | string[]
  actions?: string | string[]
}

export type MenuGroup = {
  title?: string
  menu: MenuItem[]
}

export const MENU_GROUPS: MenuGroup[] = [
  {
    title: 'Modules',
    menu: [
      {
        title: 'Dashboard',
        url: '/dashboard',
        icon: Icons.dashboard,
        items: [],
        subjects: PERMISSIONS_CODES.DASHBOARD,
        actions: [PERMISSIONS_ALLOWED_ACTIONS.VIEW]
      },
      {
        title: 'Users',
        url: '/users',
        icon: Icons.users,
        items: [],
        subjects: PERMISSIONS_CODES.USERS,
        actions: [PERMISSIONS_ALLOWED_ACTIONS.VIEW]
      },
      {
        title: 'Roles',
        url: '/roles',
        icon: Icons.userKey,
        items: [],
        subjects: PERMISSIONS_CODES.ROLES,
        actions: [PERMISSIONS_ALLOWED_ACTIONS.VIEW]
      }
    ]
  }
]
