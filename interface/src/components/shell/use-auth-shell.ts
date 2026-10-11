import { useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { profile, logout } from '@/api/user'
import { useUserStore } from '@/store'

export function useAuthShell() {
  const navigate = useNavigate()
  const user = useUserStore((state) => state.user)
  const clearUser = useUserStore((state) => state.clearUser)
  const setRoles = useUserStore((state) => state.setRoles)
  const setMenus = useUserStore((state) => state.setMenus)
  const setPermissions = useUserStore((state) => state.setPermissions)

  const refreshProfile = useCallback(async () => {
    const [, res] = await profile()
    const data = res?.data as
      | { roles: string[]; menus: never[]; permissions: string[] }
      | undefined
    if (data) {
      setRoles(data.roles)
      setMenus(data.menus)
      setPermissions(data.permissions)
    }
  }, [setMenus, setPermissions, setRoles])

  useEffect(() => {
    if (!user?.token) return
    void refreshProfile()
  }, [refreshProfile, user?.token])

  const handleLogout = useCallback(async () => {
    await logout(null)
    clearUser()
    navigate('/login', { replace: true })
  }, [clearUser, navigate])

  return { user, handleLogout }
}
