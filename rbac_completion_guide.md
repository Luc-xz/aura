# Aura RBAC 收尾开发文档

> 目标读者：继续完成 RBAC 改造的开发者。按本文档 **Phase A → H 顺序执行**，每一步给出目标文件、完整代码与验证方式。
>
> 配套文档：`rbac_redesign.md`（设计：menu 即权限）、`rbac_implementation_plan.md`（旧设计，已废弃，见 Phase H）。
> 当前分支：`feature/rbac#20260709`。后端已提交的功能标记为 ✅，本文档只补缺口。

## 现状速览

| 模块 | 状态 |
|------|------|
| 数据库 init.sql（menu/role_menu/种子/首用户 super_admin） | ✅ 已完成 |
| 后端中间件（loadAuthContext / requirePermission / requireSelfOrPermission / requireOwnership） | ✅ 已完成 |
| 后端端点（user/role/menu CRUD + profile + 分配角色/菜单） | ✅ 已完成 |
| note/workspace/model-config 归属校验 | ✅ 已完成；chat 改为固定读工作区挂载配置（Phase E1/E2） |
| 严格提权防护 | ❌ Phase E |
| super_admin 权限/菜单查询实体化（profile 口径对齐） | ❌ Phase B0 |
| 存量库迁移 SQL | ❌ Phase F |
| 前端（登录后 profile 回填 / 菜单渲染 / 路由守卫 / 权限组件 / 登出） | ⚠️ 有未提交 WIP 且存在 bug，Phase A/B 修复 |
| 管理后台三页面（用户/角色/菜单管理） | ❌ Phase D |
| 测试（note/model-config/chat 归属、提权防护） | ❌ Phase G |

## 全局约定（改代码前必读）

1. **HTTP 响应**：后端所有成功响应为 `HTTP 200 + { data, code: 200, message: 'success' }`；业务错误通过抛 `AppError`（`server/utils/appError.js`）由全局错误中间件返回对应 HTTP 状态码（401/403/404/409…）。
2. **前端 API 调用**：`interface/src/http/index.ts` 把响应包装成元组，统一写法：
   ```ts
   const [err, res] = await someApi(payload)
   if (res) { /* res 是 { code, message, data } 信封，数据在 res.data */ }
   ```
   错误提示由 axios 拦截器全局弹出（`http/handler.ts`），调用方不必处理 err。
3. **驼峰转换**：后端 Model 层 `formatResponse` 会把 `user_id` → `userId` 等 snake_case 转为驼峰，前端拿到的字段都是驼峰。
4. **提权防护采用「严格模式」**（已确认）：super_admin 角色只能由 super_admin 分配；系统角色权限仅 super_admin 可改；非 super_admin 只能授予自己拥有的权限；super_admin 用户仅 super_admin 可删。
5. **前端不做角色特判**：super_admin 的特权由后端在查询层实体化（Phase B0），profile 返回的 `permissions`/`menus` 即前端可见/可用范围的完整集合。前端只查集合，不写 `roles.includes('super_admin')` 之类的授权判断；`isSuperAdmin` 仅允许用于交互提示（如按钮置灰），真正的拦截永远在服务端。

---

## Phase A：前端基础修复（让现有 WIP 跑通）

### A1. `interface/src/store/index.ts` — 修类型 + 加 clearUser

修改 `UserState` 接口与实现（`String[]` 是笔误，且缺登出清空动作）：

```typescript
interface UserState {
  user: User | null
  roles: string[] | null
  menus: Array<Menu> | null
  permissions: string[] | null
  setUser: (user: User | null) => void
  setRoles: (roles: string[] | null) => void
  setMenus: (menus: Array<Menu> | null) => void
  setPermissions: (permissions: string[] | null) => void
  clearUser: () => void
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      roles: [],
      menus: [],
      permissions: [],
      setUser: (user) => set({ user }),
      setRoles: (roles) => set({ roles }),
      setMenus: (menus) => set({ menus }),
      setPermissions: (permissions) => set({ permissions }),
      // 登出/切换账号时清空全部用户态
      clearUser: () => set({ user: null, roles: [], menus: [], permissions: [] }),
    }),
    {
      name: 'user-store',
      storage: createJSONStorage(getStorage),
    }
  )
)
```

### A2. `interface/src/pages/login/index.tsx` — 修复 setProfile（当前必抛 TypeError）

**问题**：`const [roles, permissions, menus] = res` 是对 `{code, message, data}` 信封对象做数组解构，会抛 `TypeError: object is not iterable`，导致 roles/menus/permissions 永远写不进 store；且 `setProfile()` 未 await 就 navigate。

**替换 `setProfile` 与登录 useEffect**（约 L209-238）：

```tsx
const setProfile = async () => {
  const [err, res] = await profile()
  if (res?.data) {
    const { roles, permissions, menus } = res.data
    setRoles(roles)
    setMenus(menus)
    setPermissions(permissions)
  }
  return null
}

useEffect(() => {
  if (!actionData) return
  message.success('提交成功')
  const go = async () => {
    if (type === 'login') {
      setUser(actionData)
      // 必须先拿到角色/菜单再进主界面，否则侧边栏先渲染成空
      await setProfile()
      navigate('/chat')
    }
    if (type === 'register') {
      setType('login')
    }
  }
  go()
}, [actionData])
```

### A3. `interface/src/pages/layout/index.tsx` — 整文件重写

**修复点**：antd Menu 缺 `key`/`label` 映射（当前渲染空白）；`visible !== false` 对数字 1/0 无效；`findKey` 还在引用旧静态 `items`（死代码）；渲染期 `setState` 反模式；icon 用 `dangerouslySetInnerHTML`（改映射表）；缺登录守卫；缺 profile 刷新；新增登出按钮。

```tsx
import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router'
import { Flex, Layout, Menu } from 'antd'
import {
  BookOutlined, LogoutOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  OpenAIFilled, SettingFilled, TeamOutlined,
} from '@ant-design/icons'
import { useUserStore } from '@/store'
import { profile } from '@/api/user'

const { Sider, Content } = Layout

// DB 中 menu.icon 存的是 antd 图标组件名（与 init.sql 种子一致），前端查表渲染，未知名称不渲染图标。
// 禁止用 dangerouslySetInnerHTML 直接渲染 icon 字段（可被 menu:update 权限者写入）。
const ICON_MAP: Record<string, React.ReactNode> = {
  OpenAIFilled: <OpenAIFilled />,
  BookOutlined: <BookOutlined />,
  SettingFilled: <SettingFilled />,
  TeamOutlined: <TeamOutlined />,
}

const transformMenu = (menus: any[]): any[] =>
  menus
    .filter((menu) => menu.visible === 1 && menu.type !== 'button')
    .map((menu) => ({
      key: String(menu.id),        // antd Menu 必需
      label: menu.name,            // antd Menu 必需
      icon: menu.icon ? ICON_MAP[menu.icon] : undefined,
      path: menu.path,
      children: menu.children?.length ? transformMenu(menu.children) : undefined,
    }))

// 按 path 定位当前选中菜单（支持前缀匹配，如 /setting/model-config 选中「设置」）
const findKey = (path: string, items: any[]): string | undefined => {
  for (const item of items) {
    if (item.path && (item.path === path || path.startsWith(item.path + '/') || (item.path !== '/' && path.startsWith(item.path)))) {
      return item.key
    }
    if (item.children) {
      const found = findKey(path, item.children)
      if (found) return found
    }
  }
}

export default function MyLayout() {
  const location = useLocation().pathname
  const navigate = useNavigate()
  const user = useUserStore((state) => state.user)
  const menus = useUserStore((state) => state.menus)
  const setRoles = useUserStore((state) => state.setRoles)
  const setMenus = useUserStore((state) => state.setMenus)
  const setPermissions = useUserStore((state) => state.setPermissions)
  const clearUser = useUserStore((state) => state.clearUser)
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [collapsed, setCollapsed] = useState(false)

  const menuItems = transformMenu(menus || [])

  // 已登录但角色/菜单可能过期：挂载时静默刷新 profile（管理员改了角色无需重新登录）
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

  // 初始化/同步菜单选中项（不再渲染期 setState）
  useEffect(() => {
    const key = findKey(location, menuItems)
    setSelectedKeys(key ? [key] : [])
  }, [location, menus])

  // 登录守卫：无 token 一律回登录页
  if (!user) {
    return <Navigate to="/login" replace />
  }

  const handleMenuClick = ({ key, item }: any) => {
    setSelectedKeys([key])
    // button 类型菜单没有 path，不导航
    if (item?.props?.path) {
      navigate(item.props.path)
    }
  }

  const handleLogout = () => {
    clearUser()
    navigate('/login', { replace: true })
  }

  return (
    <Flex className="w-full h-full">
      <Layout>
        <Sider className="relative" collapsed={collapsed} theme="light">
          <Menu
            className="mb-10"
            selectedKeys={selectedKeys}
            items={menuItems}
            onClick={handleMenuClick}
            inlineCollapsed={collapsed}
            mode="inline"
            theme="light"
          />
          <div className="absolute bottom-0 left-0 px-8 py-2 h-10 w-full border-t border-ashen flex items-center justify-between">
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
          <Content>
            <Outlet />
          </Content>
        </Layout>
      </Layout>
    </Flex>
  )
}
```

