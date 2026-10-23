import { MenuGroup, MenuItem } from '@/constants/config'
import { AnyAbility } from '@casl/ability'

export function findMenuItemByUrl(menuGroups: MenuGroup[], url: string): MenuItem | null {
  for (const group of menuGroups) {
    const found = findInItems(group.menu, url)
    if (found) return found
  }

  return null
}

function findInItems(items: MenuItem[], url: string): MenuItem | null {
  for (const item of items) {
    //* the item's url or a path under it, so /users never claims /usersettings
    if (item.url && (url === item.url || url.startsWith(`${item.url}/`))) return item

    //* search children
    if (item.items?.length) {
      const found = findInItems(item.items, url)
      if (found) return found
    }
  }

  return null
}

export function filterMenuItemsByAbility(items: MenuItem[], ability: AnyAbility): MenuItem[] {
  return items
    .map((item) => {
      const actions = Array.isArray(item.actions) ? item.actions : [item.actions]
      const subjects = Array.isArray(item.subjects) ? item.subjects : [item.subjects]

      //* check permission for current item
      const canViewItem = actions.some((act) => subjects.some((sub) => ability.can(act, sub)))

      //* filter children recursively
      const filteredChildren = item.items ? filterMenuItemsByAbility(item.items, ability) : []

      //* show item if user can view it, OR if it has at least 1 visible child
      if (!canViewItem && filteredChildren.length === 0) {
        return null
      }

      return {
        ...item,
        items: filteredChildren
      }
    })
    .filter(Boolean) as MenuItem[]
}

export function filterMenuGroupsByAbility(menuGroups: MenuGroup[], ability: AnyAbility): MenuGroup[] {
  return menuGroups
    .map((group) => {
      const filteredMenu = filterMenuItemsByAbility(group.menu, ability)

      //* drop the whole group if nothing inside is visible
      if (filteredMenu.length === 0) return null

      return {
        ...group,
        menu: filteredMenu
      }
    })
    .filter(Boolean) as MenuGroup[]
}
