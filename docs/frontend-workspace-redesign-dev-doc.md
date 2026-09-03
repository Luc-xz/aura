# Aura 前端工作台改造开发文档

## 1. 文档目标

这份文档用于指导 Aura 第一轮前端体验改造，把当前“聊天 + 笔记 + 设置”的功能集合，升级为围绕 workspace 展开的“项目 AI 工作台”。

本轮已确定的产品方向是：

`A 为入口，B 为主体验。`

也就是：

1. 入口使用“项目工作台”结构，让用户先看到自己正在推进的项目。
2. 进入项目后使用“三栏沉浸式推进”结构，让聊天、项目上下文、笔记入口在同一个工作流中协作。
3. 同步把 workspace 从“对话容器”升级为“项目容器”，补齐项目目标、描述、状态等基础字段。

---

## 2. 改造背景

### 2.1 当前问题

当前前端的主要问题不是单个页面不能用，而是整体体验缺少产品主线：

1. `功能太松散`
   - Chat、Note、Setting 是横向菜单关系。
   - workspace 只像聊天列表，不像长期项目容器。
   - 笔记和聊天没有明显的工作流连接。

2. `样式太简单随意`
   - 主要依赖 Ant Design 默认样式和少量 Tailwind 工具类。
   - 缺少统一的布局密度、色彩、间距、状态样式。
   - 页面之间的视觉语言不一致。

3. `布局看着老套`
   - 左侧大菜单 + 内容区的传统后台结构，不能突出 Aura 的 AI 工作台定位。
   - 聊天页头部、工作区列表、输入区之间缺少清晰层级。
   - 首页直接跳到聊天页，缺少产品入口和项目概览。

4. `使用体验不好`
   - 用户进入后不知道当前 workspace 的目标是什么。
   - 切换项目、继续聊天、查看笔记之间路径不够顺。
   - 错误、空状态、加载状态和项目状态表达不足。

### 2.2 产品目标

Aura 的目标不是做一个通用聊天工具，而是：

`面向长期项目推进的 AI 工作台。`

第一轮前端改造要让用户感受到：

1. 我是在推进一个项目，而不是打开一个聊天框。
2. 每个 workspace 都有目标、背景和当前状态。
3. 聊天是项目推进的核心动作，但不是唯一资产。
4. 笔记、结论、待办、项目记忆以后都能自然接到右侧沉淀区。

---

## 3. 本轮范围

### 3.1 本轮做什么

本轮选择“前端改造 + workspace 项目化字段”。

具体包括：

1. 新增项目工作台入口页。
2. 改造 workspace 详情/聊天页为三栏推进布局。
3. 为 workspace 增加项目化字段。
4. 调整 workspace 新建、编辑、列表、详情接口和前端表单。
5. 统一主要页面的视觉风格、布局密度和基础交互状态。
6. 在右侧项目上下文区预留后续“沉淀能力”的入口和占位。

### 3.2 本轮不做什么

为了控制范围，本轮暂不做：

1. 自动总结。
2. 自动提取待办。
3. 真实任务系统。
4. 向量检索和项目记忆召回。
5. 笔记与 workspace 的强绑定迁移。
6. 多人协作。
7. 插件系统。

这些能力可以在本轮布局稳定后继续迭代。

---

## 4. 目标信息架构

### 4.1 页面层级

建议第一版页面结构调整为：

```text
/                         -> redirect /workspace
/login                    -> 登录/注册
/workspace                -> 项目工作台入口页
/workspace/:id            -> 项目推进页，三栏布局
/note                     -> 笔记库
/note/edit/:id?           -> 笔记编辑
/setting                  -> 设置首页
/setting/model-config     -> 模型配置
```

如果希望减少路由改动，也可以短期保留 `/chat`，让 `/chat` 承载项目推进页。但从产品语义看，推荐新增 `/workspace`。

### 4.2 导航结构

