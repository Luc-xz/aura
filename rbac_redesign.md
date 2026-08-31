# Aura RBAC 权限系统重构开发文档

## 1. 设计概述

### 1.1 核心理念：Menu 即 Permission

将独立的 `permission` 表合并进 `menu` 表。菜单项本身即是权限点：

| type 值 | 含义 | 是否有 permission 字段 | 是否有 path 字段 | 示例 |
|---------|------|----------------------|-----------------|------|
| `directory` | 纯目录分组 | 否 | 否 | "系统管理" |
| `menu` | 菜单页面 | 是（页面级权限） | 是（前端路由） | "用户管理"，permission=`user:list` |
| `button` | 按钮/操作 | 是（操作级权限） | 否 | "新增用户"，permission=`user:create` |

### 1.2 改造前后对比

**改造前（4 张 RBAC 表）：**
```
permission（独立表）  ←─ role_permission ──→  role  ←─ user_role ──→  user
menu.permission_id ──→ permission.id
```

**改造后（3 张 RBAC 表）：**
```
menu（含 permission 字段）  ←─ role_menu ──→  role  ←─ user_role ──→  user
```

- **删除**：独立的 `permission` 表、`role_permission` 关联表
- **新增**：`role_menu` 关联表（替代 `role_permission`）
- **修改**：`menu` 表去掉 `permission_id` 外键，新增 `permission` 字符串字段

### 1.3 鉴权路径

```
请求 → requirePermission('user:create')
     → 查 user_role → role_menu → menu
     → menu.permission = 'user:create' 是否在用户角色的 menu 覆盖范围内
     → 是 → 放行 / 否 → 403
```

```sql
-- 获取用户所有权限码
SELECT DISTINCT m.permission
FROM menu m
JOIN role_menu rm ON m.id = rm.menu_id
JOIN user_role ur ON rm.role_id = ur.role_id
WHERE ur.user_id = ?
  AND m.permission IS NOT NULL
  AND m.status = 1
```

```sql
-- 获取用户可见菜单树
SELECT m.*
FROM menu m
JOIN role_menu rm ON m.id = rm.menu_id
JOIN user_role ur ON rm.role_id = ur.role_id
WHERE ur.user_id = ?
  AND m.type IN ('directory', 'menu')
  AND m.visible = 1
  AND m.status = 1
ORDER BY m.sort_order
```

---

## 2. 数据库改造

### 2.1 新表结构

#### `menu` 表（合并后）

```sql
CREATE TABLE IF NOT EXISTS menu (
    id INT AUTO_INCREMENT PRIMARY KEY,
    parent_id INT DEFAULT NULL,
    name VARCHAR(100) NOT NULL,              -- 显示名称
    code VARCHAR(100) NOT NULL UNIQUE,       -- 唯一标识
    permission VARCHAR(100) DEFAULT NULL,    -- 权限标识（如 user:create），directory 类型为 NULL
    path VARCHAR(255) DEFAULT NULL,          -- 前端路由路径（仅 menu 类型）
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
```

**字段变化说明：**
| 字段 | 变化 | 说明 |
|------|------|------|
| `permission_id` | **删除** | 原来是外键指向独立 permission 表 |
| `permission` | **新增** | 字符串字段，直接存权限码如 `user:create` |

#### `role_menu` 表（新增，替代 `role_permission`）

```sql
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
```

#### 删除的表

```sql
DROP TABLE IF EXISTS role_permission;
DROP TABLE IF EXISTS permission;
```

#### `user_role` 表（补充索引）

```sql
ALTER TABLE user_role ADD UNIQUE KEY uk_user_role (user_id, role_id);
ALTER TABLE user_role ADD INDEX idx_user_id (user_id);
ALTER TABLE user_role ADD INDEX idx_role_id (role_id);
```

#### `role` 表（保持不变）

已有的 `role` 表结构无需改动。

### 2.2 完整 init.sql 改造

将 `server/sql/init.sql` 中的 RBAC 相关表替换为：

```sql
-- ===================== RBAC 表 =====================

CREATE TABLE IF NOT EXISTS role (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    code VARCHAR(64) NOT NULL UNIQUE,
    description VARCHAR(255) NULL,
    is_system TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name)
);

-- 系统内置角色
INSERT IGNORE INTO role (id, name, code, description, is_system) VALUES
(1, 'super_admin', 'super_admin', 'Super administrator', 1),
(2, 'admin', 'admin', 'Administrator', 1),
(3, 'member', 'member', 'Basic role', 1);

CREATE TABLE IF NOT EXISTS user_role (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    role_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_role (user_id, role_id),
    INDEX idx_user_id (user_id),
    INDEX idx_role_id (role_id)
);

CREATE TABLE IF NOT EXISTS menu (
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
```