> 注意：删除了原文件顶部的静态 `items` 数组、`antd/es/table/ColumnGroup` 死导入、未使用的 `Header/Footer` 解构。

**验证 A**：`cd interface && pnpm dev`。用 `admin@aura.com / Admin_123456` 登录 → 应看到「Chat / Note（New Note、My Notes）/ System（Setting、Model Config）/ 系统管理（含用户、角色、菜单管理）」完整菜单，刷新页面菜单不丢，右下角可登出。再用普通注册账号登录 → 只见「Chat / Note / System」。

---

## Phase B：权限设施

### B0.（服务端前置）`server/models/rbac.js` — super_admin 权限/菜单实体化

**问题**：`requirePermission` 对 super_admin 走角色旁路（不依赖 role_menu 数据），而 profile 返回给前端的 `permissions`/`menus` 是从 role_menu 链路算出来的——两条口径可能分裂（典型场景：新建菜单忘记绑定 super_admin 角色时，后端接口放行但超管界面看不到）。修改两个查询，把特权在数据层实体化，让 profile 返回的集合即后端真实授权范围：

```javascript
/**
 * 获取用户的所有权限码（通过 role → menu.permission 链路）
 * super_admin 直接返回全量权限码，与 requirePermission 的放行口径对齐
 */
static async getUserPermissions(userId) {
  const roles = await this.getUserRoles(userId)
  if (roles.includes('super_admin')) {
    const [all] = await db.query(
      'SELECT DISTINCT permission FROM menu WHERE permission IS NOT NULL AND status = 1'
    )
    return all.map(row => row.permission)
  }
  const [rows] = await db.query(
    `SELECT DISTINCT m.permission FROM menu m
     JOIN role_menu rm ON m.id = rm.menu_id
     JOIN user_role ur ON rm.role_id = ur.role_id
     WHERE ur.user_id = ?
       AND m.permission IS NOT NULL
       AND m.status = 1`,
    [userId]
  )
  return rows.map(row => row.permission)
}

/**
 * 获取用户可见的菜单列表（平铺，接口层自行 toTree）
 * super_admin 直接返回全部可见菜单：新建菜单未绑定角色时超管也可见
 */
static async getUserMenus(userId) {
  const roles = await this.getUserRoles(userId)
  if (roles.includes('super_admin')) {
    const [all] = await db.query(
      `SELECT * FROM menu
       WHERE type IN ('directory', 'menu') AND visible = 1 AND status = 1
       ORDER BY sort_order ASC, id ASC`
    )
    return all.map(formatResponse)
  }
  const [rows] = await db.query(
    `SELECT DISTINCT m.* FROM menu m
     JOIN role_menu rm ON m.id = rm.menu_id
     JOIN user_role ur ON rm.role_id = ur.role_id
     WHERE ur.user_id = ?
       AND m.type IN ('directory', 'menu')
       AND m.visible = 1
       AND m.status = 1
     ORDER BY m.sort_order ASC, m.id ASC`,
    [userId]
  )
  return rows.map(formatResponse)
}
```

> **保留项（不要删）**：`requirePermission`/`requireOwnership`/`assertModelConfigOwned` 中的 super_admin 角色旁路是服务端安全网——防止 role_menu 配置损坏把系统锁死，与前端无关；init.sql 种子里 super_admin 的全量 role_menu 绑定同样保留作兜底。前端因此不需要（也不应该）写任何 super_admin 特判。

### B1. `interface/src/components/permission/index.tsx`（现为空文件）

```tsx
import { useMemo } from 'react'
import { useUserStore } from '@/store'

/**
 * 权限判断 hook：只查后端下发的权限码集合（super_admin 的全量权限已由 B0 实体化）
 */
export const usePermission = () => {
  const roles = useUserStore((state) => state.roles)
  const permissions = useUserStore((state) => state.permissions)

  return useMemo(() => {
    // isSuperAdmin 仅用于交互提示（如角色管理页系统角色按钮置灰），不参与权限判断
    const isSuperAdmin = !!roles?.includes('super_admin')
    return {
      isSuperAdmin,
      hasPermission: (code: string) => !!permissions?.includes(code),
    }
  }, [roles, permissions])
}

interface AuthButtonProps {
  permission: string
  children: React.ReactNode
  /** 无权限时渲染的替代内容，默认不渲染 */
  fallback?: React.ReactNode
}

/**
 * 按钮级权限组件（与后端 requirePermission 的权限码一一对应）
 *
 * <AuthButton permission="user:create"><Button>新增用户</Button></AuthButton>
 */
export const AuthButton = ({ permission, children, fallback = null }: AuthButtonProps) => {
  const { hasPermission } = usePermission()
  if (!hasPermission(permission)) {
    return <>{fallback}</>
  }
  return <>{children}</>
}
```

### B2. 新建 `interface/src/guards/AdminGuard.tsx` — 管理路由守卫

守卫本身不认识任何具体路径：每个管理页在自己的路由模块里用 `handle` 声明页面级权限（即 D2-D4 页面代码里的 `export const handle`，权限码与 init.sql 种子中对应 menu 页面的 `permission` 字段一致），守卫通过 `useMatches()` 读取当前 URL 命中的最深路由上的声明。新增管理页 = 建页面文件（带一行 handle）+ routes.tsx 注册一行，不存在「路由注册了、权限映射忘了加」的脱节。

```tsx
import { Navigate, Outlet, useMatches } from 'react-router'
import { useUserStore } from '@/store'
import { usePermission } from '@/components/permission'

/**
 * 管理后台路由守卫：未登录 → /login；无所需页面权限 → /chat
 * 菜单动态渲染只控制「入口显不显示」，这里控制「页面进不进得去」——
 * 手敲 URL / 书签 / 菜单被删改后残留的路由，都由本守卫拦截（后端接口另有 requirePermission 兜底）
 */
export default function AdminGuard() {
  const matches = useMatches()
  const user = useUserStore((state) => state.user)
  const { hasPermission } = usePermission()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // matches 从根到叶排序，倒着取第一个声明了 permission 的路由（即当前页面路由）
  const required = [...matches]
    .reverse()
    .map((m) => (m.handle as { permission?: string } | undefined)?.permission)
    .find(Boolean)

  // fail-closed：admin 子树下的路由漏声明 handle 一律视为无权，防止新页面裸奔
  // （开发期若想改为「未声明则放行」，把条件换成 required && !hasPermission(required)）
  if (!required || !hasPermission(required)) {
    return <Navigate to="/chat" replace />
  }
  return <Outlet />
}
```

**验证 B**：member 登录后地址栏手敲 `/admin/users` 应被弹回 `/chat`（admin 路由在 Phase D 注册，本条可在完成 D1 后回归验证）；super_admin 可正常进入三个管理页。

---

## Phase C：API 模块扩展

### C1. `interface/src/api/user/index.ts` — 追加管理接口

```typescript
export const findById = (id: number) => {
  return request({
    url: `/api/user/${id}`,
    method: 'GET',
  })
}

export const page = (params: any) => {
  return request({
    url: '/api/user/page',
    method: 'GET',
    params,
  })
}

export const update = (id: number, payload: any) => {
  return request({
    url: `/api/user/${id}`,
    method: 'PUT',
    data: payload,
  })
}

export const remove = (id: number) => {
  return request({
    url: `/api/user/${id}`,
    method: 'DELETE',
  })
}

export const assignRoles = (id: number, roleIds: number[]) => {
  return request({
    url: `/api/user/${id}/roles`,
    method: 'PUT',
    data: { roleIds },
  })
}
```

### C2. 新建 `interface/src/api/role/index.ts`

```typescript
import { request } from '@/http'

export const list = (params?: any) => {
  return request({ url: '/api/role/list', method: 'GET', params })
}

export const create = (payload: any) => {
  return request({ url: '/api/role', method: 'POST', data: payload })
}

export const update = (id: number, payload: any) => {
  return request({ url: `/api/role/${id}`, method: 'PUT', data: payload })
}

export const remove = (id: number) => {
  return request({ url: `/api/role/${id}`, method: 'DELETE' })
}

export const getMenus = (id: number) => {
  return request({ url: `/api/role/${id}/menus`, method: 'GET' })
}

export const assignMenus = (id: number, menuIds: number[]) => {
  return request({ url: `/api/role/${id}/menus`, method: 'PUT', data: { menuIds } })
}
```

