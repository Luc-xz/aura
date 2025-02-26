import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router'
import { Flex, Layout, Menu } from 'antd'
import { OpenAIFilled, SettingFilled } from '@ant-design/icons'
import ColumnGroup from 'antd/es/table/ColumnGroup'
const { Header, Footer, Sider, Content } = Layout

const items = [
  { key: '1', icon: <OpenAIFilled />, label: 'Chat', path: '/chat' },
  {
    key: '2',
    label: 'System',
    icon: <SettingFilled />,
    children: [{ key: '2-1', label: 'Setting', path: '/setting' }],
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

  return (
    <Flex className="w-full h-full">
      <Layout>
        <Sider
          style={{
            backgroundColor: 'white',
          }}>
          <Menu
            selectedKeys={selectedKeys}
            items={items}
            onClick={handleMenuClick}
            mode="inline"
            theme="light"
          />
        </Sider>
        <Layout>
          <Outlet />
        </Layout>
      </Layout>
    </Flex>
  )
}
