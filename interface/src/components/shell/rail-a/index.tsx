import { Navigate, Outlet, useNavigate } from 'react-router'
import ProjectSidebar from '../project-sidebar'
import { AdminIcon, AuraLogoIcon, NoteIcon, SettingIcon, UserIcon, WorkspaceIcon } from '../icons'
import { useAuthShell } from '../use-auth-shell'
import { useShellNavigation } from '../use-shell-navigation'

export default function RailAShell() {
  const navigate = useNavigate()
  const { user, handleLogout } = useAuthShell()
  const { canWorkspace, canNotes, canSetting, canAdmin } = useShellNavigation()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const modules = [
    canWorkspace && {
      key: 'workspace',
      title: '工作台',
      path: '/workspace',
      Icon: WorkspaceIcon,
    },
    canNotes && { key: 'notes', title: '笔记', path: '/note', Icon: NoteIcon },
    canSetting && { key: 'setting', title: '设置', path: '/setting', Icon: SettingIcon },
    canAdmin && {
      key: 'admin',
      title: '系统管理',
      path: '/admin/users',
      Icon: AdminIcon,
    },
  ].filter(Boolean) as Array<{
    key: string
    title: string
    path: string
    Icon: typeof WorkspaceIcon
  }>

  return (
    <div className="flex h-full w-full overflow-hidden bg-canvas">
      <nav className="rail">
        <button
          type="button"
          className="rail__logo"
          title="Aura"
          onClick={() => navigate('/workspace')}>
          <AuraLogoIcon />
        </button>
        <div className="rail__spacer" />
        {modules.map(({ key, title, path, Icon }) => (
          <button
            key={key}
            type="button"
            className={`rail__item ${key === 'workspace' ? 'is-active' : ''}`}
            title={title}
            aria-label={title}
            onClick={() => navigate(path)}>
            <Icon />
          </button>
        ))}
        <div className="rail__spacer rail__spacer--grow" />
        <button
          type="button"
          className="rail__avatar"
          title={`${user.name} · 退出登录`}
          onClick={handleLogout}>
          <UserIcon />
        </button>
      </nav>
      <ProjectSidebar />
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
