# Aura RBAC 角色权限系统改造详细执行计划

> ⚠️ **已废弃**：本文档为早期 4 表（独立 permission 表）设计，已被 `rbac_redesign.md`（menu 即权限）取代。
> 当前实现请以 `rbac_redesign.md` 与 `rbac_completion_guide.md` 为准。仅保留作历史参考。

本项目旨在解决 Aura 笔记系统中的横向越权问题与垂直权限缺失问题，通过引入统一的资源归属校验 (Owner Check) 和基于角色的访问控制 (RBAC) 来构建完备的安全边界。本文档为详细的改造步骤和可以直接使用的代码模板。

---

## 1. 核心设计原则

1. **安全第一**：先堵住资源横向越权漏洞（Phase 1），再实现全局 RBAC 系统（Phase 2-3）。
2. **双重防护 (Defense in Depth)**：
   - **功能权限校验 (RBAC Middleware)**：确定用户“是否有权调用此功能（如修改笔记）”。
   - **数据归属校验 (Owner Check Middleware)**：确定用户“是否有权修改这笔具体的数据（如 ID 为 5 的笔记是否属于当前用户）”。
3. **平滑升级**：保留数据库中现有的表结构，仅通过外键索引、约束补充及种子数据进行数据库演进；保持 HTTP 200 + 错误码的接口风格以减小前后端联调成本。

---

## 2. 详细执行步骤与代码模板

### Phase 1：堵住资源越权漏洞 (第 1 阶段)

#### 步骤 1.1：实现统一的资源归属校验中间件 `requireOwnership`
* **修改文件**：`server/middlewares/rbac.js` (新建/重写)
* **步骤意义**：将横向越权校验（Owner Check）统一收口。避免在每个具体的 Controller 里手动写 SQL 查询归属，防止遗漏。支持通过 `idFrom` 参数动态获取路由参数或查询参数中的资源 ID。
* **代码模板**：
```javascript
import db from '../sql/index.js'

/**
 * 校验资源归属的中间件
 * @param {string} resource 资源类型 ('note' | 'workspace' | 'model_config' | 'chat')
 * @param {string} idFrom 资源 ID 来源，如 'params.id' 或 'params.workspaceId'
 */
export const requireOwnership = ({ resource, idFrom = 'params.id' }) => {
  return async (req, res, next) => {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ code: 401, message: 'Unauthorized: No user session found' })
    }

    // 从 req 中动态提取资源 ID
    const pathParts = idFrom.split('.')
    let resourceId = req
    for (const part of pathParts) {
      resourceId = resourceId?.[part]
    }

    if (!resourceId) {
      return res.status(400).json({ code: 400, message: `Missing resource ID from ${idFrom}` })
    }

    let isOwner = false
    let sqlQuery = ''
    let queryParams = []

    switch (resource) {
      case 'note':
        sqlQuery = 'SELECT user_id FROM note WHERE id = ?'
        queryParams = [resourceId]
        break
      case 'workspace':
        sqlQuery = 'SELECT user_id FROM workspace WHERE id = ?'
        queryParams = [resourceId]
        break
      case 'model_config':
        sqlQuery = 'SELECT user_id FROM model_config WHERE id = ?'
        queryParams = [resourceId]
        break
      case 'chat':
        // Chat 没有 user_id 字段，它隶属于 Workspace。需要先查出所属 Workspace，然后判断该 Workspace 的 owner 是不是当前用户
        sqlQuery = `
          SELECT w.user_id 
          FROM chat c
          JOIN workspace w ON c.workspace_id = w.id
          WHERE c.id = ?
        `
        queryParams = [resourceId]
        break
      case 'chat_workspace':
        // 针对 POST /api/chat/:workspaceId 这样的接口，需要校验 workspaceId 是否属于该用户
        sqlQuery = 'SELECT user_id FROM workspace WHERE id = ?'
        queryParams = [resourceId]
        break
      default:
        return res.status(500).json({ code: 500, message: 'Unsupported resource check' })
    }

    try {
      const [rows] = await db.query(sqlQuery, queryParams)
      if (rows.length === 0) {
        return res.status(404).json({ code: 404, message: 'Resource not found' })
      }
      
      const ownerId = rows[0].user_id
      if (ownerId === userId) {
        isOwner = true
      }
    } catch (err) {
      return next(err)
    }

    // 如果当前用户是超级管理员，默认放行
    const userRoles = req.auth?.roles || []
    if (userRoles.includes('super_admin')) {
      isOwner = true
    }

    if (!isOwner) {
      return res.status(200).json({ code: 403, message: 'Forbidden: You do not own this resource' })
    }

    next()
  }
}
```

