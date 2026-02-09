import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface User {
  id: number
  name: string
  email: string
  token: string
}

interface Workspace {
  id: number
  name: string
  [key: string]: unknown
}

interface WorkspaceState {
  workspace: Workspace | null
  setWorkspace: (workspace: Workspace | null) => void
}

interface UserState {
  user: User | null
  setUser: (user: User | null) => void
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

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      workspace: null,
      setWorkspace: (workspace) => set({ workspace }),
    }),
    {
      name: 'workspace-store',
      storage: createJSONStorage(getStorage),
    }
  )
)

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
    }),
    {
      name: 'user-store',
      storage: createJSONStorage(getStorage),
    }
  )
)
