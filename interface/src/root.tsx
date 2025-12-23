import { Outlet, Scripts, ScrollRestoration, Meta, Links } from 'react-router'
import { XProvider } from '@ant-design/x'
import './assets/styles/index.css'

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
          <Outlet />
        </XProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}
