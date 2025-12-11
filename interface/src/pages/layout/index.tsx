import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router'
import { Flex, Layout, Menu } from 'antd'
import { BookOutlined, OpenAIFilled, SettingFilled, MenuUnfoldOutlined, MenuFoldOutlined } from '@ant-design/icons'
import ColumnGroup from 'antd/es/table/ColumnGroup'
const { Header, Footer, Sider, Content } = Layout

const items = [
  { key: '1', icon: <OpenAIFilled />, label: 'Chat', path: '/chat' },
  {
    key: '2',
    icon: <BookOutlined />,
    label: 'Note',
    children: [
      { key: '2-1', label: 'New Note', path: '/note/edit' },
      { key: '2-2', label: 'My Notes', path: '/note' },
    ],
  },
  {
    key: '3',
    label: 'System',
    icon: <SettingFilled />,
    children: [{ key: '3-1', label: 'Setting', path: '/setting' }],
  },
]

const findKey = (path, items) => {
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
  const [selectedKeys, setSelectedKeys] = useState([])
  const handleMenuClick = ({ item, key, keyPath, domEvent }) => {
    setSelectedKeys([key])
    navigate(item.props.path)
  }

  // 初始化菜单选中
  if (!selectedKeys || selectedKeys.length === 0) {
    let key = findKey(location, items)
    setSelectedKeys([key])
  }

  const [collapsed, setCollapsed] = useState(false)

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
            items={items}
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
          </div>
        </Sider>
        <Layout>
          <Outlet />
        </Layout>
      </Layout>
    </Flex>
  )
}