当前侧边菜单以 Chat、Note、System 为一级导航。改造后建议：

```text
Aura
- Workspace
- Notes
- Settings
```

其中 Workspace 是默认入口。

项目切换不再放在全局菜单里，而是放在 workspace 页面内部的左栏。全局导航负责“模块级切换”，项目左栏负责“当前工作对象切换”。

---

## 5. 核心页面设计

## 5.1 项目工作台入口页

### 页面目标

让用户一进入 Aura 就知道：

1. 我有哪些项目。
2. 每个项目要推进什么目标。
3. 哪些项目正在进行、暂停或归档。
4. 下一步可以继续哪个项目。

### 页面内容

建议包含：

1. 顶部标题区
   - 页面标题：`项目工作台`
   - 简短副标题：说明 Aura 是用于长期项目推进的 AI 工作台。
   - 主按钮：`新建项目`

2. 状态筛选区
   - 全部
   - 进行中
   - 暂停
   - 已归档

3. 项目卡片列表
   - 项目名称 `title`
   - 项目目标 `goal`
   - 项目描述 `description`
   - 状态 `status`
   - 默认模型 `modelName`
   - 更新时间 `updatedAt`
   - 操作：继续推进、编辑、归档

4. 空状态
   - 没有项目时，引导用户创建第一个项目。
   - 空状态不要只显示 “No Data”，要给出清晰动作。

### 交互规则

1. 点击项目卡片或“继续推进”，进入 `/workspace/:id`。
2. 点击“新建项目”，打开项目表单弹窗或进入新建页面。
3. 状态筛选只影响当前列表展示。
4. 已归档项目默认可以展示，但视觉上弱化，不作为主推荐。

---

## 5.2 项目推进页

### 页面目标

这是 Aura 的核心使用页。它要让用户在一个工作空间里完成：

`查看项目上下文 -> 发起讨论 -> 得到回复 -> 形成后续沉淀`

### 三栏布局

```text
| 项目列表 | 聊天推进区 | 项目上下文区 |
```

### 左栏：项目列表

用途：在当前页面内快速切换 workspace。

包含：

1. Aura 或 Workspace 标识。
2. 新建项目按钮。
3. 项目搜索输入框。
4. 项目列表。
5. 当前项目高亮。

项目列表项展示：

1. 项目名称。
2. 状态点或状态标签。
3. 默认模型或更新时间的简短信息。

### 中栏：聊天推进区

用途：承载主要 AI 对话体验。

包含：

1. 项目顶部栏
   - 项目名称。
   - 项目目标摘要。
   - 模型切换入口。
   - 项目设置入口。

2. 消息列表
   - 用户消息。
   - AI 消息。
   - 流式输出状态。
   - 复制、重新生成等基础操作。

3. 输入区
   - Prompt 输入。
   - 发送按钮。
   - 附件入口可以保留，但如果当前没有真实上传能力，应弱化或隐藏。

### 右栏：项目上下文区

用途：让 workspace 有“项目容器”的感觉，并为后续沉淀能力留位置。

第一版展示：

1. 项目目标
   - 来自 `workspace.goal`。

2. 项目描述
   - 来自 `workspace.description`。

3. 项目状态
   - 来自 `workspace.status`。

4. 默认模型
   - 来自 `workspace.modelName`。

5. 最近笔记入口
   - 第一版可以先跳转到笔记库。
   - 暂不强制做 workspace 关联笔记。

6. 后续沉淀占位
   - `项目结论`
   - `待办事项`
   - `项目记忆`

这些模块第一版可以显示空状态和 “Coming next” 风格提示，但不要做成营销文案。它们应像真实产品里的暂空模块。

---

## 6. Workspace 数据结构改造

### 6.1 新增字段

在 `workspace` 表中新增：

```sql
goal VARCHAR(255) DEFAULT NULL,
description TEXT DEFAULT NULL,
status VARCHAR(32) NOT NULL DEFAULT 'active'
```

