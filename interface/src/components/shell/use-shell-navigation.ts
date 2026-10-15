import { useMemo } from 'react'
import { useUserStore } from '@/store'

interface StoreMenu {
  code?: string | null
  path?: string | null
  children?: StoreMenu[] | null
}

const flattenMenus = (menus: StoreMenu[]): StoreMenu[] =>
  menus.flatMap((menu) => [menu, ...(menu.children ? flattenMenus(menu.children) : [])])

export function useShellNavigation() {
  const roles = useUserStore((state) => state.roles)
  const menus = useUserStore((state) => state.menus)
  const permissions = useUserStore((state) => state.permissions)

  return useMemo(() => {
    const isSuperAdmin = !!roles?.includes('super_admin')
    const flatMenus = flattenMenus(menus ?? [])
    const hasMenu = (...candidates: string[]) =>
      isSuperAdmin ||
      flatMenus.some(
        (menu) =>
          (menu.code != null && candidates.includes(menu.code)) ||
          (menu.path != null && candidates.includes(menu.path))
      )
    const hasPermission = (...codes: string[]) =>
      isSuperAdmin || codes.some((code) => permissions?.includes(code))

    const canAdmin =
      hasPermission('user:list', 'role:list', 'menu:list') ||
      hasMenu('/admin/users', '/admin/roles', '/admin/menus')

    return {
      canAdmin,
      canChat: hasMenu('chat', '/chat'),
      canWorkspace: hasMenu('workspace', '/workspace'),
      canNotes: hasMenu('note', 'note_list', '/note'),
      canSetting: hasMenu('setting', 'model_config', '/setting', '/setting/model-config'),
      canManageUsers: hasPermission('user:list') || hasMenu('/admin/users'),
      canManageRoles: hasPermission('role:list') || hasMenu('/admin/roles'),
      canManageMenus: hasPermission('menu:list') || hasMenu('/admin/menus'),
    }
  }, [menus, permissions, roles])
}