### 2.3 种子数据

```sql
-- ===================== 种子数据 =====================

-- 1. 菜单/权限树
INSERT IGNORE INTO menu (id, parent_id, name, code, permission, path, icon, sort_order, type, visible) VALUES
-- 一级目录
(1,  NULL, '对话',     'chat',       NULL,           '/chat',  NULL, 1, 'menu', 1),
(2,  NULL, '笔记',     'note',       NULL,           '/note',  NULL, 2, 'menu', 1),
(3,  NULL, '设置',     'setting',    NULL,           '/setting', NULL, 3, 'menu', 1),

-- 系统管理（目录）
(10, NULL, '系统管理',  'system',     NULL,           NULL,     NULL, 10, 'directory', 1),

-- 用户管理（菜单页）
(11, 10,   '用户管理',  'user',       'user:list',    '/admin/users',  NULL, 1, 'menu', 1),
(12, 11,   '查看用户',  'user_read',       'user:read',         NULL, NULL, 1, 'button', 1),
(13, 11,   '新增用户',  'user_create',     'user:create',       NULL, NULL, 2, 'button', 1),
(14, 11,   '编辑用户',  'user_update',     'user:update',       NULL, NULL, 3, 'button', 1),
(15, 11,   '删除用户',  'user_delete',     'user:delete',       NULL, NULL, 4, 'button', 1),
(16, 11,   '分配角色',  'user_assign_role','user:assign_role',  NULL, NULL, 5, 'button', 1),

-- 角色管理（菜单页）
(20, 10,   '角色管理',  'role',       'role:list',    '/admin/roles',  NULL, 2, 'menu', 1),
(21, 20,   '新增角色',  'role_create',     'role:create',       NULL, NULL, 1, 'button', 1),
(22, 20,   '编辑角色',  'role_update',     'role:update',       NULL, NULL, 2, 'button', 1),
(23, 20,   '删除角色',  'role_delete',     'role:delete',       NULL, NULL, 3, 'button', 1),
(24, 20,   '分配权限',  'role_assign_perm','role:assign_permission', NULL, NULL, 4, 'button', 1),

-- 菜单/权限管理（菜单页）
(30, 10,   '菜单管理',  'menu',       'menu:list',    '/admin/menus',  NULL, 3, 'menu', 1),
(31, 30,   '新增菜单',  'menu_create',     'menu:create',       NULL, NULL, 1, 'button', 1),
(32, 30,   '编辑菜单',  'menu_update',     'menu:update',       NULL, NULL, 2, 'button', 1),
(33, 30,   '删除菜单',  'menu_delete',     'menu:delete',       NULL, NULL, 3, 'button', 1);

-- 2. 角色-菜单关联

-- member：基础菜单可见（对话、笔记、设置）
INSERT IGNORE INTO role_menu (role_id, menu_id)
SELECT r.id, m.id FROM role r, menu m
WHERE r.code = 'member' AND m.code IN ('chat', 'note', 'setting');

-- admin：系统管理目录 + 用户管理 + 角色管理 + 菜单管理（含所有 button）
INSERT IGNORE INTO role_menu (role_id, menu_id)
SELECT r.id, m.id FROM role r, menu m
WHERE r.code = 'admin' AND m.id IN (
  10, -- 系统管理目录
  11, 12, 13, 14, 15, 16,  -- 用户管理 + 按钮
  20, 21, 22, 23, 24,       -- 角色管理 + 按钮
  30, 31, 32, 33             -- 菜单管理 + 按钮
);

-- super_admin：拥有所有菜单（代码层面也做全局放行，这里兜底）
INSERT IGNORE INTO role_menu (role_id, menu_id)
SELECT r.id, m.id FROM role r, menu m
WHERE r.code = 'super_admin';

-- 3. 为历史无角色用户补齐 member 角色
INSERT IGNORE INTO user_role (user_id, role_id)
SELECT u.id, r.id FROM user u, role r
WHERE r.code = 'member'
AND u.id NOT IN (SELECT DISTINCT user_id FROM user_role);

-- 4. 首个用户升级为 super_admin
INSERT IGNORE INTO user_role (user_id, role_id)
SELECT 1, r.id FROM role r WHERE r.code = 'super_admin';
```

---

## 3. 后端 Model 层改造

