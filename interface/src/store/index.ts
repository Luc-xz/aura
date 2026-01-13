import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export const useWorkspaceStore = create(persist((set) => ({
  workspace: null,
  setWorkspace: (workspace) => set({ workspace }),
}), {
  name: 'workspace-store',
  storage: createJSONStorage(() => localStorage),
}))

export const useUserStore = create(persist((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}), {
  name: 'user-store',
  storage: createJSONStorage(() => localStorage),
}))