---

#### 步骤 1.2：改造笔记 (Note) 模块接口，挂载 Owner Check
* **修改文件**：`server/endpoints/note.js`
* **步骤意义**：杜绝对他人笔记的任意获取、更新或删除。
* **修改代码模板**：
```javascript
// server/endpoints/note.js
// ... existing imports ...
import { requireOwnership } from '../middlewares/rbac.js'

function noteEndpoints(apiRouter) {
  apiRouter.use('/note', asyncHandler(authMiddleware), router)

  // 1. 获取特定笔记详情
  router.get('/:id', 
    asyncHandler(requireOwnership({ resource: 'note', idFrom: 'params.id' })),
    asyncHandler(async (req, res) => {
      const { id } = req.params
      const data = await Note.findById(id)
      res.status(200).json({ data, code: 1, message: 'success' })
    })
  )

  // 2. 更新笔记
  router.put('/:id', 
    asyncHandler(requireOwnership({ resource: 'note', idFrom: 'params.id' })),
    asyncHandler(async (req, res) => {
      const { id } = req.params
      const { title, content, description } = req.body
      const data = await Note.update(id, { title, content, description })
      res.status(200).json({ data, code: 1, message: 'success' })
    })
  )

  // 3. 删除笔记
  router.delete('/:id', 
    asyncHandler(requireOwnership({ resource: 'note', idFrom: 'params.id' })),
    asyncHandler(async (req, res) => {
      const { id } = req.params
      const data = await Note.delete(id)
      res.status(200).json({ data, code: 1, message: 'success' })
    })
  )
  
  // ... 其他不需要 owner check 的接口（如 page, create 接口）保持原样
}
```

---

#### 步骤 1.3：改造工作区 (Workspace) 模块接口，挂载 Owner Check
* **修改文件**：`server/endpoints/workspace.js`
* **步骤意义**：防止普通用户随意修改或删除其他人的工作区。
* **修改代码模板**：
```javascript
// server/endpoints/workspace.js
// ... existing imports ...
import { requireOwnership } from '../middlewares/rbac.js'

function workspaceEndpoints(apiRouter) {
  apiRouter.use('/workspace', asyncHandler(authMiddleware), router)

  router.put('/:id', 
    asyncHandler(requireOwnership({ resource: 'workspace', idFrom: 'params.id' })),
    asyncHandler(async (req, res) => {
      const { id } = req.params
      const { title, modelId } = req.body
      const data = await Workspace.update(id, { title, modelId })
      res.status(200).json({ data, code: 1, message: 'success' })
    })
  )

  router.delete('/:id', 
    asyncHandler(requireOwnership({ resource: 'workspace', idFrom: 'params.id' })),
    asyncHandler(async (req, res) => {
      const { id } = req.params
      const data = await Workspace.delete(id)
      res.status(200).json({ data, code: 1, message: 'success' })
    })
  )
}
```

---

#### 步骤 1.4：改造模型配置 (Model Config) 模块接口，挂载 Owner Check
* **修改文件**：`server/endpoints/model-config.js`
* **步骤意义**：保护用户的大模型凭证（API Key）不被他人横向越权修改或查看。
* **修改代码模板**：
```javascript
// server/endpoints/model-config.js
// ... existing imports ...
import { requireOwnership } from '../middlewares/rbac.js'

function modelConfigEndpoints(apiRouter) {
  apiRouter.use('/model-config', asyncHandler(authMiddleware), router)

  router.get('/:id', 
    asyncHandler(requireOwnership({ resource: 'model_config', idFrom: 'params.id' })),
    asyncHandler(async (req, res) => {
      const { id } = req.params
      const data = await ModelConfig.findById(id)
      res.status(200).json({ data, code: 1, message: 'success' })
    })
  )

  router.put('/:id', 
    asyncHandler(requireOwnership({ resource: 'model_config', idFrom: 'params.id' })),
    asyncHandler(async (req, res) => {
      const { id } = req.params
      const { provider, baseUrl, apiKey, modelName, temperature, maxTokens, isActive } = req.body
      const data = await ModelConfig.update(id, { provider, baseUrl, apiKey, modelName, temperature, maxTokens, isActive })
      res.status(200).json({ data, code: 1, message: 'success' })
    })
  )

  router.delete('/:id', 
    asyncHandler(requireOwnership({ resource: 'model_config', idFrom: 'params.id' })),
    asyncHandler(async (req, res) => {
      const { id } = req.params
      const data = await ModelConfig.delete(id)
      res.status(200).json({ data, code: 1, message: 'success' })
    })
  )
}
```

