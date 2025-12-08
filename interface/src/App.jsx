import { useState } from 'react'
import { XProvider } from '@ant-design/x'
import { Routes, Route, Navigate } from 'react-router'

import Login from './pages/login'
import Layout from './pages/layout'
import Setting from './pages/setting'
import Chat from './pages/chat'
import Note from './pages/note'

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
            path="note"
            element={<Note />}>
            <Route
              path="new"
              element={<Note />}
            />
          </Route>
          <Route
            path="setting"
            element={<Setting />}
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
