import { useState } from 'react'
import { XProvider } from '@ant-design/x'
import { Routes, Route, Navigate } from 'react-router'

import Login from './pages/login'
import Layout from './pages/layout'
import Config from './pages/config'
import Chat from './pages/chat'

function App() {
  return (
    <XProvider>
      <Routes>
        <Route
          path="login"
          element={<Login />}
        />
        <Route element={<Layout />}>
          <Route
            index
            element={<Navigate to="chat" />}
          />
          <Route
            path="config"
            element={<Config />}
          />
          <Route
            path="chat"
            element={<Chat />}
          />
        </Route>
      </Routes>
    </XProvider>
  )
}

export default App