---

#### 步骤 1.5：改造对话 (Chat) 模块接口，挂载 Workspace Owner Check
* **修改文件**：`server/endpoints/chat.js`
* **步骤意义**：聊天记录没有独立的 `user_id` 字段，它是关联在 `workspace` 下的。必须校验所属的 `workspaceId` 是否属于当前用户，防止用户通过拼接 URL 来横向访问其他用户的聊天记录或调用其绑定的模型消耗额度。
* **修改代码模板**：
```javascript
// server/endpoints/chat.js
// ... existing imports ...
import { requireOwnership } from '../middlewares/rbac.js'

function chatEndpoints(apiRouter) {
  apiRouter.use('/chat', asyncHandler(authMiddleware), router)

  // 1. 获取特定工作区的聊天列表
  router.get('/list/:workspaceId', 
    asyncHandler(requireOwnership({ resource: 'chat_workspace', idFrom: 'params.workspaceId' })),
    asyncHandler(async (req, res) => {
      const { page, pageSize, orderBy, orderDir, ...rest } = req.query
      const data = await Chat.findByWorkspaceId(req.params.workspaceId, {
        filters: { ...rest },
        sort: { orderBy, orderDir }
      })
      res.status(200).json({ data, code: 1, message: 'success' })
    })
  )

  // 2. 在特定工作区发送消息
  router.post('/:workspaceId', 
    asyncHandler(requireOwnership({ resource: 'chat_workspace', idFrom: 'params.workspaceId' })),
    asyncHandler(async (req, res) => {
      // ... 保持原有发送/流式对话逻辑不变
    })
  )
}
```

---

### Phase 2：数据库改造与种子数据 (第 2 阶段)

#### 步骤 2.1：创建 SQL Migration 升级脚本
* **新建文件**：`server/sql/migrations/20260513_rbac_upgrade.sql`
* **步骤意义**：
  1. 为 `user_role` 与 `role_permission` 增加联合唯一约束，避免关系重复插入。
  2. 建立必要的外键索引以提升查询效率（比如按 `user_id` 找角色，或按 `role_id` 找权限）。
* **SQL 脚本内容**：
```sql
-- 确保表存在的前提下进行升级
ALTER TABLE user_role ADD UNIQUE KEY uk_user_role (user_id, role_id);
ALTER TABLE user_role ADD INDEX idx_user_id (user_id);
ALTER TABLE user_role ADD INDEX idx_role_id (role_id);

ALTER TABLE role_permission ADD UNIQUE KEY uk_role_permission (role_id, permission_id);
ALTER TABLE role_permission ADD INDEX idx_role_id (role_id);
ALTER TABLE role_permission ADD INDEX idx_permission_id (permission_id);
```

---

#### 步骤 2.2：创建数据库种子数据 Seed 脚本
* **新建文件**：`server/sql/migrations/20260513_rbac_seed.sql`
* **步骤意义**：
  1. 预置三个核心角色：超级管理员 `super_admin`（代码直接放行）、管理员 `admin`（可进入后台管理用户）、普通成员 `member`（只允许操作自身资产）。
  2. 初始化功能权限集。
  3. 给旧数据中的现有用户默认补上 `member` 角色，防止他们升级后无法使用。
  4. 将 ID 为 1 的首个用户设为 `super_admin` 用于系统初始化。
