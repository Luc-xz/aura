import { Outlet, Scripts, ScrollRestoration, Meta, Links } from 'react-router'
import { XProvider } from '@ant-design/x'
import { App as AntdApp, ConfigProvider } from 'antd'
import zhCN from 'antd/es/locale/zh_CN'
import './assets/styles/index.css'
import { setMessageInstance } from './http/handler'
import { applyCompact, getPreferences } from './utils/preferences'
import React from 'react'

const auraTheme = {
  token: {
    colorPrimary: '#2266D1',
    colorInfo: '#2266D1',
    colorSuccess: '#2F7D5C',
    colorWarning: '#AD6D18',
    colorError: '#C0392B',
    colorTextBase: '#16202A',
    colorBgLayout: '#F5F7F9',
    colorBorder: '#C6CFD8',
    colorBorderSecondary: '#E4EAF0',
    colorBgContainerDisabled: '#F1F3F5',
    borderRadius: 8,
    controlHeight: 34,
    fontSize: 13,
    fontFamily:
      "'Inter Variable', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
  },
  // D5（原型 15）：弹窗与二次确认规格 —— 10px 圆角、pop 级阴影、28px 内边距
  components: {
    Modal: {
      borderRadius: 10,
      paddingContentHorizontal: 28,
      boxShadow: '0 18px 44px -8px rgba(13, 20, 28, 0.26)',
    },
  },
}

function MessageProvider({ children }: { children: React.ReactNode }) {
  const { message } = AntdApp.useApp()
  React.useEffect(() => {
    setMessageInstance(message)
    // 启动时恢复本地偏好（紧凑模式挂在 <html> class 上）
    applyCompact(getPreferences().compact)
  }, [message])

  return <>{children}</>
}

export default function App() {
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="utf-8" />
        <link
          rel="icon"
          type="image/svg+xml"
          href="/favicon.svg"
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />
        <Meta />
        <Links />
        <title>Aura</title>
      </head>
      <body>
        <XProvider>
          <ConfigProvider
            locale={zhCN}
            theme={auraTheme}
            button={{ autoInsertSpace: false }}>
            <div className="aura-theme h-full">
              <AntdApp className="h-full">
                <MessageProvider>
                  <Outlet />
                </MessageProvider>
              </AntdApp>
            </div>
          </ConfigProvider>
        </XProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}