### 3.1 `server/models/menu.js` — 修改

**改动要点：**
- `create` / `update` 方法的参数：去掉 `permissionId`，新增 `permission`
- `findAll` 过滤条件：去掉 `permissionId`，新增 `permission`
- 去掉 `create` / `update` 中对 `permission` 表的关联校验（不再有独立 permission 表）

```javascript
import db from '../sql/index.js'
import { formatResponse, toSnakeCase } from '../../shared/utils/formatter.js'

export default class Menu {
  static filterFields(menu) {
    return formatResponse(menu)
  }

  static async findAll(filters = {}) {
    let baseSql = 'SELECT * FROM menu WHERE 1=1'
    const params = []

    if (filters.createdAt) {
      baseSql += ' AND created_at BETWEEN ? AND ?'
      params.push(filters.createdAt[0], filters.createdAt[1])
    }

    if (filters.updatedAt) {
      baseSql += ' AND updated_at BETWEEN ? AND ?'
      params.push(filters.updatedAt[0], filters.updatedAt[1])
    }

    if (filters.name) {
      baseSql += ' AND name = ?'
      params.push(filters.name)
    }

    if (filters.code) {
      baseSql += ' AND code = ?'
      params.push(filters.code)
    }

    if (filters.permission) {
      baseSql += ' AND permission = ?'
      params.push(filters.permission)
    }

    if (filters.type) {
      baseSql += ' AND type = ?'
      params.push(filters.type)
    }

    if (filters.visible !== undefined) {
      baseSql += ' AND visible = ?'
      params.push(filters.visible)
    }

    if (filters.status !== undefined) {
      baseSql += ' AND status = ?'
      params.push(filters.status)
    }

    baseSql += ' ORDER BY sort_order ASC, id ASC'

    const [rows] = await db.query(baseSql, params)
    return rows.map(this.filterFields) || []
  }

  static async findByCode(code) {
    if (!code) {
      throw new Error('code is required')
    }
    const [rows] = await db.query('SELECT * FROM menu WHERE code = ?', [code])
    return rows[0] && this.filterFields(rows[0])
  }

  static async findById(id) {
    if (!id) {
      throw new Error('id is required')
    }
    const [rows] = await db.query('SELECT * FROM menu WHERE id = ?', [id])
    return rows[0] && this.filterFields(rows[0])
  }

  static async create({ parentId, name, code, permission, path, icon, sortOrder, type, visible, status } = {}) {
    if (parentId) {
      const [rows] = await db.query('SELECT * FROM menu WHERE id = ?', [parentId])
      if (!rows.length) {
        throw new Error('parent node not found')
      }
    }
    const baseSql = 'INSERT INTO menu (parent_id, name, code, permission, path, icon, sort_order, type, visible, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    const [result] = await db.query(baseSql, [parentId, name, code, permission, path, icon, sortOrder, type, visible, status])
    return result.insertId
  }

  static async update(id, payload = {}) {
    if (!id) {
      throw new Error('id is required')
    }
    if (payload.parentId) {
      const [rows] = await db.query('SELECT * FROM menu WHERE id = ?', [payload.parentId])
      if (!rows.length) {
        throw new Error('parent node not found')
      }
    }
    const baseSql = 'UPDATE menu SET '
    const clause = ' WHERE id = ?'
    let sql = ''
    let params = []
    const allowedFields = ['parentId', 'name', 'code', 'permission', 'path', 'icon', 'sortOrder', 'type', 'visible', 'status']
    for (const key in payload) {
      if (allowedFields.includes(key) && payload[key] !== undefined) {
        sql += `${toSnakeCase(key)} = ?, `
        params.push(payload[key])
      }
    }
    if (params.length < 1) {
      return true
    }
    sql = sql.slice(0, -2)
    const finalSql = baseSql + sql + clause
    params.push(id)
    const [result] = await db.query(finalSql, params)
    return result.affectedRows > 0
  }

  static async delete(id) {
    if (!id) {
      throw new Error('id is required')
    }
    const baseSql = 'DELETE FROM menu WHERE id = ?'
    const [result] = await db.query(baseSql, [id])
    return result.affectedRows > 0
  }
}
```

### 3.2 `server/models/rbac.js` — 新建

封装 RBAC 核心查询：用户角色/权限获取、角色分配、权限分配。