* **SQL 脚本内容**：
```sql
-- 1. 插入初始角色
INSERT IGNORE INTO role (name, code, description, is_system) VALUES 
('超级管理员', 'super_admin', '系统内置超级管理员，拥有全局最高权限', 1),
('系统管理员', 'admin', '负责用户管理、角色指派等管理后台操作', 1),
('普通用户', 'member', '普通注册用户，享有笔记、对话、模型配置等基础功能', 1);

-- 2. 插入初始权限
INSERT IGNORE INTO permission (code, name) VALUES
-- 用户管理
('user:list', '查看用户列表'),
('user:read', '查看用户详情'),
('user:update', '修改用户信息'),
('user:delete', '删除用户'),
('user:assign_role', '指派用户角色'),
-- 角色管理
('role:list', '查看角色列表'),
('role:create', '创建新角色'),
('role:update', '更新角色信息'),
('role:delete', '删除角色'),
('role:assign_permission', '配置角色权限'),
-- 权限管理
('permission:list', '查看系统权限列表'),
-- 个人资产权限 (带有 own 后缀，需配合 Ownership 中间件)
('note:read_own', '查看个人笔记'),
('note:create', '创建新笔记'),
('note:update_own', '编辑个人笔记'),
('note:delete_own', '删除个人笔记'),
('workspace:read_own', '查看个人工作区'),
('workspace:create', '创建新工作区'),
('workspace:update_own', '修改个人工作区'),
('workspace:delete_own', '删除个人工作区'),
('model_config:read_own', '查看个人模型配置'),
('model_config:create', '创建新模型配置'),
('model_config:update_own', '修改个人模型配置'),
('model_config:delete_own', '删除个人模型配置'),
('chat:read_own', '查看个人聊天历史'),
('chat:create_own', '发起对话'),
-- 管理后台入口
('admin:dashboard', '访问管理后台');

-- 3. 关联角色和权限
-- 普通用户 (member) 的权限：只包含个人资产操作
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r, permission p
WHERE r.code = 'member' AND p.code IN (
  'note:read_own', 'note:create', 'note:update_own', 'note:delete_own',
  'workspace:read_own', 'workspace:create', 'workspace:update_own', 'workspace:delete_own',
  'model_config:read_own', 'model_config:create', 'model_config:update_own', 'model_config:delete_own',
  'chat:read_own', 'chat:create_own'
);

-- 管理员 (admin) 的权限：用户管理、角色管理以及后台访问
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r, permission p
WHERE r.code = 'admin' AND p.code IN (
  'admin:dashboard',
  'user:list', 'user:read', 'user:update', 'user:assign_role',
  'role:list', 'permission:list'
);

-- 超级管理员 (super_admin) 默认拥有所有权限
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r, permission p
WHERE r.code = 'super_admin';

-- 4. 补齐历史用户的默认角色（为所有目前没有分配角色的用户绑定 member 角色）
INSERT IGNORE INTO user_role (user_id, role_id)
SELECT u.id, r.id FROM user u, role r
WHERE r.code = 'member'
AND u.id NOT IN (SELECT DISTINCT user_id FROM user_role);

-- 5. 将 ID=1 的系统首个用户升级为超级管理员（用于第一账号初始化）
INSERT IGNORE INTO user_role (user_id, role_id)
SELECT 1, r.id FROM role r WHERE r.code = 'super_admin';
```

---

### Phase 3：后端 RBAC 核心能力 (第 3 阶段)

#### 步骤 3.1：新建角色、权限、RBAC 模型 (Models)
* **新建文件**：
  1. `server/models/role.js`
  2. `server/models/permission.js`
  3. `server/models/rbac.js`
* **步骤意义**：封装角色和权限的底层数据库交互，提供角色指派、权限查询、用户权限加载等基础方法。

* **Role Model (`server/models/role.js`)**:
```javascript
import db from '../sql/index.js'

export default class Role {
  static async findAll() {
    const [rows] = await db.query('SELECT * FROM role ORDER BY created_at DESC')
    return rows
  }

  static async findById(id) {
    const [rows] = await db.query('SELECT * FROM role WHERE id = ?', [id])
    return rows[0] || null
  }

  static async create({ name, code, description }) {
    const [result] = await db.query(
      'INSERT INTO role (name, code, description, is_system) VALUES (?, ?, ?, 0)',
      [name, code, description]
    )
    return result.insertId
  }

  static async update(id, { name, description }) {
    // 系统内置角色 code 不允许修改，仅允许修改展示名和描述
    const [result] = await db.query(
      'UPDATE role SET name = ?, description = ? WHERE id = ?',
      [name, description, id]
    )
    return result.affectedRows > 0
  }

  static async delete(id) {
    // 判断是否是系统角色
    const [roleRows] = await db.query('SELECT is_system FROM role WHERE id = ?', [id])
    if (roleRows[0]?.is_system === 1) {
      throw new Error('System built-in role cannot be deleted')
    }
    
    // 清除关联
    await db.query('DELETE FROM role_permission WHERE role_id = ?', [id])
    await db.query('DELETE FROM user_role WHERE role_id = ?', [id])
    const [result] = await db.query('DELETE FROM role WHERE id = ?', [id])
    return result.affectedRows > 0
  }
}
```