### C3. 新建 `interface/src/api/menu/index.ts`

```typescript
import { request } from '@/http'

export const list = (params?: any) => {
  return request({ url: '/api/menu/list', method: 'GET', params })
}

export const tree = (params?: any) => {
  return request({ url: '/api/menu/tree', method: 'GET', params })
}

export const create = (payload: any) => {
  return request({ url: '/api/menu', method: 'POST', data: payload })
}

export const update = (id: number, payload: any) => {
  return request({ url: `/api/menu/${id}`, method: 'PUT', data: payload })
}

export const remove = (id: number) => {
  return request({ url: `/api/menu/${id}`, method: 'DELETE' })
}
```

---

## Phase D：管理后台三页面 + 路由

### D0.（服务端前置）用户详情回显角色 ID

分配角色弹窗需要回显当前角色，而 `GET /api/user/:id` 目前不返回角色。改两处：

**`server/models/rbac.js`** 追加两个方法：

```javascript
/**
 * 获取用户的所有角色 ID（管理后台回显用）
 */
static async getUserRoleIds(userId) {
  const [rows] = await db.query('SELECT role_id FROM user_role WHERE user_id = ?', [userId])
  return rows.map(row => row.role_id)
}

/**
 * 获取用户拥有的所有菜单 ID（提权防护 R3 用，Phase E 也会用到）
 */
static async getUserMenuIds(userId) {
  const [rows] = await db.query(
    `SELECT DISTINCT rm.menu_id FROM role_menu rm
     JOIN user_role ur ON rm.role_id = ur.role_id
     WHERE ur.user_id = ?`,
    [userId]
  )
  return rows.map(row => row.menu_id)
}
```

**`server/endpoints/user.js`** 修改 `GET /:id`（约 L87）：

```javascript
router.get('/:id', ...withAuthContext, requireSelfOrPermission('user:read'), asyncHandler(async (req, res) => {
  const { id } = req.params
  const data = await User.findById(id)
  if (!data) {
    throw NotFound('user not found')
  }
  // 附带角色 ID 列表，供管理后台「分配角色」回显
  const roleIds = await Rbac.getUserRoleIds(id)
  res.status(200).json({
    data: { ...data, roleIds },
    code: 200,
    message: 'success'
  })
}))
```

### D1. `interface/src/routes.tsx` — 注册 admin 路由（AdminGuard 包裹）

```tsx
import { route, layout, prefix, index } from '@react-router/dev/routes'

export default [
  index('./pages/index.tsx'),
  route('login', './pages/login/index.tsx'),
  layout('./pages/layout/index.tsx', [
    route('chat', './pages/chat/index.tsx'),
    ...prefix('note', [index('./pages/note/index.tsx'), route('edit/:id?', './pages/note/edit.tsx')]),
    ...prefix('setting', [index('./pages/setting/index.tsx'), route('model-config', './pages/setting/model-config.tsx')]),
    layout('./guards/AdminGuard.tsx', [
      ...prefix('admin', [
        route('users', './pages/admin/users/index.tsx'),
        route('roles', './pages/admin/roles/index.tsx'),
        route('menus', './pages/admin/menus/index.tsx'),
      ]),
    ]),
  ]),
]
```

### D2. 新建 `interface/src/pages/admin/users/index.tsx` — 用户管理

```tsx
import { useEffect, useState } from 'react'
import { App, Button, Drawer, Form, Input, Layout, Popconfirm, Select, Space, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { findById, page as pageUser, remove as removeUser, update as updateUser, assignRoles } from '@/api/user'
import { list as listRoles } from '@/api/role'
import { AuthButton } from '@/components/permission'

interface UserRow { id: number; name: string; email: string; createdAt: string }
interface RoleRow { id: number; name: string; code: string; isSystem: number }

// 页面级权限声明：AdminGuard 通过 useMatches 读取（见 B2）
export const handle = { permission: 'user:list' }

export default function Page() {
  const { message } = App.useApp()
  const [list, setList] = useState<UserRow[]>([])
  const [total, setTotal] = useState(0)
  const [query, setQuery] = useState({ page: 1, pageSize: 10, keyword: '' })
  const [editOpen, setEditOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [current, setCurrent] = useState<UserRow | null>(null)
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [form] = Form.useForm()
  const [roleForm] = Form.useForm()

  const fetchList = async (q = query) => {
    const [err, res] = await pageUser({ page: q.page, pageSize: q.pageSize, keyword: q.keyword || undefined })
    if (res) {
      setList(res.data.rows)
      setTotal(res.data.total)
    }
  }

  useEffect(() => { fetchList() }, [query])

  const openEdit = (record: UserRow) => {
    setCurrent(record)
    form.setFieldsValue({ name: record.name, email: record.email, password: undefined })
    setEditOpen(true)
  }

  const submitEdit = async () => {
    const values = await form.validateFields()
    if (!values.password) delete values.password // 留空不改密码
    const [err, res] = await updateUser(current!.id, values)
    if (res) {
      message.success('更新成功')
      setEditOpen(false)
      fetchList()
    }
  }

  const openAssign = async (record: UserRow) => {
    setCurrent(record)
    if (roles.length === 0) {
      const [err2, res2] = await listRoles()
      if (res2) setRoles(res2.data)
    }
    const [err, res] = await findById(record.id)
    if (res) {
      roleForm.setFieldsValue({ roleIds: res.data.roleIds })
    }
    setAssignOpen(true)
  }

  const submitAssign = async () => {
    const { roleIds } = await roleForm.validateFields()
    const [err, res] = await assignRoles(current!.id, roleIds)
    if (res) {
      message.success('分配成功')
      setAssignOpen(false)
    }
  }

  const handleDelete = async (record: UserRow) => {
    const [err, res] = await removeUser(record.id)
    if (res) {
      message.success('删除成功')
      fetchList()
    }
  }

  const columns: ColumnsType<UserRow> = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    { title: '用户名', dataIndex: 'name' },
    { title: '邮箱', dataIndex: 'email' },
    { title: '创建时间', dataIndex: 'createdAt' },
    {
      title: '操作',
      render: (_, record) => (
        <Space>
          <AuthButton permission="user:update">
            <Button size="small" onClick={() => openEdit(record)}>编辑</Button>
          </AuthButton>
          <AuthButton permission="user:assign_role">
            <Button size="small" onClick={() => openAssign(record)}>分配角色</Button>
          </AuthButton>
          <AuthButton permission="user:delete">
            <Popconfirm title="确定删除该用户？" onConfirm={() => handleDelete(record)}>
              <Button size="small" danger>删除</Button>
            </Popconfirm>
          </AuthButton>
        </Space>
      ),
    },
  ]

  return (
    <Layout.Content style={{ padding: '24px 32px' }}>
      <Space style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="搜索用户名/邮箱"
          allowClear
          onSearch={(keyword) => setQuery((q) => ({ ...q, keyword, page: 1 }))}
        />
      </Space>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={list}
        pagination={{
          current: query.page,
          pageSize: query.pageSize,
          total,
          showSizeChanger: true,
          onChange: (page, pageSize) => setQuery((q) => ({ ...q, page, pageSize })),
        }}
      />

      <Drawer
        title={`编辑用户 - ${current?.name ?? ''}`}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        extra={<Button type="primary" onClick={submitEdit}>提交</Button>}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email', message: '请输入正确邮箱' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="重置密码" extra="至少 8 位，含字母、数字和 -_；留空表示不修改">
            <Input.Password />
          </Form.Item>
        </Form>
      </Drawer>

      <Drawer
        title={`分配角色 - ${current?.name ?? ''}`}
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        extra={<Button type="primary" onClick={submitAssign}>提交</Button>}
      >
        <Form form={roleForm} layout="vertical">
          <Form.Item name="roleIds" label="角色（提交后全量替换）" rules={[{ required: true, message: '至少选择一个角色' }]}>
            <Select mode="multiple" optionLabelProp="label">
              {roles.map((r) => (
                <Select.Option key={r.id} value={r.id} label={r.name}>
                  {r.name}（{r.code}）
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Drawer>
    </Layout.Content>
  )
}
```

### D3. 新建 `interface/src/pages/admin/roles/index.tsx` — 角色管理（含权限树勾选）

