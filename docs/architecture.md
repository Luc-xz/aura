# 系统架构

这是系统当前的构成方式，不是规划。改动跨模块契约、启动顺序或扩展点时，同一变更内更新本页。

## 组合方式

系统由两个独立进程组成，通过 `/api` 下的 HTTP 接口通信，没有共享代码的运行时依赖。

**后端启动**（`server/index.js` → `server/app.js`）：`env.js` 先按 `NODE_ENV` 加载环境变量（生产 `.env.production`，开发 `.env.local` 覆盖 `.env.development`，最后 `.env` 兜底），然后 `app.js` 依次挂载 `body-parser` → 日志中间件 → `/api` 路由 → 404 兜底 → 错误处理器 → `listen(3000)`。

路由按功能聚合在 `server/endpoints/`，每个文件导出一个 `xxxEndpoints(apiRouter)` 函数，在 `app.js` 中按固定顺序注册。数据库连接是 `server/sql/index.js` 里的单例连接池，库名在进程启动时决定：`NODE_ENV=test` 固定用 `aura_test`，否则取 `DB_NAME` 或 `aura`。

**前端**（`interface/`，React Router 7，`ssr: false`）：`routes.tsx` 声明式定义路由树，`pages/index.tsx` 仅做 `/` → `/workspace` 重定向。Vite dev server 把 `VITE_APP_BASE_API`（`/dev-api`）代理到 `localhost:3000` 并剥掉前缀。

## 核心模块

### 后端 `server/`

| 模块 | 职责 |
|---|---|
| `endpoints/` | 每个文件一个资源域：`user` / `workspace` / `chat` / `note` / `model-config` / `models` / `role` / `menu`。负责入参校验、调用 model 层、组装响应 |
| `models/` | 数据访问。类静态方法，直接拼 SQL，负责查询构造与行转换；`formatResponse` 把 snake_case 转 camelCase |
| `middlewares/auth.js` | 解析 `Authorization: Bearer`，验签 JWT，查 Redis 黑名单后把 payload 挂到 `req.user` |
| `middlewares/rbac.js` | `loadAuthContext` 载入角色与权限码（Redis 缓存 300 秒）；`requirePermission(code)` 做功能级拦截；`requireOwnership({resource})` 做资源属主校验 |
| `middlewares/rate-limit.js` | Redis 固定窗口限流，已认证按 user、未认证按 IP；Redis 不可用时放行 |
| `tool/` | Agent 工具：`search_notes` / `get_note_detail` / `save_note`，由 `buildNoteTools(user, options)` 按请求构造 |
| `utils/model-factory.js` | 按 `provider` 造 Vercel AI SDK 模型实例：`anthropic` / `google` 走原生适配器，其余一律走 OpenAI 兼容 |
| `utils/appError.js` | `AppError` 与快捷构造器（`BadRequest` / `Unauthorized` / `Forbidden` / `NotFound` / `Conflict` / `BadGateway`） |
| `sql/` | `init.sql` 建库建表；`migrations/` 存增量 DDL，按日期命名 |

### 前端 `interface/src/`

| 模块 | 职责 |
|---|---|
| `routes.tsx` | 路由树；`leftbar-b` 外壳包住工作区、聊天、笔记、设置，`guard` 只包住 `/admin/*` |
| `components/shell/` | 方案 B 左栏外壳、项目列表、模块导航、导航可见性计算（`use-shell-navigation`） |
| `components/ui/` | 自研设计系统组件：`pill` / `stat-card` / `empty-state` / `filter-pill` / `skeleton-card` / `switch` |
| `components/permission/` | `usePermission()` 与按钮级 `<AuthButton permission="...">` |
| `http/` | axios 实例与拦截器；`request()` 返回 `[error, response]` 元组而非抛异常 |
| `store/` | Zustand：`useUserStore`（token / roles / menus / permissions，持久化）、`useWorkspaceStore`（当前项目） |
| `api/` | 每个资源域一个目录，封装请求函数 |

### 共享 `shared/`

`constants/` 与 `utils/`（`formatter` / `validator`）。**当前只有后端引用**（`server/endpoints/*` 与 `server/models/*` 用相对路径导入），前端未接入。

## 接口约定

成功响应统一为 `{ data, code, message }`，HTTP 状态码同步设置。失败响应为 `{ code, message, stack? }`，`stack` 仅在开发环境返回。前端拦截器在 `code !== 200` 时弹 toast 并 reject；收到 401 时清空 `useUserStore` 并跳转 `/login`，避免残留身份。