* **Permission Model (`server/models/permission.js`)**:
```javascript
import db from '../sql/index.js'

export default class Permission {
  static async findAll() {
    const [rows] = await db.query('SELECT * FROM permission ORDER BY code ASC')
    return rows
  }
}
```

* **RBAC Helper Model (`server/models/rbac.js`)**:
```javascript
import db from '../sql/index.js'

export default class RbacModel {
  // 获取指定用户的所有角色 Code
  static async getUserRoles(userId) {
    const [rows] = await db.query(
      `SELECT r.code FROM role r 
       JOIN user_role ur ON r.id = ur.role_id 
       WHERE ur.user_id = ?`,
      [userId]
    )
    return rows.map(row => row.code)
  }

  // 获取指定用户的所有权限 Code
  static async getUserPermissions(userId) {
    const [rows] = await db.query(
      `SELECT DISTINCT p.code FROM permission p
       JOIN role_permission rp ON p.id = rp.permission_id
       JOIN user_role ur ON rp.role_id = ur.role_id
       WHERE ur.user_id = ?`,
      [userId]
    )
    return rows.map(row => row.code)
  }

  // 给用户指派多个角色
  static async assignRolesToUser(userId, roleIds) {
    // 采用事务，先删除用户所有旧角色，再插入新角色
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

  // 配置角色所绑定的权限
  static async assignPermissionsToRole(roleId, permissionIds) {
    const connection = await db.getConnection()
    await connection.beginTransaction()
    try {
      await connection.query('DELETE FROM role_permission WHERE role_id = ?', [roleId])
      if (permissionIds && permissionIds.length > 0) {
        const values = permissionIds.map(pId => [roleId, pId])
        await connection.query('INSERT INTO role_permission (role_id, permission_id) VALUES ?', [values])
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

  // 获取特定角色所绑定的所有权限 ID
  static async getRolePermissions(roleId) {
    const [rows] = await db.query(
      'SELECT permission_id FROM role_permission WHERE role_id = ?',
      [roleId]
    )
    return rows.map(row => row.permission_id)
  }
}
```

---

#### 步骤 3.2：编写 RBAC 鉴权与上下文加载中间件
* **修改/追加文件**：`server/middlewares/rbac.js`
* **步骤意义**：
  1. `loadAuthContext` 中间件会利用上面的 `RbacModel`，从 `req.user.id` 中解析角色与权限列表，挂载到 `req.auth` 供后续拦截。
  2. `requirePermission` 中间件用于拦截具体接口，确认用户是否有指定权限。超级管理员 `super_admin` 将拥有默认通配通过特权，防止因配置错误导致系统被锁死。
* **代码模板**：
```javascript
// server/middlewares/rbac.js (在之前的基础上追加以下代码)
import RbacModel from '../models/rbac.js'

/**
 * 核心中间件：加载当前登录用户的角色和权限上下文
 */
export const loadAuthContext = async (req, res, next) => {
  const userId = req.user?.id
  if (!userId) {
    return res.status(401).json({ code: 401, message: 'Unauthorized: No user session found' })
  }

  try {
    const roles = await RbacModel.getUserRoles(userId)
    const permissions = await RbacModel.getUserPermissions(userId)

    req.auth = {
      roles,
      permissions
    }
    next()
  } catch (err) {
    next(err)
  }
}

/**
 * 功能级权限拦截中间件
 * @param {string} permissionCode 权限编码 (例如 'user:list')
 */
export const requirePermission = (permissionCode) => {
  return (req, res, next) => {
    const { roles = [], permissions = [] } = req.auth || {}

    // 1. 如果是系统内置的超级管理员，拥有全局放行特权
    if (roles.includes('super_admin')) {
      return next()
    }

    // 2. 检查权限集是否包含该权限编码
    if (permissions.includes(permissionCode)) {
      return next()
    }

    // 3. 校验失败，返回 403 结构以配合前端拦截
    res.status(200).json({
      code: 403,
      message: `Forbidden: Missing required permission [${permissionCode}]`
    })
  }
}
```

---

#### 步骤 3.3：全局启用 `loadAuthContext` 并重构 `server/endpoints/user.js`
* **修改文件**：`server/endpoints/user.js`
* **步骤意义**：
  1. 在 `user` 路由入口注入 `loadAuthContext` 确保权限上下文正确加载。
  2. 新增普通用户的自助端点 `GET /api/user/profile`，登录后可查询当前用户信息、拥有的角色、以及具体权限集。
  3. 将涉及全局用户管理的 `list`, `page`, 更新和删除接口改造成带有 `requirePermission` 权限拦截的管理端点，杜绝普通用户调用。
