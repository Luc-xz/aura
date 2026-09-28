# 工作台改造 F1 实施与验收

日期：2026-09-28。承接 B0–B7（`352ae57`、`c339848`、`ae4576e`、`e4311d6`）。本轮完成执行计划 §4 的
F1.1–F1.4，前端框架阶段收口，**G2 门槛达成**。

## 1. 本轮边界

- F1.1：`/workspace` 路由注册（layout 内、Chat 之前）；`/` 与登录成功落地由 `/chat` 改为 `/workspace`；
  `ICON_MAP` 补 `AppstoreFilled`（B6 菜单种子的 icon），侧边栏死链消除。
- F1.2：chat 页 clientLoader 读取 `?workspaceId=`，选中优先级 **URL 参数 > store 持久化 > 兜底首个**；
  `useWorkspaceStore` 接 persist（`workspace-store`，partialize 仅 workspace 字段）；手动切换项目时清掉
  URL 参数，避免列表刷新后旧参数反选。
- F1.3：新增 `pages/workspace/index.tsx`（页头 + 统计卡 + 状态筛选胶囊 + 项目卡片网格 + 双空态 + CRUD
  主链路）、`components/workspace-modal/`（五字段表单：名称必填/目标 255/背景 2000/状态/模型留空走 B4
  默认回退；编辑态回填 + 左下删除入口）、`components/status-pill/`（Tag 胶囊 + 圆点 class + 枚举常量）、
  `utils/time.ts`（`formatRelative`）、`api/workspace` 类型化扩展（stats/detail/list params/payload）。
- F1.4：chat 页三栏——左栏改为项目列表入口（返回工作台 + 新建项目 + 状态圆点列表，移除旧「编辑/删除对话」
  下拉）；中栏头部改为项目名 + 状态胶囊 + 目标摘要 + 模型 chip（Swap/Setting 仍为占位，实装在 P1）；
  右栏 `components/project-context/`：项目卡（目标/背景/模型/状态）+ 关联笔记/项目结论/待办事项/项目记忆
  四个「功能准备中」占位。
- 删除入口带后果文案的二次确认（「会话与笔记将一并移除」）；仅归档可删由后端 409 兜底，状态流转操作组
  （归档/恢复/暂停快捷按钮）仍留 F2-P0。

## 2. 实现要点

- `toWorkspacePayload`（workspace-modal 导出）：新建时空 `modelId` 不传键（触发 B4 默认模型回退），
  编辑时清空传 `null`（解除挂载），两页共用。
- 首帧对账（渲染期）：chat 页挂载时若持久化的项目已不在列表（被删），先置空再渲染，避免 ChatPanel 带脏
  id 发起 `chat/list/:id` 404 并触发全局错误 toast；对账 ref 只在首轮生效，不影响「新建后立即选中」。
- URL 参数消费一次（ref）：参数选中后不再压制后续选择；参数无匹配时回退 store 选择 → 兜底首个。
- 空列表时清空选中（含持久化残留），中栏显示「未选择项目」引导。

## 3. G2 准出对照

| 标准 | 结果 |
| --- | --- |
| 全部路由可导航、无死链 | ✓ `/workspace` 注册；B6 菜单「工作台」（sort 0）可点击；`/`→`/workspace`→登录守卫链路走通 |
| 工作台页真实接口渲染（含空态） | ✓ 空态「还没有项目，创建第一个项目开始推进」+ 新建按钮 |
| chat 页可接收 `?workspaceId=` | ✓ 「继续推进」跳转 `/chat?workspaceId=1`，左/中/右三栏均选中该项目 |
| `pnpm build` | ✓ 12.5s 通过 |
| lint | 仅 `vite.config.js` 两条既有 no-undef（stash 验证与本次无关），新增代码零告警 |
| 无 console 报错 | 新增代码无报错；既有基线：登录页隐藏 Form.Item 的 antd 警告、React 19 兼容提示、antd Menu `info.item` 弃用警告（均在未改动代码中） |

## 4. 真机走查记录

环境：隔离 MySQL（13306）/Redis（16379）`start-test-services.ps1`；API server 以环境变量指向
`aura_test` 起在 3000；vite dev 5173（`/dev-api` 代理）。走查账号 `walk1@aura.test`（member 角色，
RBAC 种子上次测试后被清空，本轮手动补齐 role/menu/role_menu）。

登录 → 工作台空态 → 新建项目（五字段）→ 统计卡实时变（进行中 1）→「继续推进」进 chat（URL 参数选中、
右栏项目上下文完整）→ 无参刷新（workspace-store 持久化生效）→ 返回工作台 → 编辑改状态「暂停」（回填正确、
统计与胶囊联动）→ 筛选胶囊（进行中→过滤空态；暂停→可见）→ 归档 → 删除（二次确认带后果文案）→ 回到空态、
统计归零。全程无新增 console/页面错误。截图：`.test-services.local/f1-workspace-empty.png`、
`f1-chat-three-column.png`。

## 5. 遗留与移交 F2 的事项

- 中栏 SwapOutlined（模型快捷切换）、SettingOutlined（跳模型配置）仍为占位，P1 实装。
- chat 会话区空态引导（原型 07）、卡片「N 条对话」（chatCount 已随接口返回，未展示）在 P0。
- 搜索、排序、归档/恢复/暂停快捷操作组在 P0；401 清 store 修复在 P1。
- 删除未归档项目时后端 409 文案为英文（`archive the workspace before deleting it`），P0 一并中文化。
- 既有基线 console 警告（Form.Item/React 19/Menu info.item）建议在 P2 打磨阶段统一处理。

## 6. 手动复跑

前提同 B 阶段验收（隔离 MySQL/Redis）。仓库根目录：

```powershell
.\server\scripts\start-test-services.ps1   # 服务已运行则跳过
```

`server` 目录起 API（指向测试库，密码见 `.test-services.local/services.json`），`interface` 目录 `pnpm dev`，
浏览器访问 `http://localhost:5173`，按 §4 流程走查。

## 7. 下一步

进入 F2-P0：项目状态流转操作组、工作台搜索与排序、卡片对话计数、chat 空态引导、登录体验补齐、提交态。
