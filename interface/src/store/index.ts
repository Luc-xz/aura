import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export const useWorkspaceStore = create(persist((set) => ({
  workspace: null,
  setWorkspace: (workspace) => set({ workspace }),
}), {
  name: 'workspace-store',
  storage: createJSONStorage(() => localStorage),
  skipHydration: true,
}))

export const useUserStore = create(persist((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}), {
  name: 'user-store',
  storage: createJSONStorage(() => localStorage),
  skipHydration: true,
}))

export const rehydrateStores = () => {
  useWorkspaceStore.persist.rehydrate()
  useUserStore.persist.rehydrate()
}
