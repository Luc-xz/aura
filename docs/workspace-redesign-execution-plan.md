# Aura 工作台改造 · 执行计划

> 本计划承接 [product-roadmap.md](./product-roadmap.md) 的 M1 目标与 [frontend-workspace-redesign-dev-doc.md](./frontend-workspace-redesign-dev-doc.md) 的方向，
> 以 2026-09 原型终稿（commit `67f0847`）为验收基准，把「原型 vs 实现」差距报告中的**建议对齐项**落成可执行任务。
> 涉及字段/接口定义与本计划冲突时，**以本计划为准**（见 §6.1 枚举决策）。

## 1. 目标与范围

### 1.1 目标

把 Aura 从「扁平对话 + 松散功能」升级为「项目工作台」：

1. workspace 从"对话容器"升级为**项目容器**（目标 / 背景 / 状态生命周期）。
2. 新增**项目工作台入口页**（原型 03/04/05/05b），登录后先选项目再推进。
3. 推进页（原型 06/07）升级为三栏结构，右栏透出**项目上下文与沉淀**。
4. 补齐全局体验底线（加载 / 空态 / 反馈 / 校验），对齐原型 15 屏规范。

### 1.2 本轮不做（明确出范围）

| 项 | 原因 | 替代方案 |
| --- | --- | --- |
| 项目 → 多会话两级拆分 | 需要新表与会话迁移，改动大 | 本轮**项目 = 单推进会话**；右栏"会话列表"降级为项目卡 + 关联笔记列表 |
| 富文本编辑器（格式栏 / 大纲 / 导出） | 笔记当前非核心交付物，TextArea 够用 | 保持现状，记入远期 |
| 笔记自动保存 | 中成本，独立于主线 | `user_settings.auto_save_interval` 字段保留不接线 |
| 用户启用/禁用体系 | 需动登录链路，独立于主线 | 记入远期 |
| 管理端路由 / 权限码迁移（原型 14 的目标态路径） | 原型 14 已按目标态画，非本轮缺陷 | 本轮**不改**现有路由与种子编码；实现时以现状 `/admin/*` 为准 |
| 审计日志 | 原型已移除，远期规划 | — |

## 2. 总体顺序与阶段门

严格串行：**后端先行，前端框架次之，前端功能项最后**。

```
阶段B 后端基础 ──▶ 门槛G1 ──▶ 阶段F1 前端框架 ──▶ 门槛G2 ──▶ 阶段F2 功能项（P0→P1→P2）
```

| 门槛 | 准出标准（全部满足才进入下一阶段） |
| --- | --- |
| **G1 后端就绪** | B 阶段测试全绿（含恢复的 workspace/chat spec 套件）；接口可在本地环境手工走通；`init.sql` 与迁移一致 |
| **G2 框架就绪** | 全部路由可导航、无死链；工作台页在真实接口下渲染正常（含空态）；chat 页可接收 `?workspaceId=`；`pnpm build` 与 lint 通过、无 console 报错 |

## 3. 阶段 B：后端基础（先行）

### B0 测试基线（0.5 天）

把 `67f0847` 中撤出的 190 行 spec 测试恢复进 `server/test/`（`workspace.test.js` 的「项目化字段」12 例 + `chat-happy-path.test.js` 的默认模型回退 2 例），作为本阶段的红→绿目标。

> 注意：本机无 MySQL/Redis 时测试全量 skip。约定：开发时以 Docker 或本机实例跑测试；skip 状态不算绿。

### B1 数据层迁移（1 天）

新增 `server/sql/migrations/20260924_alter_workspace_project_fields.sql`：

```sql
ALTER TABLE workspace
  ADD COLUMN goal VARCHAR(255) DEFAULT NULL AFTER title,
  ADD COLUMN description VARCHAR(2000) DEFAULT NULL AFTER goal,
  ADD COLUMN status TINYINT NOT NULL DEFAULT 0 AFTER description,
  ADD COLUMN chat_count INT NOT NULL DEFAULT 0 AFTER status;  -- 见 B2 说明，可并入统计接口方案

CREATE INDEX idx_workspace_user_status
  ON workspace (user_id, status);
```

同步更新 `server/sql/init.sql` 的 workspace 建表语句，保证新环境一致。

- `status` 枚举：`0=进行中 1=暂停 2=已归档`（**整数**，理由见 §6.1）。
- `chat_count` 冗余计数若实现成本高，可改为统计接口实时 `COUNT`，二选一在 B2 定稿。

### B2 workspace model / endpoint（1.5 天）

目标文件：`server/models/workspace.js`、`server/endpoints/workspace.js`。

