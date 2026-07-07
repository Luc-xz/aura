# Aura M1 执行清单

## 1. 文档目标

这份文档用于承接 [product-roadmap.md](/mnt/c/MyProgram/my_programs/aura/docs/product-roadmap.md:1) 中的 `M1` 目标，把第一阶段需要落地的事情拆成可执行任务。

`M1` 的目标不是做出全部亮点，而是完成下面这件事：

`把 Aura 从“可演示原型”推进到“可以稳定迭代的项目基础版”。`

---

## 2. M1 范围

M1 只做四类事情：

1. `补基础工程底盘`
2. `补权限和接口一致性`
3. `让 workspace 更像项目容器`
4. `为后续“对话沉淀”和“项目记忆”铺路`

M1 暂时不做：

- 向量检索
- 多人协作
- 插件系统
- 很重的可视化知识图谱
- 很复杂的任务系统

---

## 3. M1 成功标准

M1 完成后，至少要满足以下判断：

1. 用户只能访问自己的 note、workspace、chat、model-config
2. 前后端接口成功/失败结构清晰，前端能稳定处理错误
3. workspace 不再只是一个“聊天标题”，而是带目标和描述的项目容器
4. 项目首页能够展示基本项目信息
5. 核心接口具备基础测试，后续修改不容易破坏已有功能

---

## 4. 当前代码基线

结合当前代码，M1 的工作会主要落在以下位置：

### 后端

- [server/sql/init.sql](/mnt/c/MyProgram/my_programs/aura/server/sql/init.sql:1)
- [server/endpoints/workspace.js](/mnt/c/MyProgram/my_programs/aura/server/endpoints/workspace.js:1)
- [server/endpoints/note.js](/mnt/c/MyProgram/my_programs/aura/server/endpoints/note.js:1)
- [server/endpoints/chat.js](/mnt/c/MyProgram/my_programs/aura/server/endpoints/chat.js:1)
- [server/endpoints/model-config.js](/mnt/c/MyProgram/my_programs/aura/server/endpoints/model-config.js:1)
- [server/models/workspace.js](/mnt/c/MyProgram/my_programs/aura/server/models/workspace.js:1)
- [server/models/note.js](/mnt/c/MyProgram/my_programs/aura/server/models/note.js:1)
- [server/models/chat.js](/mnt/c/MyProgram/my_programs/aura/server/models/chat.js:1)
- [server/models/model-config.js](/mnt/c/MyProgram/my_programs/aura/server/models/model-config.js:1)
- [server/middlewares/auth.js](/mnt/c/MyProgram/my_programs/aura/server/middlewares/auth.js:1)

### 前端

- [interface/src/pages/chat/index.tsx](/mnt/c/MyProgram/my_programs/aura/interface/src/pages/chat/index.tsx:1)
- [interface/src/pages/layout/index.tsx](/mnt/c/MyProgram/my_programs/aura/interface/src/pages/layout/index.tsx:1)
- [interface/src/pages/note/index.tsx](/mnt/c/MyProgram/my_programs/aura/interface/src/pages/note/index.tsx:1)
- [interface/src/pages/note/edit.tsx](/mnt/c/MyProgram/my_programs/aura/interface/src/pages/note/edit.tsx:1)
- [interface/src/http/handler.ts](/mnt/c/MyProgram/my_programs/aura/interface/src/http/handler.ts:1)
- [interface/src/api/workspace/index.ts](/mnt/c/MyProgram/my_programs/aura/interface/src/api/workspace/index.ts:1)
- [interface/src/store/index.ts](/mnt/c/MyProgram/my_programs/aura/interface/src/store/index.ts:1)

### 测试

- [server/test/user.test.js](/mnt/c/MyProgram/my_programs/aura/server/test/user.test.js:1)
- [server/test/workspace.test.js](/mnt/c/MyProgram/my_programs/aura/server/test/workspace.test.js:1)

---

## 5. M1 任务分组

M1 建议拆成 5 组任务，按顺序推进。