字段说明：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| title | VARCHAR(255) | 是 | 项目名称，保留现有字段 |
| goal | VARCHAR(255) | 否 | 项目目标，一句话说明要推进什么 |
| description | TEXT | 否 | 项目背景、范围或备注 |
| status | VARCHAR(32) | 是 | 项目状态，默认 active |
| model_id | INT | 否 | 默认模型，保留现有字段 |

### 6.2 状态枚举

第一版使用三个状态：

```text
active   -> 进行中
paused   -> 暂停
archived -> 已归档
```

状态使用建议：

1. `active` 是默认状态，项目工作台优先展示。
2. `paused` 用于暂时不推进但仍保留上下文的项目。
3. `archived` 用于已完成或不再推进的项目。

### 6.3 数据库迁移

建议新增迁移文件：

```text
server/sql/migrations/20260709_alter_workspace_project_fields.sql
```

迁移内容示例：

```sql
ALTER TABLE workspace
  ADD COLUMN goal VARCHAR(255) DEFAULT NULL AFTER title,
  ADD COLUMN description TEXT DEFAULT NULL AFTER goal,
  ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'active' AFTER description;

CREATE INDEX idx_workspace_user_status_updated_at
  ON workspace (user_id, status, updated_at);
```

同时更新 `server/sql/init.sql`，保证新环境初始化时字段一致。

---

## 7. 后端接口改造

### 7.1 Workspace model

目标文件：

```text
server/models/workspace.js
```

需要调整：

1. `create(user, payload)` 支持 `title, goal, description, status, modelId`。
2. `update(id, payload)` 支持更新 `goal, description, status`。
3. `findWithDetails` 查询返回新增字段。
4. 列表查询支持按 `status` 过滤。
5. 建议补 `findOwnedById(id, userId)`，避免后续详情、更新、删除越权。

### 7.2 Workspace endpoint

目标文件：

```text
server/endpoints/workspace.js
```

需要调整：

1. `GET /api/workspace/list`
   - 支持 `status` 查询。
   - 返回新增字段。

2. `GET /api/workspace/:id`
   - 建议新增详情接口。
   - 必须校验当前用户拥有该 workspace。

3. `POST /api/workspace`
   - 接收 `title, goal, description, status, modelId`。
   - `status` 不传时默认为 `active`。

4. `PUT /api/workspace/:id`
   - 接收 `title, goal, description, status, modelId`。
   - 必须校验当前用户拥有该 workspace。

5. `DELETE /api/workspace/:id`
   - 必须校验当前用户拥有该 workspace。

### 7.3 响应结构

继续沿用现有响应结构：

```json
{
  "code": 1,
  "message": "success",
  "data": {}
}
```

错误结构建议保持：

```json
{
  "code": 400,
  "message": "error message",
  "data": null
}
```

---

## 8. 前端开发方案

### 8.1 路由调整

目标文件：

```text
interface/src/routes.tsx
interface/src/pages/index.tsx
```

建议路由：

```tsx
index('./pages/index.tsx')
route('login', './pages/login/index.tsx')
layout('./pages/layout/index.tsx', [
  ...prefix('workspace', [
    index('./pages/workspace/index.tsx'),
    route(':id', './pages/workspace/detail.tsx'),
  ]),
  ...prefix('note', [
    index('./pages/note/index.tsx'),
    route('edit/:id?', './pages/note/edit.tsx'),
  ]),
  ...prefix('setting', [
    index('./pages/setting/index.tsx'),
    route('model-config', './pages/setting/model-config.tsx'),
  ]),
])
```

`/` 重定向到 `/workspace`。

短期兼容方案：保留 `/chat`，让它重定向到 `/workspace` 或 `/workspace/:lastWorkspaceId`。

### 8.2 推荐目录结构

新增：

