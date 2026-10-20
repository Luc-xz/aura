# AGENTS.md

Aura 的常驻协作规则。改代码前先读 [docs/architecture.md](docs/architecture.md)；要写决策记录时按 [.agents/notes/README.md](.agents/notes/README.md) 的格式。

## 约定

- 后端是 ESM JavaScript（`server/`），前端是 TypeScript + React（`interface/`）；不要给后端引入构建步骤。
- 错误一律走 `server/utils/appError.js` 的 `AppError` 与快捷构造器，由全局处理器转成 `{ code, message }`；不要在 handler 里手写 `res.status(4xx)`。
- 异步路由处理器套 `asyncHandler`，否则抛出的错误到不了错误处理器。
- 成功响应保持 `{ data, code, message }` 信封，`code` 与 HTTP 状态码一致。
- 访问单条资源时挂 `requireOwnership({ resource })`；新增资源类型要同时扩展 `rbac.js` 的 `RESOURCE_SQL`，否则越权检查会静默缺失。
- 查询参数排序字段走各 model 的白名单（`sortColumns` / 显式数组），不接受原样拼接的列名。
- 数据库字段 snake_case，`formatResponse` 统一转 camelCase 后返回；例外要显式归一化并在同一变更内修掉调用方。
- 前端请求通过 `http/request.ts`，返回 `[error, data]` 元组；不要用 try/catch 捕获 axios 异常。
- 注释只写代码表达不了的约束——行为、失败方式、归属、时序。不复述代码，不叙述推理过程。
- 测试描述行为；行为变更时连同测试一起改。
- 文件以一个换行结尾。

## 决策记录

- **非平凡改动在同一变更内新增或更新一条 Agent Note**；纯机械或局部改动豁免。记录"为什么"和"放弃了什么"——见 [.agents/notes/README.md](.agents/notes/README.md)。
- 一个事实一个家：取舍理由在 Agent Note，当前行为在代码，常驻规则在本文件，扫描范围在 [scripts/governance-config.ts](scripts/governance-config.ts)。互相链接，不重复。
- 文档随代码走：受影响的 README 与注释在同一变更内更新。
- `docs/product-roadmap.md` 是向前看的产品规划，`docs/architecture.md` 是向后看的系统现状；不要把计划写进架构文档，也不要把现状写进路线图。

## 检查

- 推送前跑 `pnpm test:docs`（Markdown 链接 + Agent Note 格式）和 `pnpm test:server`（集成测试）。
- `pnpm test:server` 需要隔离的 MySQL 与 Redis：先执行 `.\server\scripts\start-test-services.ps1`，或自行按 `server/test/README.md` 准备。测试会 DROP 表并 FLUSHDB，绝不要指向开发库。
- 证据要对得上改动面：只改文档就不必跑后端测试；改后端就必须跑，且如实报告失败，不用 skip 掩盖。
- 能机械检查的不变量写进 gate，并验证 gate 会拒绝一个非法样例。

## 历史

- 独立改动分开提交；引入问题的提交先修再往后传。
- 改写历史用 `--force-with-lease`，远端有移动就中止；不允许裸 `--force`。
- 提交信息前缀沿用现有习惯：`feat` / `fix` / `refactor` / `test` / `docs` / `chore` / `rm`，必要时带作用域如 `feat(interface):`。

`CLAUDE.md` 指向本文件。