```tsx
import { useEffect, useState } from 'react'
import { App, Button, Drawer, Form, Input, Layout, Popconfirm, Space, Table, Tag, Tree } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { list as listRoles, create as createRole, update as updateRole, remove as removeRole, getMenus, assignMenus } from '@/api/role'
import { tree as menuTree } from '@/api/menu'
import { AuthButton, usePermission } from '@/components/permission'

interface RoleRow { id: number; name: string; code: string; description: string; isSystem: number }
interface MenuNode { id: number; name: string; permission: string | null; type: string; children?: MenuNode[] }

// menu 树 → antd Tree treeData（标题上带权限码，勾选时更直观）
const toTreeData = (menus: MenuNode[]): any[] =>
  menus.map((m) => ({
    key: m.id,
    title: m.permission ? `${m.name}（${m.permission}）` : m.name,
    children: m.children?.length ? toTreeData(m.children) : undefined,
  }))

// 收集所有有子节点的 menu id（这些 id 由 Tree 依据子节点自动推导勾选/半选状态）
const collectParentIds = (menus: MenuNode[], set = new Set<number>()): Set<number> => {
  menus.forEach((m) => {
    if (m.children?.length) {
      set.add(m.id)
      collectParentIds(m.children, set)
    }
  })
  return set
}

// 页面级权限声明：AdminGuard 通过 useMatches 读取（见 B2）
export const handle = { permission: 'role:list' }

export default function Page() {
  const { message } = App.useApp()
  const { isSuperAdmin } = usePermission()
  const [list, setList] = useState<RoleRow[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [permOpen, setPermOpen] = useState(false)
  const [current, setCurrent] = useState<RoleRow | null>(null)
  const [menuData, setMenuData] = useState<MenuNode[]>([])
  const [checkedMenuIds, setCheckedMenuIds] = useState<number[]>([])
  const [halfCheckedMenuIds, setHalfCheckedMenuIds] = useState<number[]>([])
  const [form] = Form.useForm()

  const fetchList = async () => {
    const [err, res] = await listRoles()
    if (res) setList(res.data)
  }

  useEffect(() => { fetchList() }, [])

  const openCreate = () => {
    setCurrent(null)
    form.resetFields()
    setEditOpen(true)
  }

  const openEdit = (record: RoleRow) => {
    setCurrent(record)
    form.setFieldsValue({ name: record.name, description: record.description })
    setEditOpen(true)
  }

  const submitEdit = async () => {
    const values = await form.validateFields()
    const [err, res] = current ? await updateRole(current.id, values) : await createRole(values)
    if (res) {
      message.success('操作成功')
      setEditOpen(false)
      fetchList()
    }
  }

  const openPerm = async (record: RoleRow) => {
    setCurrent(record)
    const [err1, res1] = await menuTree()
    if (res1) setMenuData(res1.data)
    const [err2, res2] = await getMenus(record.id)
    if (res2) {
      // 后端返回含父节点 id；只把叶子/按钮喂给 Tree 作 checkedKeys，
      // 父节点的勾选/半选状态交给 Tree 依据子节点自动推导，避免 antd 级联把未勾选的兄弟节点带亮
      const parentIds = collectParentIds(res1?.data ?? [])
      setCheckedMenuIds((res2.data as number[]).filter((id) => !parentIds.has(id)))
    }
    setHalfCheckedMenuIds([])
    setPermOpen(true)
  }

  const submitPerm = async () => {
    // 提交全量 menuIds = 勾选节点 + 半选父节点（父节点也要入库，目录才能在菜单树中正确挂载）
    const menuIds = [...checkedMenuIds, ...halfCheckedMenuIds]
    const [err, res] = await assignMenus(current!.id, menuIds)
    if (res) {
      message.success('权限已更新')
      setPermOpen(false)
    }
  }

  const handleDelete = async (record: RoleRow) => {
    const [err, res] = await removeRole(record.id)
    if (res) {
      message.success('删除成功')
      fetchList()
    }
  }

  const columns: ColumnsType<RoleRow> = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    {
      title: '名称',
      dataIndex: 'name',
      render: (v, r) => (
        <Space>
          {v}
          {r.isSystem === 1 && <Tag color="blue">系统</Tag>}
        </Space>
      ),
    },
    { title: '标识', dataIndex: 'code' },
    { title: '描述', dataIndex: 'description' },
    {
      title: '操作',
      render: (_, record) => (
        <Space>
          <AuthButton permission="role:update">
            <Button size="small" disabled={record.isSystem === 1} onClick={() => openEdit(record)}>编辑</Button>
          </AuthButton>
          <AuthButton permission="role:assign_permission">
            {/* 系统角色仅 super_admin 可改（服务端强校验），非 super 点击会被 403 提示 */}
            <Button size="small" disabled={record.isSystem === 1 && !isSuperAdmin} onClick={() => openPerm(record)}>分配权限</Button>
          </AuthButton>
          <AuthButton permission="role:delete">
            <Popconfirm title="确定删除该角色？" onConfirm={() => handleDelete(record)}>
              <Button size="small" danger disabled={record.isSystem === 1}>删除</Button>
            </Popconfirm>
          </AuthButton>
        </Space>
      ),
    },
  ]

  return (
    <Layout.Content style={{ padding: '24px 32px' }}>
      <AuthButton permission="role:create">
        <Button type="primary" style={{ marginBottom: 16 }} onClick={openCreate}>新增角色</Button>
      </AuthButton>
      <Table rowKey="id" columns={columns} dataSource={list} pagination={false} />

      <Drawer
        title={current ? `编辑角色 - ${current.name}` : '新增角色'}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        extra={<Button type="primary" onClick={submitEdit}>提交</Button>}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          {!current && (
            <Form.Item
              name="code"
              label="标识"
              rules={[{ required: true, pattern: /^[a-z][a-z0-9_]{1,63}$/, message: '小写字母开头，仅小写字母/数字/下划线' }]}
              extra="创建后不可修改"
            >
              <Input />
            </Form.Item>
          )}
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} maxLength={255} />
          </Form.Item>
        </Form>
      </Drawer>

      <Drawer
        title={`分配权限 - ${current?.name ?? ''}`}
        open={permOpen}
        onClose={() => setPermOpen(false)}
        extra={<Button type="primary" onClick={submitPerm}>提交</Button>}
      >
        <Tree
          checkable
          defaultExpandAll
          selectable={false}
          treeData={toTreeData(menuData)}
          checkedKeys={checkedMenuIds}
          onCheck={(checked: any, info: any) => {
            setCheckedMenuIds(checked as number[])
            setHalfCheckedMenuIds((info.halfCheckedKeys as number[]) ?? [])
          }}
        />
      </Drawer>
    </Layout.Content>
  )
}
```

### D4. 新建 `interface/src/pages/admin/menus/index.tsx` — 菜单管理