* **代码模板**：
```javascript
// server/endpoints/user.js
// ... existing imports ...
import { authMiddleware } from '../middlewares/auth.js'
import { loadAuthContext, requirePermission } from '../middlewares/rbac.js'
import RbacModel from '../models/rbac.js'

function userEndpoints(apiRouter) {
  // 注意：在入口除了 authMiddleware，还要挂载 loadAuthContext
  apiRouter.use('/user', asyncHandler(authMiddleware), asyncHandler(loadAuthContext), router)

  // ==================== 1. 自助接口 (普通用户可访问) ====================

  // 获取当前登录用户完整 Profile (包括角色与权限)
  router.get('/profile', asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id)
    if (!user) {
      throw new Error('User not found')
    }
    res.status(200).json({
      code: 1,
      message: 'success',
      data: {
        ...user,
        roles: req.auth.roles,
        permissions: req.auth.permissions
      }
    })
  }))

  // ==================== 2. 管理接口 (需要特定管理权限) ====================

  router.get('/list', 
    requirePermission('user:list'),
    asyncHandler(async (req, res) => {
      // 原有逻辑保持不变 ...
    })
  )

  router.get('/page', 
    requirePermission('user:list'),
    asyncHandler(async (req, res) => {
      // 原有逻辑保持不变 ...
    })
  )

  router.put('/:id', 
    requirePermission('user:update'),
    asyncHandler(async (req, res) => {
      // 原有逻辑保持不变 ...
    })
  )

  router.delete('/:id', 
    requirePermission('user:delete'),
    asyncHandler(async (req, res) => {
      // 原有逻辑保持不变 ...
    })
  )

  // 指派用户角色 (新增接口)
  router.put('/:id/roles',
    requirePermission('user:assign_role'),
    asyncHandler(async (req, res) => {
      const { id } = req.params
      const { roleIds } = req.body // Array of role IDs
      if (!Array.isArray(roleIds)) {
        throw new Error('roleIds must be an array')
      }
      await RbacModel.assignRolesToUser(id, roleIds)
      res.status(200).json({ code: 1, message: 'success', data: true })
    })
  )
}
```

---

#### 步骤 3.4：新建角色管理端点 `server/endpoints/role.js`
* **新建文件**：`server/endpoints/role.js`
* **步骤意义**：提供给管理后台使用，负责角色本身的增删改查以及为角色指派功能权限。
* **代码模板**：
```javascript
import express from 'express'
import Role from '../models/role.js'
import RbacModel from '../models/rbac.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { authMiddleware } from '../middlewares/auth.js'
import { loadAuthContext, requirePermission } from '../middlewares/rbac.js'

const router = express.Router()

function roleEndpoints(apiRouter) {
  apiRouter.use('/role', asyncHandler(authMiddleware), asyncHandler(loadAuthContext), router)

  // 获取所有角色
  router.get('/list', requirePermission('role:list'), asyncHandler(async (req, res) => {
    const data = await Role.findAll()
    res.status(200).json({ code: 1, message: 'success', data })
  }))

  // 新建角色
  router.post('/', requirePermission('role:create'), asyncHandler(async (req, res) => {
    const { name, code, description } = req.body
    if (!name || !code) {
      throw new Error('name and code are required')
    }
    const data = await Role.create({ name, code, description })
    res.status(200).json({ code: 1, message: 'success', data })
  }))

  // 更新角色描述与名称
  router.put('/:id', requirePermission('role:update'), asyncHandler(async (req, res) => {
    const { id } = req.params
    const { name, description } = req.body
    const data = await Role.update(id, { name, description })
    res.status(200).json({ code: 1, message: 'success', data })
  }))

  // 删除角色
  router.delete('/:id', requirePermission('role:delete'), asyncHandler(async (req, res) => {
    const { id } = req.params
    const data = await Role.delete(id)
    res.status(200).json({ code: 1, message: 'success', data })
  }))

  // 查看指定角色所绑定的所有权限 ID
  router.get('/:id/permissions', requirePermission('role:list'), asyncHandler(async (req, res) => {
    const { id } = req.params
    const data = await RbacModel.getRolePermissions(id)
    res.status(200).json({ code: 1, message: 'success', data })
  }))

  // 修改角色的权限绑定关系
  router.put('/:id/permissions', requirePermission('role:assign_permission'), asyncHandler(async (req, res) => {
    const { id } = req.params
    const { permissionIds } = req.body // Array of permission IDs
    if (!Array.isArray(permissionIds)) {
      throw new Error('permissionIds must be an array')
    }
    await RbacModel.assignPermissionsToRole(id, permissionIds)
    res.status(200).json({ code: 1, message: 'success', data: true })
  }))
}

export default roleEndpoints
```