1. `A 组：后端安全与一致性`
2. `B 组：workspace 项目化`
3. `C 组：前端信息架构与页面承接`
4. `D 组：测试补齐`
5. `E 组：文档与验收`

---

## 6. A 组：后端安全与一致性

## 6.1 A1 统一接口响应规范

### 目标

让所有接口都遵守统一约定，减少前端特判。

### 建议约定

成功响应：

```json
{
  "code": 1,
  "message": "success",
  "data": {}
}
```

失败响应：

```json
{
  "code": 400,
  "message": "error message",
  "data": null
}
```

### 建议动作

1. 梳理所有 endpoint 的成功返回结构，统一补 `data`
2. 全局错误处理中失败响应统一带 `data: null`
3. 评估是否继续保留“HTTP 200 + code 表示业务失败”的模式
4. 如果短期不改 HTTP 语义，至少保证前端有一致判断方式

### 推荐结论

M1 可以先不大改历史行为，但建议做到：

- 认证失败继续用 `401`
- 成功请求返回 `200`
- 业务校验失败先保留现有模式，但失败体统一

### 验收标准

- 前端请求层可以用统一逻辑识别成功/失败
- 不同接口不会返回互相冲突的数据结构

## 6.2 A2 补齐资源归属校验

### 目标

避免用户通过改 id 越权访问其他人的资源。

### 当前问题

列表接口基本按用户过滤，但单资源查询和修改删除不完全安全。

### 需要处理的模块

1. `note`
2. `workspace`
3. `chat`
4. `model-config`

### 具体动作

#### note

- `GET /api/note/:id` 需要校验 `note.user_id = req.user.id`
- `PUT /api/note/:id` 需要校验归属
- `DELETE /api/note/:id` 需要校验归属

#### workspace

- `PUT /api/workspace/:id` 需要校验 `workspace.user_id = req.user.id`
- `DELETE /api/workspace/:id` 需要校验归属
- 如果新增 `GET /api/workspace/:id`，也要从一开始就带归属校验

#### chat

- `GET /api/chat/list/:workspaceId` 需要先确认 workspace 属于当前用户
- `POST /api/chat/:workspaceId` 需要先确认 workspace 属于当前用户

#### model-config

- `GET /api/model-config/:id` 需要校验归属
- `PUT /api/model-config/:id` 需要校验归属
- `DELETE /api/model-config/:id` 需要校验归属
- 聊天时使用 `modelId` 也要确认该模型配置属于当前用户

### 模型层建议

建议把原来按 `id` 查询的方法升级成：

- `findById(id, user)`
- `update(id, user, payload)`
- `delete(id, user)`

或者新增：

- `findOwnedById(id, userId)`

### 验收标准

- 越权访问返回明确错误
- 越权更新删除无法成功
- 聊天时不能引用他人的 workspace 或 model-config

## 6.3 A3 统一错误对象和业务错误语义

### 目标

让错误不再只是 `throw new Error(...)`，而是带有更稳定的状态和语义。

### 建议动作

1. 新增轻量错误工具
   - `badRequest`
   - `unauthorized`
   - `forbidden`
   - `notFound`
2. endpoint 内部对常见异常使用明确错误类型
3. 全局错误处理中根据 `err.status` 输出

### 建议错误语义

- 参数缺失或格式错误：`400`
- 未登录或 token 无效：`401`
- 有登录态但访问他人资源：`403`
- 资源不存在：`404`
- 服务内部错误：`500`

### 验收标准

- 错误响应更容易被前端消费
- 后端日志和前端提示更可预测

## 6.4 A4 前端统一错误处理和登录失效处理

### 目标

当前端收到统一错误时，页面行为也统一。

### 具体动作

1. 调整请求封装，让 `401` 时执行统一处理
2. 自动清空本地用户态
3. 自动跳转登录页，保留适当提示
4. 表单类错误优先显示后端 message
5. 网络错误和业务错误分开提示

### 相关文件

