import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { WorkspaceItem } from '@/api/workspace'

interface User {
  id: number
  name: string
  email: string
  token: string
}

interface Menu {
  id: number
  parentId: number
  name: string
  code: string
  permission: string
  path: string
  icon: string
  type: string
  visible: number
  status?: number
  children?: Array<Menu>
  sortOrder?: number
  createdAt?: string
  updatedAt?: string
}

interface WorkspaceState {
  workspace: WorkspaceItem | null
  setWorkspace: (workspace: WorkspaceItem | null) => void
}

interface UserState {
  user: User | null
  roles: string[] | null
  menus: Array<Menu> | null
  permissions: string[] | null
  setUser: (user: User | null) => void
  setRoles: (roles: string[] | null) => void
  setMenus: (menus: Array<Menu> | null) => void
  setPermissions: (permissions: string[] | null) => void
  clearUser: () => void
}

// 创建浏览器安全的 storage
// React Router 7 即使 ssr: false，构建时也会在 Node.js 中执行一次
const getStorage = () => {
  if (typeof window === 'undefined') {
    // SSR/构建时环境：返回空的 storage
    return {
      getItem: () => null,
      setItem: () => { },
      removeItem: () => { },
    }
  }
  return localStorage
}

// 当前项目跨会话记忆：仅持久化 workspace 字段；进入 chat 页时 URL ?workspaceId= 优先级高于它（F1.2）
export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      workspace: null,
      setWorkspace: (workspace) => set({ workspace }),
    }),
    {
      name: 'workspace-store',
      storage: createJSONStorage(getStorage),
      partialize: (state) => ({ workspace: state.workspace }),
    }
  )
)

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      roles: [],
      menus: [],
      permissions: [],
      setUser: (user) => set({ user }),
      setRoles: (roles) => set({ roles }),
      setMenus: (menus) => set({ menus }),
      setPermissions: (permissions) => set({ permissions }),
      clearUser: () => set({
        user: null,
        roles: [],
        menus: [],
        permissions: []
      })
    }),
    {
      name: 'user-store',
      storage: createJSONStorage(getStorage),
    }
  )
)