---

#### 步骤 3.5：新建系统权限列表端点 `server/endpoints/permission.js`
* **新建文件**：`server/endpoints/permission.js`
* **步骤意义**：管理后台为角色配置权限时，需要获取系统中定义的完整权限列表进行多选展示。
* **代码模板**：
```javascript
import express from 'express'
import Permission from '../models/permission.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { authMiddleware } from '../middlewares/auth.js'
import { loadAuthContext, requirePermission } from '../middlewares/rbac.js'

const router = express.Router()

function permissionEndpoints(apiRouter) {
  apiRouter.use('/permission', asyncHandler(authMiddleware), asyncHandler(loadAuthContext), router)

  router.get('/list', requirePermission('permission:list'), asyncHandler(async (req, res) => {
    const data = await Permission.findAll()
    res.status(200).json({ code: 1, message: 'success', data })
  }))
}

export default permissionEndpoints
```

---

#### 步骤 3.6：在 `server/app.js` 注册新路由
* **修改文件**：`server/app.js`
* **步骤意义**：确保新编写的 `role` 和 `permission` 接口暴露在 Express 中。
* **修改代码模板**：
```javascript
// server/app.js
// ... existing imports ...
import roleEndpoints from './endpoints/role.js'
import permissionEndpoints from './endpoints/permission.js'

// ...
userEndpoints(apiRouter)
roleEndpoints(apiRouter)          // <--- 新增挂载
permissionEndpoints(apiRouter)    // <--- 新增挂载
workspaceEndpoints(apiRouter)
// ...
```

---

### Phase 4：前端权限感知 (第 4 阶段)

#### 步骤 4.1：拓展前端 zustand 用户 Store，加入角色与权限集合
* **修改文件**：`interface/src/store/index.ts`
* **步骤意义**：允许前端存储并快速判断当前用户是否是管理员，以及是否具备某个菜单的渲染权限。
* **代码模板**：
```typescript
// interface/src/store/index.ts
// ... existing interface ...
interface User {
  id: number
  name: string
  email: string
  token: string
  roles: string[]           // <--- 新增角色
  permissions: string[]     // <--- 新增权限列表
}
// ... 后续逻辑保持不变
```

---

#### 步骤 4.2：在登录成功后拉取完整 Profile，注入 Store
* **修改页面**：`interface/src/pages/login/index.tsx` (或者处理登录的回调逻辑中)
* **步骤意义**：普通的 `/login` 接口为了安全只返回基本的 token 等，前端通过调用统一自助接口 `/api/user/profile`，把完整的角色权限写入本地 Store。
* **修改伪代码逻辑**：
```javascript
// 在登录逻辑触发点（如提交表单）：
const loginRes = await api.post('/api/user/login', { email, password });
if (loginRes.code === 1) {
  const token = loginRes.data.token;
  // 保存 token 之后，立即请求 profile 补全角色和权限
  const profileRes = await api.get('/api/user/profile', {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (profileRes.code === 1) {
    // 写入 zustand store，此时 user 结构里带有 roles 和 permissions
    useUserStore.getState().setUser({
      id: profileRes.data.id,
      name: profileRes.data.name,
      email: profileRes.data.email,
      token: token,
      roles: profileRes.data.roles || [],
      permissions: profileRes.data.permissions || []
    });
    navigate('/chat');
  }
}
```

---

