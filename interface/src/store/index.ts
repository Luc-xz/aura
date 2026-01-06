import { create } from 'zustand'

export const useWorkspaceStore = create((set) => ({
  workspace: null,
  setWorkspace: (workspace) => set({ workspace }),
}))