- `interface/src/http/request.ts`
- `interface/src/http/index.ts`
- `interface/src/http/handler.ts`
- `interface/src/store/index.ts`

### 验收标准

- token 失效时不会页面静默异常
- 用户能感知并恢复登录

---

## 7. B 组：workspace 项目化

## 7.1 B1 扩展 workspace 数据结构

### 目标

让 workspace 成为项目容器，而不是只有标题和模型 id。

### 建议新增字段

- `description`：项目简介
- `goal`：项目目标
- `status`：项目状态
- `summary`：最近总结
- `last_active_at`：最近活跃时间

### 建议状态枚举

- `active`
- `paused`
- `done`

### 数据库动作

1. 新增迁移文件
2. 更新 `server/sql/init.sql`
3. 更新 `Workspace` model 的读写字段
4. 更新创建与编辑接口

### 表结构建议

```sql
ALTER TABLE workspace
  ADD COLUMN description VARCHAR(255) DEFAULT NULL,
  ADD COLUMN goal TEXT DEFAULT NULL,
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active',
  ADD COLUMN summary TEXT DEFAULT NULL,
  ADD COLUMN last_active_at TIMESTAMP NULL DEFAULT NULL;
```

### 验收标准

- workspace 可以保存项目级信息
- 查询结果能返回这些字段

## 7.2 B2 让聊天更新项目活跃状态

### 目标

当用户在项目中聊天时，workspace 的最近活跃时间能更新。

### 具体动作

1. 在创建聊天消息时更新 `workspace.last_active_at`
2. 如果当前没有值，首次创建消息时也写入
3. workspace 列表默认可按最近活跃排序

### 验收标准

- 聊天后 workspace 的时间会变化
- 列表更符合真实使用顺序

## 7.3 B3 调整 workspace 列表返回结构

### 目标

让前端列表页能展示更丰富的项目信息。

### 建议返回内容

- `id`
- `title`
- `description`
- `goal`
- `status`
- `summary`
- `lastActiveAt`
- `modelName`
- `provider`
- `noteCount` 或预留该能力
- `chatCount` 或预留该能力

### 实现建议

M1 可以先不做复杂统计，先做：

- `workspace + model_config` 联表
- 保留后续统计字段扩展位

### 验收标准

- 前端不需要拼很多二次请求也能渲染项目列表卡片

## 7.4 B4 新增项目详情查询接口

### 目标

为“项目首页视图”提供单项目数据源。

### 建议接口

`GET /api/workspace/:id`

### 返回建议

- 基础字段
- 默认模型信息
- 最近活跃时间
- 可选的 summary

### 验收标准

- 前端进入某个项目时能拿到完整项目数据

---

## 8. C 组：前端信息架构与页面承接

## 8.1 C1 调整 workspace 创建/编辑弹窗

### 目标

让用户在创建 workspace 时就知道这是一个“项目”。

### 当前状态

当前仅支持：

- `title`
- `modelId`

### 建议新增表单项

- `description`
- `goal`
- `status`

### 文案建议

- 把“新建对话”改为“新建项目”
- 把“对话名称”改为“项目名称”
- 增加“项目目标”帮助用户形成场景感

### 验收标准

- 创建流程语义从“聊天容器”转向“项目容器”

## 8.2 C2 优化 workspace 列表展示

### 目标

让左侧列表更像项目面板，而不是普通会话列表。

### 建议展示内容

- 项目名称
- 项目状态
- 默认模型
- 最近活跃时间
- 简短描述

### UI 建议

- 激活项更明显
- 状态标签用不同色值区分
- 最近活跃时间用次级信息展示

### 验收标准

- 用户看列表就能理解这是多个长期项目

## 8.3 C3 增加项目概览区

### 目标

进入项目后，用户先看到项目信息，再看到聊天流。

### 建议位置

放在聊天主区域上方，作为项目头部。

### 建议展示区块

- 项目标题
- 项目目标
- 项目简介
- 最近总结
- 当前模型

### 初版要求

M1 先静态展示，不需要复杂编辑体验。

### 验收标准

