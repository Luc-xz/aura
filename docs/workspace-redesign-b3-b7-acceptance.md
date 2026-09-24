# 工作台改造 B3–B7 实施与验收

日期：2026-09-24。承接 B1/B2（`c339848`、`ae4576e`）。本轮完成执行计划 §3 的 B3、B4、B5、B6、B7，
后端阶段（B0–B7）全部收口，**G1 门槛达成**。

## 1. 本轮边界

- B3：`GET/PUT /api/user/settings`（首个 user_settings 端点），第一版只接 `defaultModelId`，
  `systemPrompt / autoSaveInterval / language` 透传存取。
- B4：默认模型回退两处——`POST /api/workspace` 不传 modelId 时创建即落地用户默认模型；
  `chat.js` 对未挂模型的存量项目回退用户默认模型，仍无则中文 400。
- B5：`Note.findAll` LEFT JOIN workspace 附带 `workspaceTitle`（workspaceId 原已有）；
  keyword 搜索范围扩到 keywords 字段。
- B6：菜单种子新增「工作台」（id=2，code=workspace，/workspace，sort_order 0 置于 Chat 前），
  member/admin 显式授权，super_admin 由全菜单策略覆盖。
- B7：项目 goal/description 拼接进 system prompt（`NOTE_TOOLS_SYSTEM_PROMPT` 之后），
  未设置时不加段落；关联笔记摘要注入仍为远期。
- 未进入前端阶段（F1 从 G2 开始）；未操作开发库/生产库，迁移仅在隔离测试库验证。

## 2. 契约要点

### B3 设置接口

| 接口 | 行为 |
| --- | --- |
| GET /api/user/settings | 无存量行返回默认值 `{defaultModelId:null, systemPrompt:null, autoSaveInterval:0, language:'zh-CN'}`，不落库 |
| PUT /api/user/settings | 按字段是否提供部分更新；defaultModelId 正整数或 null（null 清空）；模型必须存在且属于本人（404/403）；空 body 400 |

- 静态 `/settings` 路由注册在 `/:id` 之前，修复原先 403 落入用户 ID 路由的问题。
- schema 变更：`default_model_id` 改为可空（清空语义需要），`user_id` 加唯一键支撑 upsert
  （`ON DUPLICATE KEY UPDATE`，避免读-改-写竞态）。此前该表零端点零写入，不存在重复行。
- `systemPrompt` 空串清空、上限 65535；`language` 上限 20；`autoSaveInterval` 非负整数。

### B4 默认模型回退

- `POST /api/workspace`：`modelId` 未提供（undefined）时读用户默认模型**创建时落地**；
  显式 `null` 仍表示不挂载；默认配置已被删除则按无模型创建，不阻塞建项目。
- `chat.js`：项目未挂模型时回退**操作者**的用户默认模型（super_admin 代管时用其自己的默认）；
  默认配置已删除视为未配置。挂载了但配置被删维持原 404。两处都不做冗余归属复查——
  设置写入时已校验归属，删除场景由 findById 落空覆盖（与 ae4576e 的精简方向一致）。
- 无任何模型时 400 文案：`当前账号未配置默认模型，请先在偏好设置中选择，或为项目挂载模型`。
- 遗留列 `use_default_model`（B1 前即存在、恒为 1）未参与逻辑，回退语义即其目标态。

### B5 笔记关联项目

- `SELECT note.*, workspace.title AS workspace_title FROM note LEFT JOIN workspace ...`；
  workspace 与 note 存在同名列（user_id/created_at/updated_at/title），WHERE/ORDER BY 全部限定表名。
- 分页排序白名单改为限定列（`note.title` 等），无效排序字段由原先 pager 内部 Error 改为 400
  `invalid note sort`（对齐 workspace 模型口径）；默认排序行为不变。
- keyword 检索扩为 `title OR description OR CAST(keywords AS CHAR)`，与 findByKeywords 同口径；
  未新增 LIKE 通配符转义（维持现状，非本轮范围）。

### B6 菜单种子

- init.sql 与迁移 `20260924_seed_workspace_menu.sql` 两处同步；业务 ID 段取 2，icon 存
  `AppstoreFilled`（前端 ICON_MAP 命中渲染在 F1 接线，未命中仅无图标不报错）。
- 存量库按 20260903 → 20260924_seed 顺序执行即达一致终态；未改历史迁移文件。

### B7 上下文注入

- 拼接格式：`NOTE_TOOLS_SYSTEM_PROMPT + "\n\n# 项目上下文\n项目目标：…\n项目背景：…"`；
  goal/description 均未设置时 system prompt 与原值逐字节相等。

## 3. 迁移与 schema

| 文件 | 内容 |
| --- | --- |
| 20260924_alter_user_settings_default_model.sql | default_model_id 可空 + uk_user_settings_user 唯一键，一次性执行 |
| 20260924_seed_workspace_menu.sql | 幂等 INSERT IGNORE：菜单 id=2 + 三角色 role_menu |
| init.sql | user_settings 建表同步上述结构；菜单种子含工作台；member/admin 角色菜单清单 +2 |

一致性测试沿用 B1 模式：`user-settings-migration.test.js` 在隔离库重建 B3 前旧表、跑迁移、
对比 information_schema 与新 init.sql 结果完全一致，且旧数据保留。

## 4. 验证结果

| 检查 | 结果 |
| --- | --- |
| 全量后端测试 | **200/200 通过，0 失败，0 跳过**（18 个文件） |
| 上一轮遗留 2 条默认模型回退红灯 | 全部转绿（B0 的 15 例恢复用例至此全绿） |
| 新增覆盖 | 设置接口 6 例 + 设置迁移 1 例 + 回退边界 3 例 + 中文 400 1 例 + 笔记关联 2 例 + 菜单种子 1 例 + 上下文注入 1 例，共 15 例 |
| init.sql 重建库后全量仍绿 | 是（setup.js 每文件重建库） |
| git diff --check / node --check | 通过 |

G1 准出对照：B 阶段测试全绿 ✓；接口在本地隔离环境经 HTTP 级集成测试走通 ✓；init.sql 与迁移一致 ✓。

报告：`.test-services.local/b3-b7-full.json`、`.test-services.local/b3-b7-full.log`。

## 5. 手动复跑

前提同 [workspace-redesign-b1-b2-acceptance.md](./workspace-redesign-b1-b2-acceptance.md)（隔离 MySQL/Redis）。
在 `server` 目录：

```powershell
node node_modules/vitest/vitest.mjs run
node node_modules/vitest/vitest.mjs run test/user-settings.test.js test/user-settings-migration.test.js test/chat-happy-path.test.js
```

## 6. 下一步

进入阶段 F1（前端框架）：F1.1 路由与入口 → F1.2 chat 页项目参数联动 → F1.3 工作台页骨架 →
F1.4 chat 三栏骨架，达 G2 后开 F2。B6 菜单在 F1.1 前于侧边栏可见但路由未建，属计划内过渡态。