聊天接口 `POST /api/chat/:workspaceId` 有两种形态：`stream: false` 返回上面的 JSON 信封；默认的流式模式返回 `text/event-stream`，每个事件为 `data: {json}\n\n`，事件类型包括文本增量、`note-saved` 回执与结束。客户端断开时通过 `AbortController` 中止上游模型请求。

## 认证与授权

三层叠加，缺一不可：

1. `authMiddleware` 证明"你是谁"，结果在 `req.user`。
2. `loadAuthContext` 载入角色与权限码，结果在 `req.auth`；`super_admin` 在 `requirePermission` 中直接放行，防止配置错误锁死系统。
3. `requireOwnership({ resource })` 证明"这个资源归你"，支持 `note` / `workspace` / `model_config` / `chat`（经 workspace 间接归属）；非属主时才查角色，属主路径零额外查询。

`user` 端点没有在 router 级挂鉴权，而是逐路由组合 `withAuthContext`（`authMiddleware` + `loadAuthContext`），因为 `register` 与 `login` 必须公开。`models` 端点完全公开。

## 数据模型

十张表：`user`、`role`、`user_role`、`menu`、`role_menu`、`workspace`、`chat`、`note`、`model_config`、`user_settings`。

关键关系与约束：

- `workspace` 属于 user，携带 `goal` / `description` / `status` / `use_default_model` / `model_id`，是项目容器而不只是会话列表。
- `chat` 通过 `workspace_id` 归属，没有自己的 `user_id`；归属校验必须 JOIN workspace。`model_snapshot` 记录当轮使用的模型，避免模型配置变更后历史消息失真。
- `note` 同时可挂 `workspace_id` 与 `source_chat_id`，这是"对话沉淀为笔记"的来源回链。
- `model_config` 是**个人资源**（每用户独立 API Key），不是系统级配置。
- `user_settings.default_model_id` 可为空；项目未挂模型时回退到用户默认模型，默认模型被删除视为未配置。

## 扩展点

| 目标 | 机制 |
|---|---|
| 新增一个资源域的 API | 在 `server/endpoints/` 建文件导出 `xxxEndpoints(apiRouter)`，在 `app.js` 注册；配套 `server/models/` 模型类 |
| 新增 Agent 工具 | 在 `server/tool/tools/` 实现 `{ description, inputSchema, execute }`，在 `server/tool/index.js` 的 `buildNoteTools` 中注册 |
| 新增模型提供商 | 原生适配器加进 `server/utils/model-factory.js` 的 `PROVIDER_MAPPING`；其余提供商走 OpenAI 兼容路径，无需改代码 |
| 新增权限码 | `menu` 表写入权限码 → 角色绑定 → 后端 `requirePermission('domain:action')`，前端 `<AuthButton>` 或 `usePermission()` 同码控制 |
| 新增受权限保护的管理页 | `routes.tsx` 里挂到 `guard` layout 下，路由 `handle` 声明所需权限 |
| 新增页面 | `interface/src/pages/` 建目录，`routes.tsx` 注册；需外壳则放进 `leftbar-b` layout，需要自定义左栏时用 `LeftbarNavContext` 注入 |
| 调整设计令牌 | `design/prototype/tokens.css` 与 `tokens.json` 是数值基准；前端实际样式以 `interface/src/assets/styles/` 为准，改动需同步原型 |

## 测试

`server/test/` 是集成测试，Vitest 串行执行。隔离是硬约束：只读 `server/.env.test.local` 或 `TEST_*` 环境变量，不继承开发连接；启动时校验库名必须是 `aura_test`，否则拒绝运行；每个文件重建表，Redis 整库 FLUSHDB。Windows 下 `server/scripts/start-test-services.ps1` 一键拉起隔离实例（MySQL 13306 / Redis 16379）。

不调用真实收费模型，chat 测试使用模拟模型。

文档层由 `pnpm test:docs` 检查：Markdown 相对链接与锚点、Agent Note 树结构。配置在 [scripts/governance-config.ts](../scripts/governance-config.ts)。

## 文档与决策的位置

- 产品方向与路线：[docs/product-roadmap.md](./product-roadmap.md)
- 系统当前形态：本页
- 取舍理由与被否方案：[.agents/notes/](../.agents/notes/README.md)
- 常驻协作规则：[AGENTS.md](../AGENTS.md)
- UI 原型与屏幕到路由的映射：[design/prototype/README.md](../design/prototype/README.md)