- 项目上下文在页面第一屏可见

## 8.4 C4 补登录态和页面守卫

### 目标

未登录用户不应直接进入主页面。

### 建议动作

1. 增加基础路由守卫
2. 检查本地是否存在 user/token
3. 没有则重定向到 `/login`
4. 登录后回到默认页

### 验收标准

- 刷新后状态可恢复
- token 不存在时不会进入受保护页面

## 8.5 C5 为后续功能预留交互位

### 目标

M1 不一定要把“总结”和“对话转笔记”做完，但界面要预留承接点。

### 可预留位置

- AI 回复区操作按钮
- 项目概览区的“最近总结”区域
- workspace 列表中的 summary 简版

### 验收标准

- M2 做新能力时无需大改布局

---

## 9. D 组：测试补齐

## 9.1 D1 note 接口测试

### 需要覆盖

1. 创建 note
2. 获取 note 列表
3. 获取 note 详情
4. 更新 note
5. 删除 note
6. 越权访问他人 note 失败

### 验收标准

- note 基础闭环可验证

## 9.2 D2 model-config 接口测试

### 需要覆盖

1. 创建 model-config
2. 列表查询
3. 单条详情
4. 更新
5. 删除
6. 越权访问失败

### 验收标准

- 模型配置具备最基本的安全边界

## 9.3 D3 chat 接口测试

### 需要覆盖

1. 获取某项目消息列表
2. 向某项目发送消息
3. 未登录发送失败
4. 向他人 workspace 发送失败
5. 使用他人 model-config 失败

### 实现建议

如果直接调用真实模型太重，M1 可以：

- 对模型调用做 mock
- 重点验证接口行为、入库、权限、返回结构

### 验收标准

- chat 逻辑修改时有回归保护

## 9.4 D4 workspace 扩展字段测试

### 需要覆盖

1. 创建 workspace 时保存 `description/goal/status`
2. 更新这些字段
3. 获取详情
4. 最近活跃时间更新

### 验收标准

- 项目化字段真实生效，不只是前端表单存在

---

## 10. E 组：文档与验收

## 10.1 E1 README 最低要求

建议补充：

- 项目简介
- 技术栈
- 本地启动步骤
- 环境变量说明
- 数据库初始化步骤
- 测试运行方式

## 10.2 E2 开发日志

建议新增一份简单迭代记录，例如：

- 本阶段目标
- 已完成项
- 未完成项
- 遇到的问题

这会很适合你后面整理作品集或复盘。

## 10.3 E3 M1 验收清单

M1 完成时，逐项确认：

1. 未登录访问受保护资源是否会被拦截
2. 登录用户是否无法访问他人资源
3. workspace 是否支持项目目标和描述
4. 项目首页是否能看到项目上下文
5. 核心测试是否可运行
6. README 是否足够让别人跑起来

---

## 11. 推荐开发顺序

推荐不要并行开太多线，按下面顺序最稳：

1. `先做 A1-A4`
原因：先把安全性和一致性补起来，否则后面越做越乱。

2. `再做 B1-B4`
原因：先把 workspace 变成“项目”，后续前端和聊天才有承载对象。

3. `再做 C1-C4`
原因：后端字段和接口稳定后，前端更容易一次接好。

4. `最后做 D1-D4 和 E1-E3`
原因：测试和文档适合在功能基本稳定后补齐并固化。

---

## 12. 预计工作量

如果按单人学习项目节奏估算，M1 大概是：

- `A 组`：2-4 天
- `B 组`：2-3 天
- `C 组`：2-4 天
- `D 组`：2-3 天
- `E 组`：0.5-1 天

总计约：

`8-15 天`

这是比较现实的区间，取决于你是否一边做一边重构。

---

## 13. M1 后的自然衔接

M1 完成后，就可以顺势进入 M2，优先做下面三件事：

1. `对话转笔记`
2. `会话总结`
3. `项目记忆注入`

这三件事会是 Aura 从“基础版”走向“有亮点产品”的真正转折点。
