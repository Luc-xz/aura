export const WORKSPACE_CHANGED_EVENT = 'aura:workspace-changed'

export const dispatchWorkspaceChanged = () => {
  window.dispatchEvent(new CustomEvent(WORKSPACE_CHANGED_EVENT))
}
