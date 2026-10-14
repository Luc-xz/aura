# 设计稿对齐 D6 验收记录（方案 B 转正对齐）

> 日期：2026-10-14
> 阶段：D6 方案 B 转正对齐（原型决策 `094e634`——双方案策略结束，入口六屏重画、方案 A 归档）
> 结论：**通过**（01/02/03/04/05/05b 六屏 1440×900 并排比对通过；build/lint 绿；全路由走查无业务报错）

## 背景

设计侧 2026-10-14 决策「方案 B 全面转正」：产品语言统一为浅色 + 三栏沉浸式。原型变更——
入口六屏全部重画为方案 B 版（`01-login-B` / `02-register-B` 浅色品牌区、`03-workspace-B` / `04-workspace-empty-B` B 左栏 + 项目网格、`05-new-project-B` / `05b-edit-project-modal-B` 弹窗，默认模型标「规划中」），方案 A 六屏移入 `archive/`。

## 交付内容

| 变更 | 落点 | 结果 |
| --- | --- | --- |
| 路由收敛：workspace 迁挂 B 外壳 | `routes.tsx` + 删除 `components/shell/rail-a/` | 通过：`/workspace` 与 `/chat` `/note` `/setting` `/admin/*` 同壳；rail-a、`ProjectSidebar` 默认导出（260px 侧栏 + 新建钮）、`CREATE_WORKSPACE_EVENT` 链路、rail/sidebar/btn-block/counter 死样式、`AdminIcon` 一并退役 |
| modnav 工作台语义 | `components/shell/leftbar-b/index.tsx` | 通过：入口指向 `/workspace`；激活态覆盖 `/workspace`（原型 03 data-key=workspace）与 `/chat`（原型 06 data-key=chat），实测网格页 ⇄ 推进页互切高亮正确 |
| 侧栏选中态分路由 | `LeftbarProjects` | 通过：网格页无项目选中（原型 03），推进页默认首项高亮（原型 06） |
| 01/02 浅色品牌区 | `pages/login/index.tsx` + `aura.css` | 通过：`auth__brand--light`（`linear-gradient(165deg,#f8fbff→#ecf3fc)` + 右描边 + ink 文字、预览行 `#eef2f7`、sh-md 阴影）；logo 加「自主体验」标签；caption「登录后进入项目工作台」；登录副文案断行对齐 |
| 03/04 工作台主区容器 | `pages/workspace/index.tsx` | 通过：补自带 `.main`（新增 `.main--scroll` 变体保滚动，原由 rail-a 外壳提供）；页头副标题对齐原型「选一个项目继续推进……」 |
| 05/05b 弹窗默认模型规划中 | `components/workspace-modal/index.tsx` | 通过：label 加 `pill--sm pill--info`「规划中」，控件为 `input--filled` 静态展示（新建显账户默认模型名，编辑显已挂载模型名，无则「未设置」）；`toWorkspacePayload` 不再传 modelId——新建走账户默认模型回退（B4），编辑保存不动既有挂载 |

## 已知偏差（新增，登记执行计划 §6）

| 项 | 处理 |
| --- | --- |
| 05/05b「默认模型」项目级选择 | 原型标注「规划中」：弹窗仅禁用展示，后端 modelId 字段与接口保留（取代原 2026-10-13「label ⓘ 图标」条目） |
| 05b 编辑中项目左栏高亮 | 原型示意态；实现左栏选中由「当前进入的项目」驱动，不与编辑动作联动 |
| 03 筛选行右侧「最近更新 + 搜索」 | 沿用 2026-10-13 登记：保留 F2 功能 |

## 验证

| 项 | 结果 |
| --- | --- |
| `pnpm --filter aura-interface build` / `lint` | 通过 |
| 六屏并排比对（01/02/03/04/05/05b） | 通过：存档 `docs/design-alignment/screenshots/d6/`（impl / proto / pair）；06 推进页外壳回归无变化 |
| 交互冒烟 | 登录 → 网格页 → 卡片「继续推进」→ 推进页 → modnav「工作台」回网格页 ✓；新建/编辑弹窗字段与默认模型展示 ✓；注册 → 空态工作台（04）✓；卡片归档/删除/状态流转入口不变 ✓ |
| 全路由走查（11 条） | 无业务 console 报错（`/note/edit` 存量 controlled-input 提示与本阶段无关） |

## 验收数据清理

临时账号 `d6empty`（仅用于 04 空态验证）已删除，库核对恢复基线（user 2）。