```text
interface/src/pages/workspace/index.tsx
interface/src/pages/workspace/detail.tsx
interface/src/pages/workspace/components/workspace-form.tsx
interface/src/pages/workspace/components/workspace-sidebar.tsx
interface/src/pages/workspace/components/workspace-context.tsx
interface/src/pages/workspace/components/chat-panel.tsx
```

可迁移：

```text
interface/src/pages/chat/index.tsx
```

建议不要继续把 workspace 面板、聊天面板、弹窗表单全部塞在一个文件里。第一版可以把逻辑拆开，避免后面加沉淀能力时文件膨胀。

### 8.3 API 类型与请求

目标文件：

```text
interface/src/api/workspace/index.ts
```

建议补充类型：

```ts
export type WorkspaceStatus = 'active' | 'paused' | 'archived'

export interface Workspace {
  id: number
  title: string
  goal?: string | null
  description?: string | null
  status: WorkspaceStatus
  modelId?: number | null
  modelName?: string | null
  provider?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface WorkspacePayload {
  title: string
  goal?: string
  description?: string
  status?: WorkspaceStatus
  modelId?: number
}
```

接口函数建议：

```ts
getWorkspaceList(params?: { status?: WorkspaceStatus | 'all'; keyword?: string })
getWorkspaceDetail(id: string | number)
createWorkspace(data: WorkspacePayload)
updateWorkspace(id: string | number, data: WorkspacePayload)
deleteWorkspace(id: string | number)
```

### 8.4 Store 调整

目标文件：

```text
interface/src/store/index.ts
```

当前 workspace store 持久化整个 workspace 对象。建议调整为：

1. 持久化 `currentWorkspaceId`。
2. 页面加载时根据 id 从接口拉取最新 workspace。
3. 减少本地缓存对象和服务端数据不一致的问题。

第一版如果为了减少改动，也可以保留当前 store，但要在项目编辑后同步更新当前 workspace。

---

## 9. 视觉与交互规范

### 9.1 整体气质

Aura 应该是一个安静、清晰、能长期使用的工作台，而不是营销型页面。

关键词：

```text
克制、专业、清晰、聚焦、可扫描、有推进感
```

### 9.2 布局原则

1. 核心工作页使用三栏布局。
2. 左栏用于工作对象切换，不承载复杂设置。
3. 中栏保持聊天体验舒适，不堆过多卡片。
4. 右栏用于项目上下文和沉淀，不喧宾夺主。
5. 页面不要使用过多大圆角、渐变块和装饰性元素。

### 9.3 色彩建议

避免整站变成单一蓝色或灰蓝色。建议：

1. 主色：稳定的蓝色，用于主操作和当前态。
2. 辅助色：绿色用于进行中、琥珀色用于暂停、灰色用于归档。
3. 背景：浅灰白，区分工作区层级。
4. 文本：深色正文 + 中灰辅助信息。

### 9.4 组件状态

必须补齐：

1. 列表加载状态。
2. 空 workspace 状态。
3. 无聊天记录状态。
4. 保存中状态。
5. 流式聊天中状态。
6. 接口失败提示。
7. 当前项目不存在或无权限状态。

---

## 10. 开发阶段拆分

## 阶段 1：数据层和接口

目标：让 workspace 具备项目字段。

任务：

1. 新增 workspace 字段迁移。
2. 更新 `init.sql`。
3. 更新 `Workspace.create/update/findWithDetails`。
4. 新增或补齐 `GET /api/workspace/:id`。
5. 列表支持 `status` 过滤。
6. 补基础接口测试。

验收：

1. 能创建带目标、描述、状态的 workspace。
2. 能编辑这些字段。
3. 列表和详情都返回这些字段。
4. 非当前用户不能更新或删除他人 workspace。

## 阶段 2：项目工作台入口页

目标：让 `/workspace` 成为产品入口。

任务：

1. 新增 workspace 首页。
2. 实现项目卡片列表。
3. 实现状态筛选。
4. 实现新建/编辑项目表单。
5. `/` 重定向到 `/workspace`。

