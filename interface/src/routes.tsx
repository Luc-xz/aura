import { route, layout, prefix, index } from '@react-router/dev/routes'

export default [
  route('login', './pages/login/index.tsx'),
  layout('./pages/layout/index.tsx', [
    index('./pages/chat/index.tsx'),
    ...prefix('note', [index('./pages/note/index.tsx'), route('edit/:id?', './pages/note/edit.tsx')]),
    route('setting', './pages/setting/index.tsx'),
  ]),
]
