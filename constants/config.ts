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
    subtitle: 'Inventory · WMS · Barcoding'
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
      },
      //TODO: add subjects and actions once each module has its permission, until then only the super user sees these
      {
        title: 'BP Master',
        url: '',
        icon: Icons.handshake,
        items: [
          {
            title: 'Customers',
            url: '/customers',
            icon: Icons.contact,
            items: [],
            subjects: PERMISSIONS_CODES.CUSTOMERS,
            actions: [PERMISSIONS_ALLOWED_ACTIONS.VIEW]
          },
          {
            title: 'Vendors',
            url: '/vendors',
            icon: Icons.store,
            items: [],
            subjects: PERMISSIONS_CODES.VENDORS,
            actions: [PERMISSIONS_ALLOWED_ACTIONS.VIEW]
          }
        ]
      },
      {
        title: 'Item Master',
        url: '/item-masters',
        icon: Icons.barcode,
        items: [],
        subjects: PERMISSIONS_CODES.ITEM_MASTERS,
        actions: [PERMISSIONS_ALLOWED_ACTIONS.VIEW]
      },
      {
        title: 'Warehouse',
        url: '',
        icon: Icons.warehouse,
        items: [
          {
            title: 'Sites',
            url: '/sites',
            icon: Icons.building,
            items: [],
            subjects: PERMISSIONS_CODES.SITES,
            actions: [PERMISSIONS_ALLOWED_ACTIONS.VIEW]
          },
          {
            title: 'Process Zones',
            url: '/process-zones',
            icon: Icons.grid,
            items: [],
            subjects: PERMISSIONS_CODES.PROCESS_ZONES,
            actions: [PERMISSIONS_ALLOWED_ACTIONS.VIEW]
          },
          {
            title: 'Locations',
            url: '/locations',
            icon: Icons.mapPin,
            items: [],
            subjects: PERMISSIONS_CODES.LOCATIONS,
            actions: [PERMISSIONS_ALLOWED_ACTIONS.VIEW]
          }
        ]
      },
      {
        title: 'Inventory',
        url: '',
        icon: Icons.boxes,
        items: [
          { title: 'Pallets', url: '/pallets', icon: Icons.layers, items: [] },
          { title: 'Containers', url: '/containers', icon: Icons.container, items: [] },
          { title: 'MPN / Unique ID', url: '/mpn', icon: Icons.fingerprint, items: [] },
          { title: 'Inbound', url: '/inbound', icon: Icons.packageOpen, items: [] },
          { title: 'Outbound', url: '/outbound', icon: Icons.truck, items: [] },
          { title: 'Cycle Count', url: '/cycle-counts', icon: Icons.listChecks, items: [] },
          { title: 'Movement', url: '/inventory-movements', icon: Icons.arrowLeftRight, items: [] }
        ]
      },
      {
        title: 'Project',
        url: '',
        icon: Icons.folderKanban,
        items: [
          {
            title: 'Project Categories',
            url: '/project-categories',
            icon: Icons.tags,
            items: [],
            subjects: PERMISSIONS_CODES.PROJECT_CATEGORIES,
            actions: [PERMISSIONS_ALLOWED_ACTIONS.VIEW]
          },
          {
            title: 'Customer Projects',
            url: '/customer-projects',
            icon: Icons.folderOpen,
            items: [],
            subjects: PERMISSIONS_CODES.CUSTOMER_PROJECTS,
            actions: [PERMISSIONS_ALLOWED_ACTIONS.VIEW]
          }
        ]
      },
      { title: 'Work Order', url: '/work-orders', icon: Icons.clipboadList, items: [] },
      { title: 'QC / Testing', url: '/qc-testing', icon: Icons.flaskConical, items: [] },
      { title: 'NCOR / RMA', url: '/ncor-rma', icon: Icons.packageX, items: [] },
      { title: 'Reports', url: '/reports', icon: Icons.chartColumn, items: [] },
      { title: 'Audit Logs', url: '/audit-logs', icon: Icons.fileClock, items: [] },
      { title: 'Settings', url: '/settings', icon: Icons.settings, items: [] }
    ]
  }
]
