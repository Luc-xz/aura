// 客户端本地偏好（流式输出 / 紧凑模式）：不落后端，localStorage 持久化
export interface Preferences {
  stream: boolean
  compact: boolean
}

const KEY = 'aura-preferences'

const DEFAULTS: Preferences = {
  stream: true,
  compact: false,
}

export const getPreferences = (): Preferences => {
  if (typeof window === 'undefined') return DEFAULTS
  try {
    return { ...DEFAULTS, ...JSON.parse(window.localStorage.getItem(KEY) || '{}') }
  } catch {
    return DEFAULTS
  }
}

export const setPreferences = (patch: Partial<Preferences>): Preferences => {
  const next = { ...getPreferences(), ...patch }
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(KEY, JSON.stringify(next))
  }
  applyCompact(next.compact)
  return next
}

// 紧凑模式挂在 <html> 的 class 上，由全局 CSS 收紧会话间距
export const applyCompact = (compact: boolean) => {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('compact-mode', compact)
}
