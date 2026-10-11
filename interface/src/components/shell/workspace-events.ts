export const CREATE_WORKSPACE_EVENT = 'aura:create-workspace'
export const WORKSPACE_CHANGED_EVENT = 'aura:workspace-changed'

export const dispatchCreateWorkspace = () => {
  window.dispatchEvent(new CustomEvent(CREATE_WORKSPACE_EVENT))
}

export const dispatchWorkspaceChanged = () => {
  window.dispatchEvent(new CustomEvent(WORKSPACE_CHANGED_EVENT))
}
