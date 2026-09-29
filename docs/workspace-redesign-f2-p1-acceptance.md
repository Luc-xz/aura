# 工作台改造 F2-P1 实施与验收

日期：2026-09-29。承接 F2-P0（`a956aae`）。本轮完成执行计划 §5 P1「设置与联动」全部 5 项。

## 1. 本轮内容

- **账户设置页**（`pages/setting/index.tsx` 重写，原型 10）：账户信息卡（用户名/邮箱本人修改，
  `PUT /user/:id`，成功后同步 store 使侧边栏即时更新）+ 偏好设置（默认模型接 B3
  `GET/PUT /api/user/settings`，新建 `api/user-settings`；流式输出开关切换 chat 发送路径；紧凑模式
  挂 `<html>.compact-mode`，`root.tsx` 启动时恢复，CSS 收紧会话间距）。本地偏好存
  `localStorage:aura-preferences`（`utils/preferences.ts`）。
- **模型快捷切换**（chat 头部）：SwapOutlined 接 Dropdown 弹层（当前模型打勾）→ `PUT /workspace`；
  SettingOutlined 跳 `/setting/model-config`。走查发现并修正：PUT 只回布尔，最初 `setWorkspace(res.data)`
  把 store 污染为 `true`，改为本地合并 `modelId/modelName`。
- **重新生成**：ChatPanel 发送逻辑重构为统一 `send(content, base)`（流式/非流式由偏好决定，`base`
  支持基于截断历史重建）；重新生成按钮仅出现在最后一条助手消息且非加载态，点击截断至其前 user 消息并重发。
- **笔记库增强**（`pages/note/index.tsx` 重写）：卡片显示所属项目（B5 `workspaceTitle`，未关联显示灰字）；
  所属项目筛选（Select，`workspaceId` 过滤）+ 全部/最近编辑（`orderBy created_at/updated_at DESC`）；
  关键词标签点击即筛选（preventDefault 阻止卡片跳转，可与项目筛选组合）；页内「新建笔记」按钮跳
  `/note/edit`；空态引导；编辑时间改 `formatRelative`。走查发现并修正：clientLoader 对
  `Promise.all` 内 `[err,res]` 元组的解构层次写错，workspaces 恒为空。
- **401 修复**：`http/request.ts` 401 跳转前 `clearUser()`，过期 token 不再残留 store。

## 2. 验证记录

- `pnpm build` ✓；lint 仅存量 `vite.config.js` no-undef 两条；服务端本轮零改动（未动后端代码）。
- 真机走查（隔离 MySQL/Redis，walk4/member，SQL 预置双模型、项目、4 条会话、2 条笔记）：
  - 设置页：账户回填正确；改名保存 → toast + 侧边栏即时更新；默认模型保存 ✓；流式/紧凑开关写
    localStorage、`compact-mode` class 即时生效。
  - B4 回归：设置默认模型为 Mock B 后，新建项目不选模型 → 卡片显示 Mock 模型 B。
  - chat：4 条历史加载；重新生成 → 截断正确（保留第一条问答、重发第二条 user）+ `POST /api/chat/4`；
    模型切换 → toast + 头部 chip/右栏三处同步 Mock 模型 B；非流式路径（stream:false）请求正常发出；
    SettingOutlined → `/setting/model-config`。
  - 笔记：所属项目 tag + 未关联灰字；项目筛选（请求带 `workspaceId=4`，剩 1 条）；标签点击
    「已按「架构」筛选」且与项目筛选组合（`workspaceId=4&keyword=架构`）；新建按钮 → `/note/edit`。
  - 401：token 改坏 → 打开页面自动跳 `/login` 且 user-store 清空。
  - console 无新增报错。

## 3. 已知边界

- 模型切换后左栏项目列表的 `modelName` 展示在下次列表刷新前是旧值（头部 chip 与右栏已即时同步）。
- 流式开关切换只影响后续发送；重新生成对「最后一条已完成消息」语义最准，流式中断消息重发会在库里
  留下已持久化的旧消息（前端展示正确）。
- mock 模型 baseUrl 不可达，走查中消息发送的流式内容无法端到端验证（请求路径与 UI 行为已验证）；
  真实模型回归留待有 key 的环境。

## 4. 下一步

F2-P2：右栏沉淀实装（关联笔记列表 + 存为笔记入口）、上下文注入透出、骨架屏铺开、会话状态胶囊。