```tsx
import { useEffect, useState } from 'react'
import { App, Button, Drawer, Form, Input, InputNumber, Layout, Popconfirm, Select, Space, Switch, Table, Tag, TreeSelect } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { tree as menuTree, create as createMenu, update as updateMenu, remove as removeMenu } from '@/api/menu'
import { AuthButton } from '@/components/permission'

interface MenuRow {
  id: number
  parentId: number | null
  name: string
  code: string
  permission: string | null
  path: string | null
  icon: string | null
  sortOrder: number
  type: 'directory' | 'menu' | 'button'
  visible: number
  children?: MenuRow[]
}

const TYPE_LABEL: Record<string, string> = { directory: '目录', menu: '菜单', button: '按钮' }

// 页面级权限声明：AdminGuard 通过 useMatches 读取（见 B2）
export const handle = { permission: 'menu:list' }

export default function Page() {
  const { message } = App.useApp()
  const [list, setList] = useState<MenuRow[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [current, setCurrent] = useState<MenuRow | null>(null)
  const [form] = Form.useForm()

  const fetchList = async () => {
    const [err, res] = await menuTree()
    if (res) setList(res.data)
  }

  useEffect(() => { fetchList() }, [])

  // 父节点选择数据：排除 button 与自身（防自引用）
  const toParentOptions = (menus: MenuRow[]): any[] =>
    menus
      .filter((m) => m.type !== 'button' && m.id !== current?.id)
      .map((m) => ({
        value: m.id,
        title: m.name,
        children: m.children?.length ? toParentOptions(m.children) : undefined,
      }))

  const openCreate = () => {
    setCurrent(null)
    form.resetFields()
    form.setFieldsValue({ type: 'menu', visible: true, sortOrder: 0 })
    setEditOpen(true)
  }

  const openEdit = (record: MenuRow) => {
    setCurrent(record)
    form.setFieldsValue({ ...record, parentId: record.parentId ?? undefined, visible: record.visible === 1 })
    setEditOpen(true)
  }

  const submit = async () => {
    const values = await form.validateFields()
    const payload = { ...values, visible: values.visible ? 1 : 0, parentId: values.parentId ?? null }
    const [err, res] = current ? await updateMenu(current.id, payload) : await createMenu(payload)
    if (res) {
      message.success('操作成功')
      setEditOpen(false)
      fetchList()
    }
  }

  const handleDelete = async (record: MenuRow) => {
    const [err, res] = await removeMenu(record.id)
    if (res) {
      message.success('删除成功')
      fetchList()
    }
  }

  const columns: ColumnsType<MenuRow> = [
    { title: '名称', dataIndex: 'name' },
    { title: '标识', dataIndex: 'code' },
    { title: '权限码', dataIndex: 'permission', render: (v) => v || '-' },
    { title: '路由', dataIndex: 'path', render: (v) => v || '-' },
    { title: '类型', dataIndex: 'type', width: 80, render: (v) => <Tag>{TYPE_LABEL[v] ?? v}</Tag> },
    { title: '排序', dataIndex: 'sortOrder', width: 70 },
    {
      title: '操作',
      width: 160,
      render: (_, record) => (
        <Space>
          <AuthButton permission="menu:update">
            <Button size="small" onClick={() => openEdit(record)}>编辑</Button>
          </AuthButton>
          <AuthButton permission="menu:delete">
            <Popconfirm title="确定删除该菜单？" onConfirm={() => handleDelete(record)}>
              {/* 有子菜单时后端会 400，前端直接禁用 */}
              <Button size="small" danger disabled={!!record.children?.length}>删除</Button>
            </Popconfirm>
          </AuthButton>
        </Space>
      ),
    },
  ]

  return (
    <Layout.Content style={{ padding: '24px 32px' }}>
      <AuthButton permission="menu:create">
        <Button type="primary" style={{ marginBottom: 16 }} onClick={openCreate}>新增菜单</Button>
      </AuthButton>
      <Table rowKey="id" columns={columns} dataSource={list} pagination={false} />

      <Drawer
        title={current ? `编辑菜单 - ${current.name}` : '新增菜单'}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        extra={<Button type="primary" onClick={submit}>提交</Button>}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="parentId" label="上级菜单">
            <TreeSelect treeData={toParentOptions(list)} allowClear treeDefaultExpandAll />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="code"
            label="标识"
            rules={[{ required: true, pattern: /^[a-z][a-z0-9_]{1,63}$/, message: '小写字母开头，仅小写字母/数字/下划线' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="permission"
            label="权限码"
            extra="如 user:create；目录类型留空"
            rules={[{ pattern: /^[a-z][a-z0-9_]*(?::[a-z][a-z0-9_]*)+$/, message: '冒号分隔，如 user:create' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="path" label="前端路由" extra="仅菜单类型需要，如 /admin/users">
            <Input />
          </Form.Item>
          <Form.Item name="icon" label="图标标识" extra="对应前端 ICON_MAP 的键名，可留空">
            <Input />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'directory', label: '目录' },
                { value: 'menu', label: '菜单' },
                { value: 'button', label: '按钮' },
              ]}
            />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序" extra="数值越小越靠前">
            <InputNumber min={0} />
          </Form.Item>
          <Form.Item name="visible" label="是否可见" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Drawer>
    </Layout.Content>
  )
}
```

**验证 D**：`cd interface && pnpm dev`，用 super_admin 登录 → 三个管理页均可用；新增一个自定义角色并只勾选「对话」菜单，把该角色分给测试账号 → 测试账号登录只见「对话」；admin 角色账号（通过用户管理把 admin 角色分给某账号）→ 可进管理页，但「分配权限」按钮置灰（非 super 不能改系统角色）。

---

## Phase E：后端安全加固

### E1. 模型配置归属：挂载时校验（唯一校验点）

**设计（已确认方案）**：chat 不接受请求体传入 modelId，固定读取工作区挂载的 `workspace.modelId`。归属关系成为服务端状态的传递闭包——`requireOwnership` 保证工作区属于当前用户，本步保证挂载进工作区的配置属于属主，chat 读 DB 零检查天然继承。非法输入在入口处就不存在，无需在 chat 链路上做任何校验。

**`server/endpoints/workspace.js`** 两处挂载入口都要校验：

```javascript
// ① 顶部 import 修改：
import ModelConfig from '../models/model-config.js'
import { BadRequest, NotFound, Forbidden } from '../utils/appError.js'

// ② POST /（创建即挂载，创建者即属主）：在 Workspace.create 之前插入
    // 挂载校验：配置必须属于创建者
    if (modelId) {
      const modelConfig = await ModelConfig.findById(modelId)
      if (!modelConfig) {
        throw NotFound('model config not found')
      }
      if (modelConfig.userId !== req.user.id) {
        throw Forbidden('model config does not belong to you')
      }
    }

// ③ PUT /:id：在 `const existing = await Workspace.findById(id)` 判空之后插入
    // modelId 挂载校验：配置必须属于工作区属主（唯一校验点，chat 只读工作区挂载的配置）
    // 校验对象是属主而非操作者，防止 super_admin 代管时把自己的配置挂进他人工作区
    if (modelId) {
      const modelConfig = await ModelConfig.findById(modelId)
      if (!modelConfig) {
        throw NotFound('model config not found')
      }
      if (modelConfig.userId !== existing.userId) {
        throw Forbidden('model config does not belong to the workspace owner')
      }
    }
```

### E2. chat 固定读取工作区挂载的模型

**`server/endpoints/chat.js`** POST /:workspaceId 的模型解析段整体替换：

```javascript
    // body 只收 content/stream/think，不接收 modelId
    const { content, stream = true, think = true } = req.body

    if (!content) {
      throw BadRequest('content is required')
    }
    if (!Validator.isNonEmptyString(content)) {
      throw BadRequest('content cannot be empty')
    }

    // 模型固定取工作区挂载的配置（requireOwnership 已确保工作区存在且属于当前用户，
    // 配置归属在挂载时已校验，见 E1），请求体传入的任何 modelId 一律忽略
    const workspace = await Workspace.findById(workspaceId)
    if (!workspace.modelId) {
      throw BadRequest('no model configured for this workspace, please set a model first')
    }

    const modelConfig = await ModelConfig.findById(workspace.modelId)
    if (!modelConfig) {
      throw NotFound('model config not found')
    }
```

**前端同步**（现有 UI 本就只使用工作区模型，无行为变化）：

```ts
// interface/src/api/chat/index.ts — chatToWorkspace 去掉 modelId 参数
export const chatToWorkspace = (workspaceId: string, content: string) => {
  return request({
    url: `/api/chat/${workspaceId}`,
    method: 'POST',
    data: {
      content,
      stream: false,
    },
  })
}
```

```tsx
// interface/src/pages/chat/index.tsx — 调用处删掉第三个参数
const [err, res] = await chatToWorkspace(workspace.id, content)
```

**历史脏数据清理**（E1 生效前挂上的他人配置，执行一次）：

```sql
UPDATE workspace w JOIN model_config mc ON w.model_id = mc.id
SET w.model_id = NULL WHERE mc.user_id <> w.user_id;
```

> 不引入 `assertModelConfigOwned` 之类的共享 helper：校验点只剩 workspace 一处，内联即可。

### E3. 严格提权防护（R1-R4）

**`server/middlewares/rbac.js`** 追加辅助函数：

```javascript
/**
 * 判断指定用户是否为 super_admin（高危操作的提权防护用）
 */
export const isSuperAdmin = async (userId) => {
  if (!userId) return false
  const roles = await Rbac.getUserRoles(userId)
  return roles.includes('super_admin')
}
```

**`server/endpoints/user.js`**：

```javascript
// ① 顶部 import 修改：
import { loadAuthContext, requirePermission, requireSelfOrPermission, isSuperAdmin } from '../middlewares/rbac.js'
import { AppError, BadRequest, NotFound, Conflict, Forbidden } from '../utils/appError.js'

// ② PUT /:id/roles 中，在 `for (const roleId of roleIds) {...}` 校验循环之后、
//    `await Rbac.assignRolesToUser(id, roleIds)` 之前插入（R1）：
    // R1: super_admin 角色只能由 super_admin 分配，防止 admin 自我提权
    const superAdminRole = await Role.findByCode('super_admin')
    if (superAdminRole && roleIds.includes(superAdminRole.id) && !(await isSuperAdmin(req.user.id))) {
      throw Forbidden('only super_admin can assign the super_admin role')
    }

// ③ DELETE /:id 中，在 `const data = await User.delete(id)` 之前插入（R4）：
    // R4: super_admin 用户仅 super_admin 可删
    const targetRoles = await Rbac.getUserRoles(id)
    if (targetRoles.includes('super_admin') && !(await isSuperAdmin(req.user.id))) {
      throw Forbidden('only super_admin can delete a super_admin user')
    }
```

**`server/endpoints/role.js`**：

