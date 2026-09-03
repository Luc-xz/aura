import { useState, useEffect } from 'react'
import { Navigate, Outlet, useNavigate, useLocation } from 'react-router'
import { Flex, Layout, Menu } from 'antd'
import { LogoutOutlined, MenuUnfoldOutlined, MenuFoldOutlined, BookOutlined, OpenAIFilled, SettingFilled, TeamOutlined } from '@ant-design/icons'
import { useUserStore } from '@/store'
import { profile } from '@/api/user'
const { Header, Footer, Sider, Content } = Layout

const ICON_MAP: Record<string, React.ReactNode> = {
  OpenAIFilled: <OpenAIFilled />,
  BookOutlined: <BookOutlined />,
  SettingFilled: <SettingFilled />,
  TeamOutlined: <TeamOutlined />,
}

const transformMenu = (menus: any[]): any[] =>
  menus
    .filter((menu) => menu.visible === 1 && menu.type !== 'button') // 只显示可见的目录/菜单
    .map((menu) => ({
      key: String(menu.id),
      label: menu.name,
      path: menu.path,
      icon: ICON_MAP[menu.icon],
      children: menu.children ? transformMenu(menu.children) : undefined,
    }))

const findKey = (path: string, items: any[]): string | undefined => {
  let find
  for (let i = 0; i < items.length; i++) {
    let item = items[i]
    if (item.path === path) {
      find = item.key
      break
    }
    if (item.children && item.children.length > 0) {
      let res = findKey(path, item.children)
      if (res) {
        find = res
        break
      }
    }
  }
  return find
}

export default function MyLayout() {
  let location = useLocation().pathname
  const navigate = useNavigate()
  const user = useUserStore((state) => state.user)
  const clearUser = useUserStore((state) => state.clearUser)
  const setRoles = useUserStore((state) => state.setRoles)
  const setMenus = useUserStore((state) => state.setMenus)
  const setPermissions = useUserStore((state) => state.setPermissions)
  const menus = useUserStore((state) => state.menus)
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [collapsed, setCollapsed] = useState(false)

  // 已登录时静默刷新 profile，管理员改动角色/菜单后无需重新登录
  useEffect(() => {
    if (!user?.token) return
    const refresh = async () => {
      const [err, res] = await profile()
      if (res?.data) {
        setRoles(res.data.roles)
        setMenus(res.data.menus)
        setPermissions(res.data.permissions)
      }
    }
    refresh()
  }, [])

  const menuItems = transformMenu(menus || [])
  const handleMenuClick = ({ item, key, keyPath, domEvent }: any) => {
    setSelectedKeys([key])
    item?.props?.path && navigate(item.props.path)
  }

  const handleLogout = () => {
    clearUser()
    navigate('/login', { replace: true })
  }

  // 初始化菜单选中
  useEffect(() => {
    const key = findKey(location, menuItems)
    setSelectedKeys(key ? [key] : [])
  }, [location, menus])

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
      />
    )
  }

  return (
    <Flex className="w-full h-full">
      <Layout>
        <Sider
          className="relative"
          collapsed={collapsed}
          theme="light">
          <Menu
            className="mb-10"
            selectedKeys={selectedKeys}
            items={menuItems}
            onClick={handleMenuClick}
            inlineCollapsed={collapsed}
            mode="inline"
            theme="light"
          />
          <div className="absolute bottom-0 left-0 px-8 py-2 h-10 w-full border-t border-ashen">
            <div
              className="text-base cursor-pointer hover:text-blue-500"
              onClick={() => setCollapsed(!collapsed)}>
              {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </div>
            <LogoutOutlined
              className="text-base cursor-pointer hover:text-blue-500"
              title="退出登录"
              onClick={handleLogout}
            />
          </div>
        </Sider>
        <Layout>
          <Outlet />
        </Layout>
      </Layout>
    </Flex>
  )
}