```javascript
import db from '../sql/index.js'

export default class Rbac {
  /**
   * 获取用户的所有角色 code
   */
  static async getUserRoles(userId) {
    const [rows] = await db.query(
      `SELECT r.code FROM role r
       JOIN user_role ur ON r.id = ur.role_id
       WHERE ur.user_id = ?`,
      [userId]
    )
    return rows.map(row => row.code)
  }

  /**
   * 获取用户的所有权限码（通过 role → menu.permission 链路）
   */
  static async getUserPermissions(userId) {
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
   * 获取用户可见的菜单树（flat list，前端自行 toTree）
   */
  static async getUserMenus(userId) {
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
    return rows
  }

  /**
   * 给用户分配角色（全量替换）
   */
  static async assignRolesToUser(userId, roleIds) {
    const connection = await db.getConnection()
    await connection.beginTransaction()
    try {
      await connection.query('DELETE FROM user_role WHERE user_id = ?', [userId])
      if (roleIds && roleIds.length > 0) {
        const values = roleIds.map(roleId => [userId, roleId])
        await connection.query('INSERT INTO user_role (user_id, role_id) VALUES ?', [values])
      }
      await connection.commit()
      return true
    } catch (err) {
      await connection.rollback()
      throw err
    } finally {
      connection.release()
    }
  }

  /**
   * 给角色分配菜单/权限（全量替换）
   */
  static async assignMenusToRole(roleId, menuIds) {
    const connection = await db.getConnection()
    await connection.beginTransaction()
    try {
      await connection.query('DELETE FROM role_menu WHERE role_id = ?', [roleId])
      if (menuIds && menuIds.length > 0) {
        const values = menuIds.map(menuId => [roleId, menuId])
        await connection.query('INSERT INTO role_menu (role_id, menu_id) VALUES ?', [values])
      }
      await connection.commit()
      return true
    } catch (err) {
      await connection.rollback()
      throw err
    } finally {
      connection.release()
    }
  }

  /**
   * 获取角色关联的所有菜单 ID
   */
  static async getRoleMenuIds(roleId) {
    const [rows] = await db.query(
      'SELECT menu_id FROM role_menu WHERE role_id = ?',
      [roleId]
    )
    return rows.map(row => row.menu_id)
  }

  /**
   * 删除角色时清理关联数据
   */
  static async cleanRoleRelations(roleId) {
    await db.query('DELETE FROM role_menu WHERE role_id = ?', [roleId])
    await db.query('DELETE FROM user_role WHERE role_id = ?', [roleId])
  }
}
```

### 3.3 `server/models/permission.js` — 删除

此文件内容清空（独立 permission 表已废弃），删除文件即可。

### 3.4 `server/models/role.js` — 小改

`delete` 方法中补充关联数据清理：

```javascript
static async delete(id) {
  if (!id) {
    throw new Error('id is required')
  }
  // 检查是否是系统角色
  const [roleRows] = await db.query('SELECT is_system FROM role WHERE id = ?', [id])
  if (!roleRows.length) {
    throw new Error('role not found')
  }
  if (roleRows[0].is_system === 1) {
    throw new Error('system role cannot be deleted')
  }
  // 清理关联
  const Rbac = (await import('./rbac.js')).default
  await Rbac.cleanRoleRelations(id)
  const [result] = await db.query('DELETE FROM role WHERE id = ?', [id])
  return result.affectedRows > 0
}
```

> **注意**：为避免循环引用，这里使用动态 `import()`。如果你偏好静态导入，可将 `cleanRoleRelations` 的 SQL 直接写在 `role.js` 里。

---

## 4. 后端 Endpoint 层改造

### 4.1 `server/endpoints/menu.js` — 修改

**改动要点：**
- 去掉所有 `permissionId` 参数，换成 `permission`
- 校验逻辑适配

