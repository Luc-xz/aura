# 工作台改造 B1/B2 实施与验收

日期：2026-09-23。B0 已提交：`352ae57`（`test(server): establish isolated workspace redesign B0 baseline`）。本记录区分阶段验收和 G1 全量准出，不把预期红灯当成通过。

## 1. 本轮边界

- B1：项目字段迁移、初始化表结构及索引一致性。
- B2：项目字段写入、详情、列表筛选/搜索/排序、统计与实时消息计数。
- 补齐 B2 对应的服务端生命周期约束：消息落库更新推进时间，已归档项目事务删除。
- 没有实现 B3/B4 用户设置及默认模型回退，没有进入前端阶段。
- 没有继续改造测试初始化、服务启动脚本或环境配置；没有执行开发库/生产库迁移。

## 2. B1 数据库契约

迁移：`server/sql/migrations/20260924_alter_workspace_project_fields.sql`（文件名沿用执行计划）。

| 字段/索引 | 约定 |
| --- | --- |
| goal | VARCHAR(255)，可为 NULL |
| description | VARCHAR(2000)，可为 NULL |
| status | TINYINT NOT NULL DEFAULT 0；0=进行中、1=暂停、2=已归档 |
| idx_workspace_user_status | workspace(user_id, status) |
| idx_chat_workspace_created | chat(workspace_id, created_at) |

**不增加 `chat_count` 冗余列**。列表/详情中的 `chatCount` 实时 COUNT chat 记录，包含用户和助手消息；一次正常问答通常增加 2，而不是增加 1 个“会话”。

迁移测试在隔离的 `aura_test` 中重建旧版 workspace/chat 表、插入旧数据、执行迁移，再比较字段和索引与新 init.sql 的结果；验证旧项目、模型绑定和消息仍存在，新字段默认值正确。

部署注意：已有库备份后明确选择目标库，只执行该迁移一次；新库按新 init.sql 初始化后不再执行此迁移。MySQL DDL 不能依靠应用事务回滚，失败需检查实际 schema 后恢复/续跑，不要盲目重跑整个文件。**本轮没有操作业务库。**

## 3. B2 接口契约

| 接口 | 行为 |
| --- | --- |
| POST /api/workspace | title 非空白，最多 255；goal 最多 255；description 最多 2000；status 缺省 0 |
| PUT /api/workspace/:id | 只更新提供的字段，status=0 不丢失；goal/description 空串或 null 清空；modelId=null 解除挂载；无有效字段返回 400 |
| GET /api/workspace/list | 当前用户项目；status 过滤；title 子串搜索；默认 updated_at DESC、id DESC；保持 data 数组 |
| GET /api/workspace/:id | 返回详情、模型显示字段和 chatCount；未认证 401、他人项目 403、不存在 404；保留 super_admin 管理规则 |
| GET /api/workspace/stats | active/paused/archived/advancedThisWeek，全部为数值，空集合返回 0 |
| DELETE /api/workspace/:id | 仅归档态可删，否则 409；在一个事务中删除关联笔记、消息、项目 |

补充说明：

- 写入 status 为 JSON 整数 0/1/2；列表 query 的 status 为 "0"/"1"/"2"，全部状态时省略，不传 `all`。
- 详情及更新/删除的 ID 必须为正安全整数，非法值返回 400。
- 排序白名单：title、created_at、updated_at；方向 ASC/DESC。title 中的 `%`、`_`、`!` 为字面量，不允许通过搜索输入扩大 LIKE 匹配。
- advancedThisWeek 为当前用户在数据库 NOW()-7天 至 NOW()（含边界）有消息的去重项目数，涵盖全部状态，不是自然周，不按消息条数累计，不包含未来时间记录。
- 模型配置绑定仍校验项目属主；不向项目响应暴露模型凭据。
- 每次 Chat.create 使用事务插入消息并更新 workspace.updated_at；与项目删除使用同一项目行锁协调，避免删除期间新增孤儿消息。不会在模型推理期间长期持有事务。
- 删除状态在事务锁内再次检查；回归测试通过外键约束注入末步删除失败，再从 HTTP 验证项目、笔记、消息计数均保留，确认前面的子表删除可回滚。该故障注入不要求提高测试账号权限。
- 原删除成功测试的建项目 fixture 调整为 status=2，这是产品规则的有意变更，不是移除原有权限测试。

## 4. 验证结果

| 检查 | 结果 |
| --- | --- |
| workspace.test + workspace-project.test + workspace-migration.test | **66/66 通过，0 跳过** |
| 全量后端测试 | **185 条：183 通过、2 失败、0 跳过** |
| 原有 131 条基线用例 | 全部仍通过，无新增回归；删除成功 fixture 按归档新规则调整 |
| 新增覆盖 | 37 条项目 API 用例 + 1 条迁移一致性 + 1 条消息推进时间，共 39 条 |
| git diff --check | 通过 |
| 修改/新增 JS 文件 node --check | 通过 |

B0 的 13 条 workspace 恢复用例现已全部通过。仅余两条默认模型回退用例失败，当前失败点均是 `PUT /api/user/settings` 返回 403（尚缺静态 settings 路由，落入旧用户 ID 路由），归属 B3/B4，未用 skip/expected-failure 掩盖。

红→绿过程：迁移文件缺失导致迁移测试红灯后补实现；读取契约最初 17 条失败后补详情/查询/统计；消息推进时间及未归档删除、笔记级联删除先红后绿；另补数据库失败场景验证删除事务回滚。

**结论：B1/B2 代码与隔离集成测试完成；G1 尚未达成，不能把此次定向全绿当作整个 B 阶段全绿。** 后续继续 B3/B4，并按执行计划完成 B 阶段剩余任务及业务环境联调。

报告：`.test-services.local/b1-b2-targeted.json`、`.test-services.local/b1-b2-full.json`。测试报告写入被忽略目录，不提交日志、凭据和本地数据库文件。

## 5. 手动复跑

前提：已按 `server/test/README.md` 准备专用测试服务和 `.env.test.local`。测试会重建 aura_test 并清空专用 Redis，禁止指向业务服务，也不要同时启动两个测试进程。

在仓库根目录：

```powershell
# B1/B2 workspace + 迁移定向验证
pnpm --filter aura-server exec vitest run test/workspace.test.js test/workspace-project.test.js test/workspace-migration.test.js

# 全量；B3/B4 未实现前仍应有两条红灯
pnpm test:server
```

遇到本机 PATH/Path 重复导致 pnpm 找不到 Vitest，可在 server 目录直接运行：

```powershell
node node_modules/vitest/vitest.mjs run test/workspace.test.js test/workspace-project.test.js test/workspace-migration.test.js
node node_modules/vitest/vitest.mjs run
```

消息推进时间测试位于 `chat-happy-path.test.js`，全量回归会覆盖；该文件同时保留两条尚未实现的默认模型回退测试。