| 接口 | 改动 |
| --- | --- |
| `POST /api/workspace` | 接收 `title, goal, description, status, modelId`；校验：goal ≤255、description ≤2000、status ∈ {0,1,2} 缺省 0 |
| `PUT /api/workspace/:id` | 同字段；`goal` 传空串 → 置 NULL；全部字段缺省 → 400 |
| `GET /api/workspace/list` | 支持 `status` 过滤；返回新字段；**默认排序改 `updated_at DESC`**（原型"最近推进在前"） |
| `GET /api/workspace/:id` | **新增详情路由**（前端 `getWorkspaceDetail` 已定义，后端一直缺失）；含归属校验 |
| `GET /api/workspace/stats` | **新增**：`{ active, paused, archived, advancedThisWeek }`，advancedThisWeek = 近 7 天有 chat 记录的项目数 |

列表搜索：`title` 由精确等值放宽为 `LIKE '%kw%'`（原型侧栏搜索框的前置条件）。

### B3 用户默认模型设置（1 天）

- 新增 `GET /api/user/settings`、`PUT /api/user/settings`（`user_settings` 表已建、零端点）。
- 第一版只接 `defaultModelId`；`system_prompt / auto_save_interval / language` 透传存取即可，不做业务逻辑。

### B4 默认模型回退（0.5 天）

两处（对应 spec 测试）：

1. `POST /api/workspace` 不传 `modelId` 时：落用户 `default_model_id` 到 `workspace.model_id`。
2. `chat.js` 现逻辑 `workspace.modelId` 为空直接 400（`chat.js:60`）：改为回退用户默认模型；仍无则 400，文案中文化。

### B5 笔记列表关联项目（0.5 天）

`Note.findAll` 返回结果 JOIN workspace，附带 `workspaceId / workspaceTitle`；keyword 搜索范围扩到 keywords 字段。为 F2 的"笔记库显示所属项目 + 按项目筛选"供数。

### B6 菜单种子：工作台入口（0.5 天）

迁移 + init.sql：新增菜单项「工作台」（`/workspace`，type=menu，业务 ID 段），并为 member/admin/super_admin 补 role_menu 关联；sort_order 置于 Chat 之前。前端导航由此驱动（原型 14 页已注明）。

### B7（可选，可后置到 F2 期间）上下文注入

`chat.js` 组装 messages 时，把项目 `goal/description` 注入 system prompt（在现有 `NOTE_TOOLS_SYSTEM_PROMPT` 基础上拼接）。关联笔记摘要注入为远期，不在本轮。

**B 阶段合计约 5~5.5 人日。**

## 4. 阶段 F1：前端框架（页面骨架与导航，不做深功能）

> 仓库已预留空目录：`pages/workspace/`、`components/workspace-modal/`、`components/project-context/`，即本阶段的落点。

### F1.1 路由与入口（0.5 天）

`interface/src/routes.tsx`：

- 新增 `route('workspace', './pages/workspace/index.tsx')`（受 layout 包裹）。
- 登录成功落地、`/` 重定向由 `/chat` 改为 `/workspace`（`login/index.tsx:235`、`pages/index.tsx`）。

### F1.2 chat 页项目参数联动（0.5 天）

- `pages/chat/index.tsx` 的 clientLoader 读取 `?workspaceId=`：有值则选中该项目（优先级高于 store 兜底）；store 中当前 workspace id 需持久化（zustand persist partialize 放开该字段，`store/index.ts:65-69`）。
- 现有"列表变化自动选中第一个"的 useEffect 调整为仅在无选中且无 URL 参数时兜底。

### F1.3 工作台页骨架（1.5 天）

按原型 03/04 搭 `pages/workspace/index.tsx`（此前 WIP 已废弃，重写）：

- 补齐三个依赖：`components/workspace-modal/`（05/05b：五字段表单，编辑态回填 + 左下删除入口）、`utils/time.ts`（`formatRelative`）、`api/workspace` 扩展（stats / detail / 新字段类型）。
- 复用已有 `components/status-pill`。
- 骨架范围：列表渲染、筛选胶囊、统计卡、空态、新建/编辑弹窗**打通真实接口**——本阶段即含项目 CRUD 主链路（它属于"框架能跑"的最小集）；**状态流转、搜索、计数等增强项留给 F2**。

### F1.4 chat 页三栏骨架（1.5 天）

按原型 06 搭结构、不填内容：

- 中栏头部：项目名 + 目标 + 模型 chip（占位）。
- 右栏 `components/project-context/`：项目卡（状态/模型/目标/背景）+ 会话与沉淀区的**占位空态**（"Coming next"式，非营销文案）。
- 左栏由"workspace 列表"改为项目列表入口（返回工作台）+ 当前项目信息；多会话列表不做。

**F1 阶段合计约 4 人日。G2 达成后进入 F2。**

## 5. 阶段 F2：前端功能项（价值排序）

### P0 主链路体验（约 3 天）

