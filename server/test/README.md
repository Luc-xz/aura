# 后端集成测试

## 安全约定

这些测试会 **DROP/TRUNCATE `aura_test` 中的表，并对测试 Redis 执行 FLUSHDB**。
不要连接开发、共享或生产 Redis；键前缀不能限制 FLUSHDB 的清理范围。
每个测试文件串行执行。同一套测试服务不能同时运行两个测试进程。

测试配置只从 `server/.env.test.local` 或显式 `TEST_*` 环境变量读取，不继承开发连接。
必须设置 `TEST_ALLOW_RESET=aura_test`，缺少配置、服务不可用或数据库名称不符时直接失败。
数据库需提前创建；测试账号只需拥有 `aura_test.*` 权限，不应拥有业务库权限。
`.env.test.local`、`.test-services.local/` 均被现有 `*.local` 规则忽略，不提交凭据和数据。

## Windows 本机环境

已安装 MySQL（mysqld）和 Redis（redis-server）时，在仓库根目录执行：

```powershell
.\server\scripts\start-test-services.ps1
```

脚本创建工作区内的独立数据目录、测试专用密码和 `.env.test.local`：

- MySQL：`127.0.0.1:13306`，库 `aura_test`，账号 `aura_test`。
- Redis：`127.0.0.1:16379`，独立实例，无持久化。
- 数据及日志：`.test-services.local/`。

后台服务以隐藏窗口启动。服务已运行时不需要再次启动；脚本会拒绝使用已占用端口。
可以用 `-MySqlServer`、`-RedisServer` 指定可执行文件路径，也支持 Scoop shim。
脚本不会修改系统服务或启动 Docker，不修改现有 MySQL 数据目录。

其他平台或 Docker 用户可自行准备独立服务，然后复制 `server/.env.test.example` 到
`server/.env.test.local` 并填写配置。不要覆盖已经生成的本地配置。

## 运行

```powershell
# 仓库根目录：全量
pnpm test:server

# workspace/chat 定向
pnpm --filter aura-server exec vitest run test/workspace.test.js test/chat-happy-path.test.js

# 监听（不要同时再启动另一个测试进程）
pnpm test:server:watch
```

若当前 Windows 启动器带入重复 PATH/Path，导致 pnpm 找不到已安装的 vitest，可在 server 目录直接执行：

```powershell
node node_modules/vitest/vitest.mjs run
```

不会调用真实收费模型：chat happy-path 沿用模拟模型。

## 阶段性红灯

B0 恢复了 `a0eec5c` 的 15 条历史契约测试。恢复后不是全绿：
B1/B2 尚未实现项目字段与统计，B3/B4 尚未实现设置及默认模型回退。
这些用例正常执行并失败，不使用 skip、todo 或 expected-failure 掩盖。

验收记录见 `docs/workspace-redesign-b0-baseline.md`。后续阶段应逐步消除对应红灯，
不能把“B0 验收完成”等同于“G1 后端就绪”。