```javascript
import express from 'express'
import Menu from '../models/menu.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { toTree } from '../../shared/utils/formatter.js'
import { authMiddleware } from '../middlewares/auth.js'
import Validator from '../../shared/utils/validator.js'
import { BadRequest, NotFound, Conflict } from '../utils/appError.js'

const VALID_MENU_TYPES = ['directory', 'menu', 'button']

const router = express.Router()

function menuEndpoints(apiRouter) {
  apiRouter.use('/menu', asyncHandler(authMiddleware), router)

  // 获取菜单平铺列表
  router.get('/list', asyncHandler(async (req, res) => {
    const data = await Menu.findAll({ ...req.query })
    res.status(200).json({ data, code: 200, message: 'success' })
  }))

  // 获取菜单树
  router.get('/tree', asyncHandler(async (req, res) => {
    const data = await Menu.findAll({ ...req.query })
    const tree = toTree(data)
    res.status(200).json({ data: tree, code: 200, message: 'success' })
  }))

  // 创建菜单/权限
  router.post('/', asyncHandler(async (req, res) => {
    const { parentId, name, code, permission, path, icon, sortOrder, type, visible, status } = req.body

    if (!name || !code) {
      throw BadRequest('name and code are required')
    }
    if (!Validator.isValidCode(code)) {
      throw BadRequest('code must be 2-64 characters, lowercase letters/digits/underscore, start with a letter')
    }
    if (!Validator.isLength(name, 1, 100)) {
      throw BadRequest('name must be 1-100 characters')
    }
    if (parentId && !Validator.isPositiveInt(parentId)) {
      throw BadRequest('parentId must be a positive integer')
    }
    if (type && !Validator.isOneOf(type, VALID_MENU_TYPES)) {
      throw BadRequest(`type must be one of: ${VALID_MENU_TYPES.join(', ')}`)
    }
    if (permission && !Validator.isValidCode(permission)) {
      throw BadRequest('permission must follow code format: 2-64 chars, lowercase letters/digits/colon/underscore')
    }

    const existing = await Menu.findByCode(code)
    if (existing) {
      throw Conflict('menu code already exists')
    }

    const id = await Menu.create({ parentId, name, code, permission, path, icon, sortOrder, type, visible, status })
    const data = await Menu.findById(id)
    res.status(200).json({ data, code: 200, message: 'success' })
  }))

  // 更新菜单/权限
  router.put('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params
    const { parentId, name, code, permission, path, icon, sortOrder, type, visible, status } = req.body

    const existing = await Menu.findById(id)
    if (!existing) {
      throw NotFound('menu not found')
    }

    if (code && !Validator.isValidCode(code)) {
      throw BadRequest('code must be 2-64 characters, lowercase letters/digits/underscore, start with a letter')
    }
    if (name !== undefined && !Validator.isLength(name, 1, 100)) {
      throw BadRequest('name must be 1-100 characters')
    }
    if (parentId && !Validator.isPositiveInt(parentId)) {
      throw BadRequest('parentId must be a positive integer')
    }
    if (type && !Validator.isOneOf(type, VALID_MENU_TYPES)) {
      throw BadRequest(`type must be one of: ${VALID_MENU_TYPES.join(', ')}`)
    }
    if (permission && !Validator.isValidCode(permission)) {
      throw BadRequest('permission must follow code format')
    }

    if (code && code !== existing.code) {
      const existingByCode = await Menu.findByCode(code)
      if (existingByCode) {
        throw Conflict('menu code already exists')
      }
    }

    await Menu.update(id, { parentId, name, code, permission, path, icon, sortOrder, type, visible, status })
    const data = await Menu.findById(id)
    res.status(200).json({ data, code: 200, message: 'success' })
  }))

  // 删除菜单/权限
  router.delete('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params

    const existing = await Menu.findById(id)
    if (!existing) {
      throw NotFound('menu not found')
    }

    // 检查子菜单
    const children = await Menu.findAll({ parentId: id })
    if (children.length) {
      throw BadRequest('menu has sub menu, cannot delete')
    }

    // 同时清理 role_menu 中的关联
    const Rbac = (await import('../models/rbac.js')).default
    // 注意：这里需要从 role_menu 中删除对当前 menu_id 的引用
    // 可以直接 SQL，也可以在 Rbac model 中加一个方法
    // 简单起见直接在 delete 后清理：
    const data = await Menu.delete(id)
    res.status(200).json({ data, code: 200, message: 'success' })
  }))
}

export default menuEndpoints
```

> **补充**：菜单删除时需同步清理 `role_menu` 表中的引用。建议在 `Rbac` model 中增加：
> ```javascript
> static async cleanMenuRelations(menuId) {
>   await db.query('DELETE FROM role_menu WHERE menu_id = ?', [menuId])
> }
> ```
> 然后在 `menu.js` 的 `delete` 方法中调用 `await Rbac.cleanMenuRelations(id)`。

### 4.2 `server/endpoints/role.js` — 扩展

**新增接口：**
- `PUT /role/:id/menus` — 给角色分配菜单/权限（全量替换）
- `GET /role/:id/menus` — 获取角色关联的菜单 ID 列表