| 项 | 内容 | 涉及 |
| --- | --- | --- |
| 项目状态流转 | 归档 / 恢复 / 暂停操作组；删除二次确认带后果文案（"项目下的会话与笔记将一并移除"）；仅归档态可删 | workspace 页 |
| 工作台搜索与排序 | 页头搜索（B2 的 LIKE 已供数）；卡片显示"N 条对话"（B1/B2 计数方案） | workspace 页 |
| chat 空态引导 | 原型 07：引导标题（含项目名）+ 3 个建议提示词 tag（可先静态配置，后续按项目 goal 生成） | chat 页 |
| 登录体验补齐 | 登录表单补邮箱格式校验（对齐注册强度）；服务端错误文案中文化（`user.js` 的英文 BadRequest）；成功 toast 场景化 | login / server 文案 |
| 提交态 | 登录/注册/工作台弹窗提交按钮 loading + 禁用 | 全局 |

### P1 设置与联动（约 3 天）

| 项 | 内容 |
| --- | --- |
| 账户设置页 | 原型 10：账户信息卡（`PUT /user/:id` 已支持本人修改）+ 偏好设置（默认模型接 B3 接口；流式输出开关接 chat 请求参数；紧凑模式先 localStorage） |
| 模型快捷切换 | chat 头部 SwapOutlined 实装（弹层选模型 → `PUT /workspace`）；SettingOutlined 跳模型配置 |
| 重新生成 | 实装消息级"重新生成"（复用上一条 user 消息重发）；若排期紧可先移除该按钮，不留空壳 |
| 笔记库增强 | 列表显示所属项目 + 按项目筛选（B5 供数）；页内"新建笔记"按钮；筛选：全部 / 最近编辑；常用标签点击筛选 |
| 401 修复 | `http/request.ts:38-40` 跳转前 `clearUser`，避免过期 user 残留 store |

### P2 沉淀与打磨（约 2.5 天，可裁剪）

| 项 | 内容 |
| --- | --- |
| 右栏沉淀内容 | `project-context` 实装：关联笔记列表（`note.workspaceId`）+ "存为笔记"会话级入口（补充而非替换现有消息级/划选/AI 自动保存） |
| 上下文注入透出 | B7 完成后，空态文案与右栏体现"已注入项目目标与 N 条沉淀" |
| 骨架屏铺开 | 列表/卡片加载态按原型 15 规范补齐（workspace 列表、笔记库、admin 三页） |
| 会话状态胶囊 | 流式中/已中断标识（chat 页 SSE 生命周期已有信号，纯前端） |

**F2 合计约 8.5 人日。**

## 6. 决策记录与风险

### 6.1 status 枚举：整数 0/1/2（已决）

[frontend-workspace-redesign-dev-doc.md](./frontend-workspace-redesign-dev-doc.md) §6 写的是字符串枚举（`active/paused/archived`）。本计划改为 **TINYINT 0/1/2**：与已实现的 `status-pill` 组件、撤出的 spec 测试（`status=3 → 400`、`status=2 归档`）、库内既有惯例一致。**实现时需回改该文档 §6，避免后续误导。**

### 6.2 风险

| 风险 | 应对 |
| --- | --- |
| 本机无 MySQL/Redis，测试静默 skip | B0 约定测试环境（Docker compose 或本机实例）；CI 若引入，把"全 skip"视为失败 |
| `chat_count` 冗余列与写放大 | 优先 stats 接口实时聚合，数据量小；冗余列仅作备选 |
| F1 重写工作台页时旧 WIP 已删无可参考 | 以原型 03/04/05/05b + 本计划 F1.3 清单为准；首轮审查报告中有 WIP 的结构记录 |
| B4 回退改变 `POST /workspace` 既有语义（原必须传 modelId？） | 实测现状：不传 modelId 可创建（model_id NULL）；B4 只是让 NULL 场景更可用，无破坏 |
| 前端在 G1 前抢跑导致契约返工 | 以阶段门约束；接口字段以 B 阶段测试为准（测试即契约） |

## 7. 里程碑与总量

| 里程碑 | 内容 | 累计 |
| --- | --- | --- |
| M-B | G1：后端全绿 | ~5.5 人日 |
| M-F1 | G2：框架可导航、工作台主链路可用 | ~9.5 人日 |
| M-F2a | P0：项目全生命周期 + chat 空态 + 登录体验 | ~12.5 人日 |
| M-F2b | P1：设置页 + 快捷切换 + 笔记库 | ~15.5 人日 |
| M-F2c | P2：沉淀右栏 + 打磨（可裁剪到下批） | ~18 人日 |

按既有节奏（每天 2~3 小时）折算约 **7~9 周**；P2 可整体顺延。

## 8. 每阶段验收口径

- **B**：spec 测试（B0 恢复的 14 例）+ 新增 stats/detail/设置接口各补至少 1 例；`init.sql` 重建库后测试仍绿。
- **F1**：对照原型 03/04/05/05b/06 骨架截图走查；`/workspace` 全链路（登录→工作台→新建项目→进 chat→返回）手工回归。
- **F2**：对照原型 06/07/08/10/15 逐项走查；上一轮差距报告中的「建议对齐」清单逐项勾销；`pnpm build` + 全量测试绿。