```javascript
// ① 顶部 import 修改：
import { loadAuthContext, requirePermission, isSuperAdmin } from '../middlewares/rbac.js'
import { BadRequest, NotFound, Conflict, Forbidden } from '../utils/appError.js'

// ② PUT /:id/menus 中，在 `const existing = await Role.findById(id)` 判空之后、
//    `await Rbac.assignMenusToRole(id, menuIds)` 之前插入（R2 + R3）：
    // ===== 提权防护 =====
    const isSuper = await isSuperAdmin(req.user.id)

    // R2: 系统角色（super_admin/admin/member）的权限仅 super_admin 可改
    if (existing.isSystem && !isSuper) {
      throw Forbidden('only super_admin can modify a system role')
    }

    // R3: 非 super_admin 只能授予自己拥有的菜单/权限，防止向自定义角色自我提权
    if (!isSuper) {
      const ownMenuIds = await Rbac.getUserMenuIds(req.user.id)
      const illegal = menuIds.filter((menuId) => !ownMenuIds.includes(menuId))
      if (illegal.length > 0) {
        throw Forbidden('cannot grant permissions beyond your own')
      }
    }
```

> 说明：种子数据中 admin 角色已拥有 100-143 号全部管理菜单，因此 admin 仍可正常维护自定义角色，只是无法授予自身没有的权限（如 member 的 1/10-12/20-22 号业务菜单）。super_admin 走 `isSuper` 直通不受限。

**验证 E**（curl 或 REST Client，均带对应 token）：
1. admin 账号 `PUT /api/user/:id/roles` roleIds 含 super_admin 角色ID → `403`；
2. admin 账号 `PUT /api/role/<super_admin角色ID>/menus` → `403`；
3. admin 账号给自定义角色分配 menuId=1（chat，admin 自己没有）→ `403`；分配 menuId=11（用户管理）→ `200`；
4. admin 账号 `DELETE /api/user/<super_admin用户ID>` → `403`；
5. alice 把自己工作区的 modelId 挂成 bob 的配置 → `403`；`POST /api/chat/:workspaceId` 请求体夹带任何 modelId 均被忽略（未挂载模型的工作区返回 400）。

---

## Phase F：存量库迁移 SQL

> 新装环境直接跑 `init.sql` 即可，本节只针对**已存在的旧库**（有独立 `permission`/`role_permission` 表或旧 `menu` 表）。
> **注意**：会重建 menu 表并重放种子，手工自定义过的菜单会重置（当前阶段可接受）。

新建 `server/sql/migrations/20260903_rbac_menu_as_permission.sql`：

```sql
-- RBAC「menu 即权限」改造迁移（幂等，可重复执行）
-- 适用：从旧 schema（permission/role_permission 独立表 + 旧 menu 表）升级
-- 执行：mysql -u<user> -p < server/sql/migrations/20260903_rbac_menu_as_permission.sql

USE `aura`;

-- 1. 删除废弃的旧表
DROP TABLE IF EXISTS role_permission;
DROP TABLE IF EXISTS permission;

-- 2. 旧 menu 表结构（含 permission_id 外键）与新 schema 不兼容，直接重建
DROP TABLE IF EXISTS menu;
CREATE TABLE menu (
    id INT AUTO_INCREMENT PRIMARY KEY,
    parent_id INT DEFAULT NULL,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(100) NOT NULL UNIQUE,
    permission VARCHAR(100) DEFAULT NULL,
    path VARCHAR(255) DEFAULT NULL,
    icon VARCHAR(100) DEFAULT NULL,
    sort_order INT DEFAULT 0,
    type ENUM('directory', 'menu', 'button') DEFAULT 'menu',
    visible TINYINT(1) DEFAULT 1,
    status TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_parent_id (parent_id),
    INDEX idx_permission (permission)
);

-- 3. role_menu（新装库可能已建，IF NOT EXISTS 兜底）
CREATE TABLE IF NOT EXISTS role_menu (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role_id INT NOT NULL,
    menu_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_role_menu (role_id, menu_id),
    INDEX idx_role_id (role_id),
    INDEX idx_menu_id (menu_id)
);

-- 4. user_role 结构兜底（若报 Duplicate key name / Duplicate column 说明已存在，忽略即可）
-- ALTER TABLE user_role ADD UNIQUE KEY uk_user_role (user_id, role_id);
-- ALTER TABLE user_role ADD INDEX idx_user_id (user_id);
-- ALTER TABLE user_role ADD INDEX idx_role_id (role_id);

-- 5. 重放菜单种子（与 init.sql 完全一致，改菜单时两处同步）
INSERT IGNORE INTO menu (id, parent_id, name, code, permission, path, icon, sort_order, type, visible) VALUES
(1,  NULL, 'Chat',         'chat',         NULL, '/chat',                 'OpenAIFilled',  1, 'menu',      1),
(10, NULL, 'Note',         'note',         NULL, NULL,                    'BookOutlined',  2, 'directory', 1),
(11, 10,   'New Note',     'note_new',     NULL, '/note/edit',            NULL,            1, 'menu',      1),
(12, 10,   'My Notes',     'note_list',    NULL, '/note',                 NULL,            2, 'menu',      1),
(20, NULL, 'System',       'config',       NULL, NULL,                    'SettingFilled', 3, 'directory', 1),
(21, 20,   'Setting',      'setting',      NULL, '/setting',              NULL,            1, 'menu',      1),
(22, 20,   'Model Config', 'model_config', NULL, '/setting/model-config', NULL,            2, 'menu',      1),
(100, NULL, '系统管理', 'admin', NULL, NULL, NULL, 10, 'directory', 1),
(101, 100, '用户管理', 'user',       'user:list',              '/admin/users', NULL, 1, 'menu', 1),
(102, 101, '查看用户', 'user_read',       'user:read',              NULL, NULL, 1, 'button', 1),
(103, 101, '新增用户', 'user_create',     'user:create',            NULL, NULL, 2, 'button', 1),
(104, 101, '编辑用户', 'user_update',     'user:update',            NULL, NULL, 3, 'button', 1),
(105, 101, '删除用户', 'user_delete',     'user:delete',            NULL, NULL, 4, 'button', 1),
(106, 101, '分配角色', 'user_assign_role','user:assign_role',       NULL, NULL, 5, 'button', 1),
(120, 100, '角色管理', 'role',       'role:list',              '/admin/roles', NULL, 2, 'menu', 1),
(121, 120, '新增角色', 'role_create',     'role:create',            NULL, NULL, 1, 'button', 1),
(122, 120, '编辑角色', 'role_update',     'role:update',            NULL, NULL, 2, 'button', 1),
(123, 120, '删除角色', 'role_delete',     'role:delete',            NULL, NULL, 3, 'button', 1),
(124, 120, '分配权限', 'role_assign_perm','role:assign_permission', NULL, NULL, 4, 'button', 1),
(140, 100, '菜单管理', 'menu',       'menu:list',              '/admin/menus', NULL, 3, 'menu', 1),
(141, 140, '新增菜单', 'menu_create',     'menu:create',            NULL, NULL, 1, 'button', 1),
(142, 140, '编辑菜单', 'menu_update',     'menu:update',            NULL, NULL, 2, 'button', 1),
(143, 140, '删除菜单', 'menu_delete',     'menu:delete',            NULL, NULL, 3, 'button', 1);

-- 6. 重放角色-菜单关联
INSERT IGNORE INTO role_menu (role_id, menu_id)
SELECT r.id, m.id FROM role r, menu m WHERE r.code = 'member' AND m.id IN (1, 10, 11, 12, 20, 21, 22);
INSERT IGNORE INTO role_menu (role_id, menu_id)
SELECT r.id, m.id FROM role r, menu m WHERE r.code = 'admin' AND m.id IN (
  100, 101, 102, 103, 104, 105, 106, 120, 121, 122, 123, 124, 140, 141, 142, 143
);
INSERT IGNORE INTO role_menu (role_id, menu_id)
SELECT r.id, m.id FROM role r, menu m WHERE r.code = 'super_admin';

-- 7. 历史无角色用户回填 member
INSERT IGNORE INTO user_role (user_id, role_id)
SELECT u.id, r.id FROM user u, role r
WHERE r.code = 'member'
  AND u.id NOT IN (SELECT DISTINCT user_id FROM user_role);

-- 8. 首用户 super_admin 兜底
INSERT IGNORE INTO user_role (user_id, role_id)
SELECT 1, r.id FROM role r WHERE r.code = 'super_admin' AND EXISTS (SELECT 1 FROM user WHERE id = 1);
```

执行后验证：`SELECT COUNT(*) FROM menu;` 应为 23；用既有账号登录 `GET /api/user/profile` 应返回 `roles/permissions/menus`。

> `server/test/setup.js` 的清表顺序（`role_menu, user_role, menu, role, user`…）与迁移后表结构兼容，无需修改。

---

