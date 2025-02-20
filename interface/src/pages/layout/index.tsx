import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router'
import { Flex, Layout, Menu } from 'antd'
import { OpenAIFilled, SettingFilled } from '@ant-design/icons'
const { Header, Footer, Sider, Content } = Layout

const items = [
  { key: '1', icon: <OpenAIFilled />, label: 'Chat', path: '/chat' },
  {
    key: '2',
    label: 'System',
    icon: <SettingFilled />,
    children: [{ key: '2-1', label: 'Config', path: '/config' }],
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
  let key = findKey(location, items)
  console.log(key)
  const [selectedKeys, setSelectedKeys] = useState([key || '1'])
  const handleMenuClick = ({ item, key, keyPath, domEvent }) => {
    let path = item.props.path || '/'
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