验收：

1. 用户进入系统先看到项目工作台。
2. 可以新建项目并进入项目推进页。
3. 项目卡片能展示目标、描述、状态、模型。
4. 空状态能引导创建项目。

## 阶段 3：项目推进页三栏改造

目标：替换当前聊天页的松散结构。

任务：

1. 拆分 workspace sidebar、chat panel、context panel。
2. 中栏复用现有聊天接口和流式输出逻辑。
3. 右栏展示项目目标、描述、状态和模型。
4. 左栏支持项目切换和新建项目。
5. 从 `/workspace/:id` 加载当前项目详情和聊天记录。

验收：

1. 当前项目上下文始终可见。
2. 切换项目后聊天记录同步切换。
3. 聊天输入和流式回复功能保持可用。
4. 右栏为后续沉淀能力预留清晰位置。

## 阶段 4：视觉统一和体验补齐

目标：让页面从原型感变成可持续使用的工作台。

任务：

1. 调整全局布局和菜单样式。
2. 统一卡片、列表、状态标签、按钮密度。
3. 补齐加载、空状态、错误状态。
4. 移除或弱化没有真实功能的入口。
5. 检查桌面和窄屏下文字是否溢出。

验收：

1. 页面视觉统一，不再像多个 demo 拼在一起。
2. 项目工作台和项目推进页有明显产品辨识度。
3. 常见异常状态有恢复路径。

---

## 11. 测试建议

### 11.1 后端测试

重点补 `server/test/workspace.test.js`：

1. 创建 workspace 时保存 `goal/description/status`。
2. 不传 status 时默认 `active`。
3. 更新 workspace 字段成功。
4. 按 status 筛选列表成功。
5. 用户不能读取、更新、删除他人的 workspace。

### 11.2 前端验证

至少手动验证：

1. 登录后进入 `/workspace`。
2. 新建项目。
3. 编辑项目目标、描述、状态和模型。
4. 进入 `/workspace/:id` 后能聊天。
5. 切换项目后聊天记录变化。
6. 删除或归档项目后列表状态正确。
7. 没有项目时空状态正确。

如果后续加前端测试，优先覆盖：

1. Workspace 表单字段。
2. 状态筛选。
3. 三栏页面的空状态和加载状态。

---

## 12. 验收标准

本轮改造完成后，应满足：

1. Aura 默认入口是项目工作台，而不是裸聊天页。
2. workspace 能表达项目名称、目标、描述、状态和默认模型。
3. 用户能从项目卡片自然进入项目推进页。
4. 项目推进页采用左项目、中聊天、右上下文的三栏结构。
5. 聊天能力保持可用，不因布局改造退化。
6. 右栏已经为后续项目结论、待办、记忆能力留出位置。
7. 视觉风格更统一、克制、工作台化。
8. 主要空状态、加载状态、错误状态有明确反馈。

---

## 13. 风险与注意事项

1. `不要把第一版做成任务管理系统`
   - 本轮只补 workspace 项目字段，不展开复杂任务模块。

2. `不要让右栏变成装饰区`
   - 即使第一版是占位，也要展示真实项目字段。

3. `不要继续扩大 chat/index.tsx`
   - 当前聊天页已经承担太多职责，改造时应拆组件。

4. `注意接口权限`
   - 更新、删除、详情都必须按当前用户校验。

5. `注意持久化 workspace 状态`
   - 本地 store 不应长期保存过期 workspace 对象。

---

## 14. 推荐实施顺序

推荐按下面顺序推进：

1. 先做数据库和后端 workspace 字段。
2. 再做 `/workspace` 项目工作台入口页。
3. 然后把现有聊天页迁移到 `/workspace/:id` 三栏布局。
4. 最后统一视觉和状态反馈。

这样做的好处是：每一步都有可验收结果，不需要一次性推翻现有前端。