## Phase G：测试补齐

运行方式：`cd server && pnpm test`（vitest）。辅助函数已就绪：`registerAndLogin()` / `registerAndLoginAdmin()` / `assignRole(userId, roleCode)` / `authHeader(token)` / `getRequest()`（见 `server/test/helpers.js`）。

### G1. 新建 `server/test/note.test.js`

```javascript
import { beforeAll, describe, expect, it } from 'vitest'
import { getRequest, registerAndLogin, registerAndLoginAdmin, authHeader } from './helpers.js'

let request

beforeAll(async () => {
  request = await getRequest()
})

// Note.create 返回 insertId（数字），直接作为 id 使用
const createNote = async (token, title) => {
  const res = await request.post('/api/note').set(authHeader(token)).send({ title, content: 'hello' })
  expect(res.status).toBe(200)
  return res.body.data?.id ?? res.body.data
}

describe('GET /api/note/page', () => {
  it('未认证请求应返回 401', async () => {
    const res = await request.get('/api/note/page')
    expect(res.status).toBe(401)
  })

  it('列表只能看到自己的笔记', async () => {
    const alice = await registerAndLogin()
    await createNote(alice.token, 'alice private note')
    const bob = await registerAndLogin()
    const res = await request.get('/api/note/page').set(authHeader(bob.token))
    expect(res.status).toBe(200)
    expect(JSON.stringify(res.body.data)).not.toContain('alice private note')
  })
})

describe('笔记横向越权防护（requireOwnership）', () => {
  it('用户不能查看他人的笔记', async () => {
    const alice = await registerAndLogin()
    const noteId = await createNote(alice.token, 'alice note 1')
    const bob = await registerAndLogin()
    const res = await request.get(`/api/note/${noteId}`).set(authHeader(bob.token))
    expect(res.status).toBe(403)
  })

  it('用户不能修改他人的笔记', async () => {
    const alice = await registerAndLogin()
    const noteId = await createNote(alice.token, 'alice note 2')
    const bob = await registerAndLogin()
    const res = await request.put(`/api/note/${noteId}`).set(authHeader(bob.token)).send({ title: 'hacked' })
    expect(res.status).toBe(403)
  })

  it('用户不能删除他人的笔记', async () => {
    const alice = await registerAndLogin()
    const noteId = await createNote(alice.token, 'alice note 3')
    const bob = await registerAndLogin()
    const res = await request.delete(`/api/note/${noteId}`).set(authHeader(bob.token))
    expect(res.status).toBe(403)
  })

  it('super_admin 可以管理任何笔记', async () => {
    const alice = await registerAndLogin()
    const noteId = await createNote(alice.token, 'alice note 4')
    const root = await registerAndLoginAdmin()
    const res = await request.put(`/api/note/${noteId}`).set(authHeader(root.token)).send({ title: 'admin edited' })
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(200)
  })

  it('操作不存在的笔记应返回 404', async () => {
    const alice = await registerAndLogin()
    const res = await request.put('/api/note/999999').set(authHeader(alice.token)).send({ title: 'x' })
    expect(res.status).toBe(404)
  })
})
```

### G2. 新建 `server/test/model-config.test.js`

结构与 G1 相同，替换资源与创建参数：

```javascript
// 创建辅助（provider 必须是 VALID_PROVIDERS 之一）
const createModelConfig = async (token) => {
  const res = await request.post('/api/model-config').set(authHeader(token)).send({
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: 'sk-test',
    modelName: 'gpt-4o-mini',
  })
  expect(res.status).toBe(200)
  return res.body.data?.id ?? res.body.data
}

// 用例映射：
// GET  /api/model-config/:id  → 他人 403 / super_admin 200 / 不存在 404
// PUT  /api/model-config/:id  → 他人 403（body: { modelName: 'hacked' }）
// DEL  /api/model-config/:id  → 他人 403
// GET  /api/model-config/list → 列表不含他人配置（JSON.stringify not.toContain 'sk-test'）
```

（照抄 G1 的 describe/it 结构，把路由与断言对象替换掉即可。）

### G3. 新建 `server/test/chat.test.js` — chat 归属 + 模型挂载越权（依赖 Phase E1/E2）

```javascript
import { beforeAll, describe, expect, it } from 'vitest'
import { getRequest, registerAndLogin, authHeader } from './helpers.js'

let request

beforeAll(async () => {
  request = await getRequest()
})

const createWorkspace = async (token, title) => {
  const res = await request.post('/api/workspace').set(authHeader(token)).send({ title })
  expect(res.status).toBe(200)
  return res.body.data.id
}

const createModelConfig = async (token) => {
  const res = await request.post('/api/model-config').set(authHeader(token)).send({
    provider: 'openai',
    modelName: 'gpt-4o-mini',
  })
  expect(res.status).toBe(200)
  return res.body.data?.id ?? res.body.data
}

describe('对话横向越权防护', () => {
  it('不能向他人的工作区发消息', async () => {
    const alice = await registerAndLogin()
    const workspaceId = await createWorkspace(alice.token, 'alice ws')
    const bob = await registerAndLogin()
    const res = await request.post(`/api/chat/${workspaceId}`).set(authHeader(bob.token)).send({ content: 'hi' })
    expect(res.status).toBe(403)
  })

  it('不能把工作区的模型挂成他人的配置（E1）', async () => {
    const alice = await registerAndLogin()
    const workspaceId = await createWorkspace(alice.token, 'alice ws 2')
    const bob = await registerAndLogin()
    const modelId = await createModelConfig(bob.token)
    const res = await request.put(`/api/workspace/${workspaceId}`).set(authHeader(alice.token)).send({ modelId })
    expect(res.status).toBe(403)
  })

  it('chat 请求体里的 modelId 被忽略（E2）', async () => {
    const alice = await registerAndLogin()
    // 工作区未挂载任何模型
    const workspaceId = await createWorkspace(alice.token, 'alice ws 3')
    // 若 body.modelId 未被忽略，这里会尝试用该模型；被忽略则因工作区无模型返回 400
    const res = await request.post(`/api/chat/${workspaceId}`).set(authHeader(alice.token)).send({
      content: 'hi', modelId: 999999, stream: false,
    })
    expect(res.status).toBe(400)
  })
})
```

### G4. 新建 `server/test/escalation.test.js` — 提权防护（依赖 Phase E3）

```javascript
import { beforeAll, describe, expect, it } from 'vitest'
import db from '../sql/index.js'
import { getRequest, registerAndLogin, registerAndLoginAdmin, assignRole, authHeader } from './helpers.js'

let request

beforeAll(async () => {
  request = await getRequest()
})

const getRoleId = async (code) => {
  const [rows] = await db.query('SELECT id FROM role WHERE code = ?', [code])
  return rows[0].id
}

// 有 admin 角色但非 super_admin 的账号
const makeAdmin = async () => {
  const admin = await registerAndLogin()
  await assignRole(admin.id, 'admin')
  return admin
}

describe('提权防护（严格模式）', () => {
  it('R1: admin 不能给用户分配 super_admin 角色', async () => {
    const admin = await makeAdmin()
    const victim = await registerAndLogin()
    const roleId = await getRoleId('super_admin')
    const res = await request.put(`/api/user/${victim.id}/roles`).set(authHeader(admin.token)).send({ roleIds: [roleId] })
    expect(res.status).toBe(403)
  })

  it('R1 反例: admin 可以给用户分配 admin 角色', async () => {
    const admin = await makeAdmin()
    const victim = await registerAndLogin()
    const roleId = await getRoleId('admin')
    const res = await request.put(`/api/user/${victim.id}/roles`).set(authHeader(admin.token)).send({ roleIds: [roleId] })
    expect(res.status).toBe(200)
  })

  it('R2: admin 不能修改系统角色的权限', async () => {
    const admin = await makeAdmin()
    const roleId = await getRoleId('super_admin')
    const res = await request.put(`/api/role/${roleId}/menus`).set(authHeader(admin.token)).send({ menuIds: [] })
    expect(res.status).toBe(403)
  })

  it('R3: admin 不能授予自己没有的权限（未绑定任何角色的幽灵菜单）', async () => {
    // 不能用 seed 菜单做负例：测试用户经由 member 角色拥有 chat/note 等业务菜单
    const root = await registerAndLoginAdmin()
    const suffix = Date.now()
    const ghostRes = await request.post('/api/menu').set(authHeader(root.token)).send({
      name: '幽灵菜单', code: `ghost_r3_${suffix}`, permission: `ghost_r3_${suffix}:read`, type: 'menu', path: '/ghost',
    })
    expect(ghostRes.status).toBe(200)
    const ghostId = ghostRes.body.data.id

    const admin = await makeAdmin()
    const createRes = await request.post('/api/role').set(authHeader(admin.token)).send({ name: '自定义', code: `custom_r3_${suffix}`, description: '' })
    const customRoleId = createRes.body.data.id

    const res = await request.put(`/api/role/${customRoleId}/menus`).set(authHeader(admin.token)).send({ menuIds: [ghostId] })
    expect(res.status).toBe(403)
  })

  it('R3 反例: admin 可以授予自己拥有的权限（menu 100/101 = 系统管理/用户管理）', async () => {
    const admin = await makeAdmin()
    const createRes = await request.post('/api/role').set(authHeader(admin.token)).send({ name: '自定义2', code: 'custom_r3_ok', description: '' })
    const customRoleId = createRes.body.data.id
    const res = await request.put(`/api/role/${customRoleId}/menus`).set(authHeader(admin.token)).send({ menuIds: [100, 101] })
    expect(res.status).toBe(200)
  })

  it('R4: admin 不能删除 super_admin 用户', async () => {
    const admin = await makeAdmin()
    const root = await registerAndLoginAdmin()
    const res = await request.delete(`/api/user/${root.id}`).set(authHeader(admin.token))
    expect(res.status).toBe(403)
  })

  it('super_admin 不受限', async () => {
    const root = await registerAndLoginAdmin()
    const victim = await registerAndLogin()
    const roleId = await getRoleId('super_admin')
    const res = await request.put(`/api/user/${victim.id}/roles`).set(authHeader(root.token)).send({ roleIds: [roleId] })
    expect(res.status).toBe(200)
  })
})
```