```javascript
import express from 'express'
import Role from '../models/role.js'
import Rbac from '../models/rbac.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { authMiddleware } from '../middlewares/auth.js'
import Validator from '../../shared/utils/validator.js'
import { BadRequest, NotFound, Conflict } from '../utils/appError.js'

const router = express.Router()

function roleEndpoints(apiRouter) {
  apiRouter.use('/role', asyncHandler(authMiddleware), router)

  // ===== 现有接口保持不变 =====

  router.get('/list', asyncHandler(async (req, res) => {
    const { orderBy, orderDir, ...rest } = req.query
    const data = await Role.findAll({
      filters: rest,
      sort: { orderBy, orderDir }
    })
    res.status(200).json({ data, code: 200, message: 'success' })
  }))

  router.get('/page', asyncHandler(async (req, res) => {
    const { page, pageSize, orderBy, orderDir, ...rest } = req.query
    const data = await Role.findAll({
      filters: {
        ...rest,
        createdAt: rest?.createdAt?.split(',') || null,
        updatedAt: rest?.updatedAt?.split(',') || null,
      },
      pagination: { page: parseInt(page) || 1, pageSize: parseInt(pageSize) || 10 },
      sort: { orderBy, orderDir }
    })
    res.status(200).json({ data, code: 200, message: 'success' })
  }))

  router.get('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params
    const data = await Role.findById(id)
    if (!data) throw NotFound('role not found')
    res.status(200).json({ data, code: 200, message: 'success' })
  }))

  router.post('/', asyncHandler(async (req, res) => {
    const { name, code, description } = req.body
    if (!name || !code) throw BadRequest('name and code are required')
    if (!Validator.isValidCode(code)) throw BadRequest('invalid code format')
    if (!Validator.isLength(name, 2, 255)) throw BadRequest('name must be 2-255 characters')
    if (description && !Validator.isLength(description, 0, 255)) throw BadRequest('description too long')

    const existing = await Role.findByCode(code)
    if (existing) throw Conflict('role code already exists')

    const id = await Role.create({ name, code, description })
    const data = await Role.findById(id)
    res.status(200).json({ data, code: 200, message: 'success' })
  }))

  router.put('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params
    const { name, description } = req.body
    if (!name && description === undefined) throw BadRequest('at least one field required')
    if (name && !Validator.isLength(name, 2, 255)) throw BadRequest('name must be 2-255 characters')
    if (description && !Validator.isLength(description, 0, 255)) throw BadRequest('description too long')

    const existing = await Role.findById(id)
    if (!existing) throw NotFound('role not found')
    if (existing.isSystem) throw BadRequest('system role cannot be modified')

    await Role.update(id, { name, description })
    const data = await Role.findById(id)
    res.status(200).json({ data, code: 200, message: 'success' })
  }))

  router.delete('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params
    const existing = await Role.findById(id)
    if (!existing) throw NotFound('role not found')
    if (existing.isSystem) throw BadRequest('system role cannot be deleted')

    const data = await Role.delete(id)  // delete 内部会清理 role_menu + user_role
    res.status(200).json({ data, code: 200, message: 'success' })
  }))

  // ===== 新增：角色-菜单/权限关联 =====

  // 获取角色关联的菜单 ID 列表
  router.get('/:id/menus', asyncHandler(async (req, res) => {
    const { id } = req.params
    const existing = await Role.findById(id)
    if (!existing) throw NotFound('role not found')

    const data = await Rbac.getRoleMenuIds(id)
    res.status(200).json({ data, code: 200, message: 'success' })
  }))

  // 给角色分配菜单/权限（全量替换）
  router.put('/:id/menus', asyncHandler(async (req, res) => {
    const { id } = req.params
    const { menuIds } = req.body

    if (!Array.isArray(menuIds)) {
      throw BadRequest('menuIds must be an array')
    }

    const existing = await Role.findById(id)
    if (!existing) throw NotFound('role not found')

    await Rbac.assignMenusToRole(id, menuIds)
    res.status(200).json({ data: true, code: 200, message: 'success' })
  }))
}

export default roleEndpoints
```

### 4.3 `server/endpoints/user.js` — 扩展

**新增接口：**
- `GET /user/profile` — 获取当前用户的角色与权限
- `PUT /user/:id/roles` — 给用户分配角色

