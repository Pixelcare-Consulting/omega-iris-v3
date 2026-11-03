import { Icon, Icons } from '@/components/icons'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from './permission'

export const APP_CONFIG = {
  name: 'Iris',
  fullName: 'Omega Iris Inventory & Warehouse Management System',
  description: 'Inventory, warehouse, and barcoding system for Omega.',
  creator: 'PXC Dev Team',
  features: [
    'Inventory Management',
    'Warehouse Management',
    'Barcode Scanning',
    'Quality Control',
    'Stock Monitoring',
    'Work Orders',
    'Reports & Analytics'
  ],
  tagLine: 'CONTROL. INSIGHT. EFFICIENCY.',
  company: 'Omega',
  workflow: ['Receive', 'Scan', 'Quality Check', 'Store', 'Pick', 'Ship'],
  sidebar: {
    title: 'Iris',
    subtitle: 'Inventory & WMS'
  },
  signin: {
    subtitle: 'Enter your credentials to access your account',
    logoSubtitle: 'Inventory Management System',
    eyebrow: 'OMEGA IRIS · INVENTORY & WMS',
    title: 'Your inventory,',
    titleHighlight: 'under control.',
    description:
      'Iris brings inventory, warehouse operations, and barcode scanning into one system. Receive, put away, pick, and ship with full stock visibility.'
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
    menu: [
      {
        title: 'Dashboard',
        url: '/dashboard',
        icon: Icons.dashboard,
        items: [],
        subjects: PERMISSIONS_CODES.DASHBOARD,
        actions: [PERMISSIONS_ALLOWED_ACTIONS.VIEW]
      }
    ]
  },
  {
    title: 'Administration',
    menu: [
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
  },
  //TODO: add subjects and actions once each module has its permission, until then only the super user sees these
  {
    title: 'Master Data',
    menu: [
      { title: 'Sites', url: '/sites', icon: Icons.warehouse, items: [] },
      { title: 'Project Categories', url: '/project-categories', icon: Icons.tags, items: [] },
      { title: 'Projects', url: '/projects', icon: Icons.folderKanban, items: [] },
      { title: 'Location Master', url: '/locations', icon: Icons.mapPin, items: [] },
      { title: 'Pallet Master', url: '/pallets', icon: Icons.layers, items: [] },
      { title: 'Container Master', url: '/containers', icon: Icons.container, items: [] },
      { title: 'Item Master', url: '/item-master', icon: Icons.package, items: [] }
    ]
  },
  {
    title: 'Warehouse',
    menu: [
      { title: 'Inbound', url: '/inbound', icon: Icons.packageOpen, items: [] },
      { title: 'Outbound', url: '/outbound', icon: Icons.truck, items: [] },
      { title: 'Inventory', url: '/inventory', icon: Icons.boxes, items: [] },
      { title: 'Inventory Movement', url: '/inventory-movements', icon: Icons.arrowLeftRight, items: [] },
      { title: 'Cycle Count', url: '/cycle-counts', icon: Icons.listChecks, items: [] }
    ]
  },
  {
    title: 'Quality',
    menu: [
      { title: 'QC / Testing', url: '/qc-testing', icon: Icons.flaskConical, items: [] },
      { title: 'NCOR / RMA', url: '/ncor-rma', icon: Icons.packageX, items: [] }
    ]
  },
  {
    title: 'Reports',
    menu: [
      { title: 'Reports', url: '/reports', icon: Icons.chartColumn, items: [] },
      { title: 'Audit Logs', url: '/audit-logs', icon: Icons.fileClock, items: [] }
    ]
  }
]
