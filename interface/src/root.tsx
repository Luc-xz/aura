import { Outlet, Scripts, ScrollRestoration, Meta, Links } from 'react-router'
import { XProvider } from '@ant-design/x'
import { App as AntdApp } from 'antd'
import './assets/styles/index.css'
import { setMessageInstance } from './http/handler'
import { applyCompact, getPreferences } from './utils/preferences'
import React from 'react'

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
          <AntdApp className="h-full">
            <MessageProvider>
              <Outlet />
            </MessageProvider>
          </AntdApp>
        </XProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}