### G5. 新建 `server/test/super-admin-profile.test.js` — profile 实体化（依赖 Phase B0）

```javascript
import { beforeAll, describe, expect, it } from 'vitest'
import { getRequest, registerAndLogin, registerAndLoginAdmin, authHeader } from './helpers.js'

let request

beforeAll(async () => {
  request = await getRequest()
})

// 创建一个不绑定任何角色的菜单（code 带唯一后缀，menu.code 全局唯一，避免二次跑套件冲突）
const createGhostMenu = async (token, code) => {
  const res = await request.post('/api/menu').set(authHeader(token)).send({
    name: '幽灵菜单', code, permission: `${code}:read`, type: 'menu', path: '/ghost',
  })
  expect(res.status).toBe(200)
  return res.body.data
}

describe('super_admin 权限/菜单实体化（getUserPermissions/getUserMenus）', () => {
  it('未绑定任何角色的新菜单，super_admin 的 profile 也能看到', async () => {
    const root = await registerAndLoginAdmin()
    const menu = await createGhostMenu(root.token, `ghost_menu_a_${Date.now()}`)
    const res = await request.get('/api/user/profile').set(authHeader(root.token))
    expect(res.status).toBe(200)
    expect(res.body.data.permissions).toContain(`${menu.code}:read`)
    expect(res.body.data.menus.some((m) => m.id === menu.id)).toBe(true)
  })

  it('member 不会获得未绑定菜单的权限', async () => {
    const root = await registerAndLoginAdmin()
    const menu = await createGhostMenu(root.token, `ghost_menu_b_${Date.now()}`)
    const member = await registerAndLogin()
    const res = await request.get('/api/user/profile').set(authHeader(member.token))
    expect(res.status).toBe(200)
    expect(res.body.data.permissions).not.toContain(`${menu.code}:read`)
  })
})
```

**验证 G**：`cd server && pnpm test` 全绿。若 G4 的 R3 用例失败，先确认该账号确实有 admin 角色（`assignRole` 生效）且 menu id 与种子一致；若 G5 失败，检查 B0 的两个查询是否已生效。

> G5 曾暴露一个服务端缺陷：`Menu.create` 不带默认值时，`visible`/`status` 的 `undefined` 会被 mysql2 写成显式 NULL、绕过列默认值 1，产生永远不可见的死菜单。已修复（`server/models/menu.js` create 补默认参数 `sortOrder = 0, type = 'menu', visible = 1, status = 1`），新建测试文件时如果从旧代码出发需要带上这个修复。

---

## Phase H：收尾

### H1. 旧设计文档标注废弃

在 `rbac_implementation_plan.md` 文件最顶部插入：

```markdown
> ⚠️ **已废弃**：本文档为早期 4 表（独立 permission 表）设计，已被 `rbac_redesign.md`（menu 即权限）取代。
> 当前实现请以 `rbac_redesign.md` 与 `rbac_completion_guide.md` 为准。仅保留作历史参考。
```

### H2. 手动验收清单（全绿才算完成）

| # | 场景 | 预期 |
|---|------|------|
| 1 | `admin@aura.com / Admin_123456` 登录 | 菜单：Chat / Note（New Note、My Notes）/ System（Setting、Model Config）/ 系统管理（用户、角色、菜单管理）；`/api/user/profile` 返回 roles=[super_admin] |
| 2 | 新注册账号登录 | 仅见 Chat / Note / System；无任何管理菜单 |
| 3 | member 手敲 `/admin/users` | 弹回 `/chat`（AdminGuard） |
| 4 | member 直调 `GET /api/user/list` | `403` |
| 5 | super_admin 在角色管理给自定义角色勾选菜单后，把角色分给用户 | 该用户重新登录后菜单即时生效（layout 会静默刷新 profile） |
| 6 | 登出 → 换账号登录 | 菜单/权限无上一个账号残留 |
| 7 | member A 手敲 B 的笔记/工作区 ID 编辑 | `403` |
| 8 | 用户把 modelId 填成他人配置 ID 发消息 | `403` |
| 9 | admin 给自己授 super_admin 角色（接口层） | `403` |
| 10 | 刷新页面 | 菜单与选中态正常，不闪空 |
| 11 | 菜单管理新建一个菜单且不给任何角色绑定 | super_admin 的侧边栏/profile 立即可见（B0 + G5 覆盖） |
| 12 | 新建管理页注册了路由但漏写 `handle` 声明 | AdminGuard fail-closed 拦截，弹回 /chat（开发期即可发现漏配） |

### H3. 提交拆分建议

```
fix(interface): rbac 前端基础修复——profile 回填/菜单渲染/登出/登录守卫      (Phase A)
feat(interface): 权限组件/路由守卫 + 管理后台用户/角色/菜单管理页面          (Phase B/C/D)
fix(server): super_admin 权限实体化、模型配置归属校验、严格提权防护、角色回显 (Phase B0/D0/E)
chore(sql): menu-as-permission 存量库迁移脚本                              (Phase F)
test(server): note/model-config/chat 归属、提权防护、profile 实体化用例      (Phase G)
docs: 旧 RBAC 计划标注废弃                                                (Phase H)
```

---

## 附：改动文件总览

| 文件 | 操作 | 所属阶段 |
|------|------|----------|
| `interface/src/store/index.ts` | 修改 | A1 |
| `interface/src/pages/login/index.tsx` | 修改 | A2 |
| `interface/src/pages/layout/index.tsx` | 重写 | A3 |
| `interface/src/components/permission/index.tsx` | 实现（现空文件） | B1 |
| `interface/src/guards/AdminGuard.tsx` | 新建 | B2 |
| `interface/src/api/user/index.ts` | 追加 | C1 |
| `interface/src/api/role/index.ts` | 新建 | C2 |
| `interface/src/api/menu/index.ts` | 新建 | C3 |
| `server/models/rbac.js` | 修改 2 查询 + 追加 2 方法 | B0 / D0 / E3 |
| `server/models/menu.js` | create 补默认参数（visible/status/sortOrder/type） | G5 |
| `server/endpoints/user.js` | 修改 | D0 / E3 |
| `interface/src/routes.tsx` | 修改 | D1 |
| `interface/src/pages/admin/users/index.tsx` | 新建 | D2 |
| `interface/src/pages/admin/roles/index.tsx` | 新建 | D3 |
| `interface/src/pages/admin/menus/index.tsx` | 新建 | D4 |
| `server/middlewares/rbac.js` | 追加 1 函数（isSuperAdmin） | E3 |
| `server/endpoints/chat.js` | 修改 | E1 |
| `server/endpoints/workspace.js` | 修改 | E2 |
| `server/endpoints/role.js` | 修改 | E3 |
| `server/sql/migrations/20260903_rbac_menu_as_permission.sql` | 新建 | F |
| `server/test/note.test.js` | 新建 | G1 |
| `server/test/model-config.test.js` | 新建 | G2 |
| `server/test/chat.test.js` | 新建 | G3 |
| `server/test/escalation.test.js` | 新建 | G4 |
| `server/test/super-admin-profile.test.js` | 新建 | G5 |
| `server/test/workspace.test.js` | 修改 modelId 用例 + 补挂载校验用例 | E1 |
| `rbac_implementation_plan.md` | 顶部加废弃标注 | H1 |