#### 步骤 4.3：对前端导航菜单进行过滤渲染
* **修改文件**：`interface/src/pages/layout/index.tsx`
* **步骤意义**：根据用户 Store 中的权限字段判断是否展示管理员相关的导航入口。
* **代码模板**：
```typescript
// interface/src/pages/layout/index.tsx
import { useUserStore } from '../../store/index'

// 1. 在静态 items 数组里增加对应的 permission 属性（用于过滤）
const items = [
  { key: '1', icon: <OpenAIFilled />, label: 'Chat', path: '/chat' },
  {
    key: '2',
    icon: <BookOutlined />,
    label: 'Note',
    children: [
      { key: '2-1', label: 'New Note', path: '/note/edit' },
      { key: '2-2', label: 'My Notes', path: '/note' },
    ],
  },
  {
    key: '3',
    label: 'System',
    icon: <SettingFilled />,
    children: [
      { key: '3-1', label: 'Setting', path: '/setting' },
      { key: '3-2', label: 'Model Config', path: '/setting/model-config' },
    ],
  },
  // 下方新增管理员后台模块入口
  {
    key: '4',
    label: 'Admin Control',
    icon: <SettingFilled />,
    permission: 'admin:dashboard', // 拦截权限
    children: [
      { key: '4-1', label: 'User Manage', path: '/admin/users' },
      { key: '4-2', label: 'Role Manage', path: '/admin/roles' }
    ]
  }
]

// 2. 在 MyLayout 组件内部过滤菜单项
export default function MyLayout() {
  const { user } = useUserStore()
  const userPermissions = user?.permissions || []
  const userRoles = user?.roles || []

  // 递归过滤没有权限展示的菜单项
  const filterMenuItems = (menuList) => {
    return menuList.filter(item => {
      // 如果是超级管理员，默认全部可见
      if (userRoles.includes('super_admin')) return true

      // 存在权限字段校验
      if (item.permission && !userPermissions.includes(item.permission)) {
        return false
      }
      
      // 处理子集
      if (item.children) {
        item.children = filterMenuItems(item.children)
        return item.children.length > 0
      }
      return true
    })
  }

  const filteredItems = filterMenuItems(JSON.parse(JSON.stringify(items)))
  
  // 随后将 Menu 的 items={items} 改为 items={filteredItems}
  // ...
}
```

---

#### 步骤 4.4：实现前端 React 权限路由守卫 (AuthGuard)
* **新建文件**：`interface/src/guards/PermissionGuard.tsx`
* **步骤意义**：仅隐藏菜单还不够，必须阻止普通用户在浏览器地址栏手动键入 `/admin/users` 越权进入敏感管理页面。
* **代码模板**：
```tsx
import React from 'react'
import { Navigate, Outlet } from 'react-router'
import { useUserStore } from '../store/index'

interface PermissionGuardProps {
  requiredPermission: string
}

export default function PermissionGuard({ requiredPermission }: PermissionGuardProps) {
  const { user } = useUserStore()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const isSuperAdmin = user.roles.includes('super_admin')
  const hasPermission = user.permissions.includes(requiredPermission)

  if (!isSuperAdmin && !hasPermission) {
    // 拦截并重定向到主页
    return <Navigate to="/chat" replace />
  }

  return <Outlet />
}
```
* **路由配置修改**：在 `interface/src/routes.tsx` 中将管理路由包裹在守卫中：
```typescript
import PermissionGuard from './guards/PermissionGuard'

// routes.tsx
// ...
layout('./pages/layout/index.tsx', [
  route('chat', './pages/chat/index.tsx'),
  // ...
  // 管理后台路由 (由 PermissionGuard 包裹)
  layout('./guards/PermissionGuardLayout.tsx', [
     route('admin/users', './pages/admin/users/index.tsx'),
     route('admin/roles', './pages/admin/roles/index.tsx')
  ])
])
```

---

## 3. 验证与测试步骤

### 3.1 漏洞闭狂测试（可使用 REST Client 或 `curl` 测试）
1. **横向越权测试**：
   - 登录普通用户 A（获取 Token A）和普通用户 B（获取 Token B）。
   - 用户 B 拥有一张 ID 为 `5` 的笔记。
   - 用户 A 发起 HTTP 请求 `GET /api/note/5`，Header 带上 Token A。
   - **预期表现**：后端拦截并返回 `403 Forbidden` 或资源未找到（不能像修改前一样越权返回笔记 5 详情）。
2. **垂直越权测试**：
   - 用户 A 带有普通 Token A，调用 `GET /api/user/list`。
   - **预期表现**：接口返回 `code: 403`，拦截提示无权限。

### 3.2 联调测试
1. **超级管理员提权验证**：
   - 在数据库中将当前用户绑定角色 `super_admin`。
   - 登录系统，验证前端菜单正常渲染出“系统管理”及“角色配置”，各管理 API 正常交互。
2. **页面强行跳转拦截**：
   - 登录普通 `member` 账户，并在地址栏直接敲入 `http://localhost:xxxx/admin/users`。
   - **预期表现**：路由被 `PermissionGuard` 拦截，并重定向至 `/chat`。