```javascript
// 在现有 userEndpoints 函数中追加：

import Rbac from '../models/rbac.js'
import { toTree } from '../../shared/utils/formatter.js'

// ... 现有代码 ...

// ===== 新增接口 =====

// 获取当前用户 Profile（含角色 + 权限 + 菜单树）
router.get('/profile', asyncHandler(authMiddleware), asyncHandler(async (req, res) => {
  const userId = req.user.id
  const user = await User.findById(userId)
  if (!user) throw NotFound('user not found')

  const roles = await Rbac.getUserRoles(userId)
  const permissions = await Rbac.getUserPermissions(userId)
  const menuList = await Rbac.getUserMenus(userId)
  const menuTree = toTree(menuList)

  res.status(200).json({
    data: {
      ...user,
      roles,
      permissions,
      menus: menuTree
    },
    code: 200,
    message: 'success'
  })
}))

// 给用户分配角色（全量替换）
router.put('/:id/roles', asyncHandler(authMiddleware), asyncHandler(async (req, res) => {
  const { id } = req.params
  const { roleIds } = req.body

  if (!Array.isArray(roleIds)) {
    throw BadRequest('roleIds must be an array')
  }

  const existing = await User.findById(id)
  if (!existing) throw NotFound('user not found')

  await Rbac.assignRolesToUser(id, roleIds)
  res.status(200).json({ data: true, code: 200, message: 'success' })
}))
```

---

## 5. 后端中间件改造

### 5.1 `server/middlewares/rbac.js` — 新建

包含两个中间件：
1. `loadAuthContext` — 加载当前用户的角色和权限到 `req.auth`
2. `requirePermission` — 校验用户是否拥有指定权限

```javascript
import Rbac from '../models/rbac.js'

/**
 * 加载当前用户的角色与权限上下文 → 挂载到 req.auth
 * 必须在 authMiddleware 之后使用
 */
export const loadAuthContext = async (req, res, next) => {
  const userId = req.user?.id
  if (!userId) {
    return res.status(401).json({ code: 401, message: 'Unauthorized' })
  }

  try {
    const roles = await Rbac.getUserRoles(userId)
    const permissions = await Rbac.getUserPermissions(userId)

    req.auth = { roles, permissions }
    next()
  } catch (err) {
    next(err)
  }
}

/**
 * 功能级权限拦截中间件
 * @param {string} permissionCode 权限码，如 'user:create'
 *
 * 使用方式：
 *   router.post('/', requirePermission('user:create'), handler)
 */
export const requirePermission = (permissionCode) => {
  return (req, res, next) => {
    const { roles = [], permissions = [] } = req.auth || {}

    // super_admin 全局放行
    if (roles.includes('super_admin')) {
      return next()
    }

    // 检查权限集
    if (permissions.includes(permissionCode)) {
      return next()
    }

    res.status(403).json({
      code: 403,
      message: `Forbidden: missing permission [${permissionCode}]`
    })
  }
}
```

### 5.2 `server/middlewares/permission.js` — 删除

此文件内容清空（如果原本是空文件则直接删除），权限校验统一使用 `rbac.js` 中的 `requirePermission`。

### 5.3 挂载方式

对于需要权限校验的路由组，在路由入口加 `loadAuthContext`，在具体路由上加 `requirePermission`：

```javascript
// 示例：user 管理接口
import { loadAuthContext, requirePermission } from '../middlewares/rbac.js'

function userEndpoints(apiRouter) {
  apiRouter.use('/user', asyncHandler(authMiddleware), asyncHandler(loadAuthContext), router)

  // 公共接口（不需要额外权限）
  router.get('/profile', asyncHandler(async (req, res) => { ... }))

  // 需要权限的接口
  router.get('/list', requirePermission('user:list'), asyncHandler(async (req, res) => { ... }))
  router.post('/', requirePermission('user:create'), asyncHandler(async (req, res) => { ... }))
  router.put('/:id', requirePermission('user:update'), asyncHandler(async (req, res) => { ... }))
  router.delete('/:id', requirePermission('user:delete'), asyncHandler(async (req, res) => { ... }))
  router.put('/:id/roles', requirePermission('user:assign_role'), asyncHandler(async (req, res) => { ... }))
}
```

---

## 6. 前端对接指南

### 6.1 登录后获取 Profile

登录成功后调用 `GET /api/user/profile`，获取 `roles`、`permissions`、`menus` 写入 Store：

```typescript
// Store 结构扩展
interface User {
  id: number
  name: string
  email: string
  token: string
  roles: string[]        // ['admin', 'member']
  permissions: string[]  // ['user:list', 'user:create', ...]
  menus: MenuItem[]      // 菜单树（后端已转好）
}
```

### 6.2 菜单渲染

直接使用 Profile 返回的 `menus` 树渲染侧边栏，无需前端再做权限过滤。

### 6.3 按钮级权限控制

