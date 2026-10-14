import { Navigate, Outlet, useLocation, useNavigate } from 'react-router'
import { useState } from 'react'
import { ProjectList, ProjectSearch } from '../project-sidebar'
import { useProjectSidebar } from '../use-project-sidebar'
import { AuraLogoIcon, LogoutIcon, NoteIcon, SettingIcon, UserIcon, WorkspaceIcon } from '../icons'
import { useAuthShell } from '../use-auth-shell'
import { useShellNavigation } from '../use-shell-navigation'
import { LeftbarNavContext } from '../leftbar-nav'
import type { LeftbarNavSlot } from '../leftbar-nav'

type LeftbarMode = 'work' | 'notes' | 'settings'

export default function LeftbarBShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const pathname = location.pathname
  const [customNav, setCustomNav] = useState<LeftbarNavSlot | null>(null)
  const { user, handleLogout } = useAuthShell()
  const {
    canChat,
    canWorkspace,
    canNotes,
    canSetting,
    canAdmin,
    canManageUsers,
    canManageRoles,
    canManageMenus,
  } = useShellNavigation()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const mode: LeftbarMode = pathname.startsWith('/setting') || pathname.startsWith('/admin')
    ? 'settings'
    : pathname.startsWith('/note')
      ? 'notes'
      : 'work'
  const canEnterChat = canChat || canWorkspace
  // 方案 B 转正：工作台模块 = 项目网格（/workspace）+ 推进页（/chat），modnav 入口指向网格
  const primaryModules = [
    canEnterChat && {
      key: 'workspace',
      label: '工作台',
      path: '/workspace',
      Icon: WorkspaceIcon,
    },
    canNotes && { key: 'notes', label: '笔记', path: '/note', Icon: NoteIcon },
    canSetting && { key: 'setting', label: '设置', path: '/setting', Icon: SettingIcon },
  ].filter(Boolean) as Array<{
    key: string
    label: string
    path: string
    Icon: typeof WorkspaceIcon
  }>

  const settingModules = [
    canWorkspace && {
      key: 'workspace',
      label: '工作台',
      path: '/workspace',
      Icon: WorkspaceIcon,
    },
    canNotes && { key: 'notes', label: '笔记', path: '/note', Icon: NoteIcon },
    canSetting && { key: 'setting', label: '设置', path: '/setting', Icon: SettingIcon },
  ].filter(Boolean) as Array<{
    key: string
    label: string
    path: string
    Icon: typeof WorkspaceIcon
  }>

  const isActivePath = (path: string, prefix = false) =>
    prefix ? pathname.startsWith(path) : pathname === path
  // 工作台模块激活覆盖网格页与推进页（原型 03 data-key=workspace / 06 data-key=chat）
  const isWorkspaceModule = pathname.startsWith('/workspace') || pathname === '/chat'

  return (
    <LeftbarNavContext.Provider value={{ setNav: setCustomNav }}>
      <div className="flex h-full w-full overflow-hidden bg-canvas">
        <aside className={`col-left ${customNav?.narrow ? 'col-left--narrow' : ''}`}>
          <div className="brand">
            <div className="brand__logo">
              <AuraLogoIcon size={14} />
            </div>
            <span className="brand__name">Aura</span>
            {mode === 'work' ? <span className="brand__tag">自主体验</span> : null}
          </div>

          {mode === 'settings' ? (
            <>
              <nav className="modnav">
                {settingModules.map(({ key, label, path, Icon }) => (
                  <button
                    key={key}
                    type="button"
                    className={`modnav__item ${isActivePath(path, path === '/note') ? 'is-active' : ''}`}
                    onClick={() => navigate(path)}>
                    <Icon />
                    {label}
                  </button>
                ))}
              </nav>
              <div className="divider" />
              <div className="group-title">设置</div>
              <nav className="setnav">
                <button
                  type="button"
                  className={`setnav__item ${pathname === '/setting' ? 'is-active' : ''}`}
                  onClick={() => navigate('/setting')}>
                  <span className="w-[14px] text-center">◎</span>
                  账户设置
                </button>
                <button
                  type="button"
                  className={`setnav__item ${pathname === '/setting/model-config' ? 'is-active' : ''}`}
                  onClick={() => navigate('/setting/model-config')}>
                  <span className="w-[14px] text-center">✦</span>
                  我的模型
                </button>
              </nav>
              {canAdmin ? (
                <>
                  <div className="group-title">系统管理</div>
                  <nav className="setnav">
                    {canManageUsers ? (
                      <button
                        type="button"
                        className={`setnav__item ${pathname === '/admin/users' ? 'is-active' : ''}`}
                        onClick={() => navigate('/admin/users')}>
                        用户管理
                      </button>
                    ) : null}
                    {canManageRoles ? (
                      <button
                        type="button"
                        className={`setnav__item ${pathname === '/admin/roles' ? 'is-active' : ''}`}
                        onClick={() => navigate('/admin/roles')}>
                        角色管理
                      </button>
                    ) : null}
                    {canManageMenus ? (
                      <button
                        type="button"
                        className={`setnav__item ${pathname === '/admin/menus' ? 'is-active' : ''}`}
                        onClick={() => navigate('/admin/menus')}>
                        菜单管理
                      </button>
                    ) : null}
                  </nav>
                </>
              ) : null}
            </>
          ) : customNav ? (
            customNav.node
          ) : (
            <>
              <nav className={`modnav ${mode === 'work' ? 'modnav--row' : ''}`}>
                {primaryModules.map(({ key, label, path, Icon }) => (
                  <button
                    key={key}
                    type="button"
                    className={`modnav__item ${
                      (key === 'workspace' ? isWorkspaceModule : isActivePath(path, path === '/note'))
                        ? 'is-active'
                        : ''
                    }`}
                    onClick={() => navigate(path)}>
                    <Icon />
                    {label}
                  </button>
                ))}
              </nav>
              <LeftbarProjects />
            </>
          )}

          <div className="user-bar">
            <div className="user-bar__avatar">
              <UserIcon />
            </div>
            <span className="user-bar__name">{user.name}</span>
            <button
              type="button"
              className="ml-auto text-placeholder hover:text-error"
              title="退出登录"
              onClick={handleLogout}>
              <LogoutIcon />
            </button>
          </div>
        </aside>
        <main className="min-w-0 flex-1 overflow-hidden bg-canvas">
          <Outlet />
        </main>
      </div>
    </LeftbarNavContext.Provider>
  )
}

function LeftbarProjects() {
  const location = useLocation()
  const { filteredProjects, keyword, setKeyword, loading, selectedId, selectProject } =
    useProjectSidebar()

  return (
    <>
      <div className="divider" />
      <div className="group-title">项目</div>
      <ProjectSearch
        keyword={keyword}
        onChange={setKeyword}
      />
      <ProjectList
        projects={filteredProjects}
        loading={loading}
        // 网格页侧栏无选中态（原型 03），推进页默认首项高亮（原型 06）
        selectedId={location.pathname.startsWith('/workspace') ? null : selectedId}
        onSelect={selectProject}
      />
    </>
  )
}
