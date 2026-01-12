import { create } from 'zustand'

export const useWorkspaceStore = create((set) => ({
  workspace: null,
  setWorkspace: (workspace) => set({ workspace }),
}))

interface User {
  id: number
  name: string
  email: string
  token: string
}

interface UserStore {
  user: User | null
  setUser: (user: User | null) => void
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}))