```tsx
// 通用权限指令/组件
function AuthButton({ permission, children }) {
  const { user } = useUserStore()
  if (user.roles.includes('super_admin')) return children
  if (user.permissions.includes(permission)) return children
  return null
}

// 使用
<AuthButton permission="user:create">
  <Button>新增用户</Button>
</AuthButton>
```

### 6.4 路由守卫

```tsx
function PermissionGuard({ requiredPermission, children }) {
  const { user } = useUserStore()
  if (!user) return <Navigate to="/login" />
  if (user.roles.includes('super_admin')) return children
  if (user.permissions.includes(requiredPermission)) return children
  return <Navigate to="/chat" />
}
```

---

## 7. 实施步骤清单

按顺序执行，每步完成后可独立验证：

| 序号 | 任务 | 涉及文件 | 说明 |
|------|------|----------|------|
| 1 | 修改 `init.sql` | `server/sql/init.sql` | 删除 `permission` 和 `role_permission` 表定义，替换 `menu` 表结构，新增 `role_menu` 表，补充种子数据 |
| 2 | 删除旧文件 | `server/models/permission.js`、`server/middlewares/permission.js` | 这两个文件已废弃 |
| 3 | 修改 `server/models/menu.js` | `server/models/menu.js` | `permissionId` → `permission` 字段，去掉 permission 表关联校验 |
| 4 | 新建 `server/models/rbac.js` | `server/models/rbac.js` | RBAC 核心查询与操作 |
| 5 | 修改 `server/models/role.js` | `server/models/role.js` | delete 方法增加关联数据清理 |
| 6 | 修改 `server/endpoints/menu.js` | `server/endpoints/menu.js` | `permissionId` → `permission`，删除时清理 `role_menu` |
| 7 | 修改 `server/endpoints/role.js` | `server/endpoints/role.js` | 新增 `GET/PUT /:id/menus` 接口 |
| 8 | 修改 `server/endpoints/user.js` | `server/endpoints/user.js` | 新增 `GET /profile`、`PUT /:id/roles` |
| 9 | 新建 `server/middlewares/rbac.js` | `server/middlewares/rbac.js` | `loadAuthContext` + `requirePermission` |
| 10 | 修改 `server/app.js` | `server/app.js` | 无需新增路由注册（menu/role 已注册），确认无 permission 路由引用 |
| 11 | 数据库迁移 | 执行 SQL | 在开发库上执行表结构变更 + 种子数据 |

---

## 8. 接口汇总

### Menu 接口（已有，字段变更）

| 方法 | 路径 | 说明 | 请求体/参数变更 |
|------|------|------|----------------|
| GET | `/api/menu/list` | 菜单平铺列表 | 过滤参数 `permissionId` → `permission` |
| GET | `/api/menu/tree` | 菜单树 | 同上 |
| POST | `/api/menu` | 创建菜单/权限 | `permissionId` → `permission` |
| PUT | `/api/menu/:id` | 更新菜单/权限 | `permissionId` → `permission` |
| DELETE | `/api/menu/:id` | 删除菜单/权限 | 内部增加 `role_menu` 清理 |

### Role 接口（扩展）

| 方法 | 路径 | 说明 | 新增/已有 |
|------|------|------|----------|
| GET | `/api/role/list` | 角色列表 | 已有 |
| GET | `/api/role/page` | 角色分页 | 已有 |
| GET | `/api/role/:id` | 角色详情 | 已有 |
| POST | `/api/role` | 创建角色 | 已有 |
| PUT | `/api/role/:id` | 更新角色 | 已有 |
| DELETE | `/api/role/:id` | 删除角色 | 已有 |
| **GET** | **`/api/role/:id/menus`** | **获取角色关联的菜单 ID** | **新增** |
| **PUT** | **`/api/role/:id/menus`** | **分配角色的菜单/权限** | **新增** |

### User 接口（扩展）

| 方法 | 路径 | 说明 | 新增/已有 |
|------|------|------|----------|
| GET | `/api/user/list` | 用户列表 | 已有 |
| GET | `/api/user/page` | 用户分页 | 已有 |
| GET | `/api/user/:id` | 用户详情 | 已有 |
| POST | `/api/user/register` | 注册 | 已有 |
| POST | `/api/user/login` | 登录 | 已有 |
| PUT | `/api/user/:id` | 更新用户 | 已有 |
| DELETE | `/api/user/:id` | 删除用户 | 已有 |
| **GET** | **`/api/user/profile`** | **当前用户 Profile（含角色/权限/菜单）** | **新增** |
| **PUT** | **`/api/user/:id/roles`** | **分配用户角色** | **新增** |
