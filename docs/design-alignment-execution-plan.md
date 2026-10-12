# Aura 工作台 · 设计稿对齐执行计划

> 本计划承接 [workspace-redesign-execution-plan.md](./workspace-redesign-execution-plan.md)（B/F1/F2 已收口）。
> F1/F2 完成的是**功能对齐**——页面以 antd 默认组件 + 全局浅色折叠 Sider 搭建，视觉体系未接入原型设计系统，
> 导致现有前端与原型对比「完全不还原」。本轮把**视觉还原**落成可执行任务。
> 验收基准：`design/prototype/` 原型终稿（commit `67f0847`），开发读取以 HTML 文件为准；
> 数值基准 `design/prototype/tokens.css` / `_src/app.css`，两者冲突时以 HTML 实测为准。
> **本轮零后端改动**，全部任务落在 `interface/`。

## 1. 目标与范围

### 1.1 目标

把现有实现从「antd 默认形态」对齐到原型自定义设计系统，达到逐屏肉眼可判定的一致：

1. 设计令牌落地：主色 `#2266D1`、状态色阶、圆角 6/8/10/12、阴影 xs/sm/md/pop、Inter 字体 13px 正文体系。
2. 布局外壳重构：拆除全局 antd Sider，按方案 A（深色 Rail + 项目侧栏）与方案 B（280px 左栏）分壳。
3. 17 屏逐屏对齐原型结构、密度与状态规范（15 号屏为全局规范）。

### 1.2 本轮不做（沿用既有决策，非视觉缺口）

| 项 | 原因 | 现状处理 |
| --- | --- | --- |
| 项目 → 多会话两级拆分 | 需新表与迁移（上轮已出范围） | 右栏「会话分组」按原型渲染为占位样式 |
| 富文本编辑器 | 远期（上轮已出范围） | 09 格式条按原型**仅视觉渲染**，编辑仍为纯文本 |
| 笔记自动保存 / 用户启停 / 审计日志 | 远期 | 不渲染或按原型占位 |
| 管理端路由 / 权限码迁移 | 上轮已决策沿用现状 | 以现状 `/admin/*` 路由为准做视觉对齐 |
| 响应式严格适配 | 原型锁定 1440×900 画布 | **≥1440 视口严格对齐**；更窄宽度自然回流，不做逐断点规范 |

## 2. 已确认的策略决策

| 决策 | 结论 |
| --- | --- |
| 组件策略 | **混合**：tokens 接入 Tailwind `@theme` + antd `ConfigProvider` 全局主题化；原型特有形态（Rail、模块导航、统计卡、状态胶囊、表格骨架、空态）自研 `components/ui/*`；行为组件（Form / Select / Dropdown / Pagination / @ant-design/x 聊天组件）保留 antd 仅重皮 |
| 验收标准 | **逐屏并排截图比对**：1440×900 视口下实现页与 `design/prototype/NN-*.html` 并排比对，每阶段出验收文档 |

## 3. 差距矩阵（现状 → 原型）

### 3.1 全局差距（影响所有屏）

| 维度 | 现状 | 原型目标 |
| --- | --- | --- |
| 令牌 | `--color-primary:#1890ff`（antd 默认蓝），仅 moon/ashen 两个灰 | `#2266D1` 主色阶 + 状态色（成功 `#2F7D5C`/警示 `#AD6D18`/中性 `#6B7785`/危险 `#C0392B`）+ canvas `#F5F7F9` + 描边 `#DCE3EA`/`#E4EAF0` |
| 字体 | 系统栈，antd 14px 正文 | Inter 栈，正文 13px、标题 22px 收字距、统计数字 tabular-nums |
| 外壳 | 所有页面共用 antd 浅色折叠 Sider（`components/layout`） | 方案 A：72px 深色 Rail（`#18222D` 渐变）+ 260px 项目侧栏；方案 B：280px 左栏（品牌行 + **横排**模块导航 + 项目列表 + 用户栏）；登录无外壳 |
| 按钮 | antd 默认 | 主按钮渐变 + 内高光 + 投影；ghost 带描边阴影；36/32px 两档 |
| 表格/弹窗 | antd 默认 | 表头 44px 浅底、行高 60px hover 反馈；弹窗 560px / 28px 内边距 / sh-pop 阴影 |
| 状态反馈 | antd Tag/Empty/Skeleton 默认 | 胶囊同色描边三态、虚线空态卡、focus ring 3px 主色光环、Toast 浅底同色描边 |

### 3.2 逐屏差距

| 屏 | 现状（文件） | 原型目标 | 关键差距 |
| --- | --- | --- | --- |
| 01/02 登录注册 | 居中 400px antd Card（`pages/login`） | 520px 深色品牌分栏（渐变 165°、logo、headline、mini 预览图）+ 405px 认证卡 | 布局结构、品牌区缺失、输入 38px/圆角 8/focus ring |
| 03/04 工作台 | 白页 + antd Card 网格（`pages/workspace`） | Rail + 项目侧栏 + 84px 统计卡（左 3px 色条）+ 340px 项目卡三列 + 30px 筛选胶囊（选中墨底白字） | 外壳、统计卡形态、卡片密度、空态为虚线卡 |
| 05/05b 项目弹窗 | antd Modal（`components/workspace-modal`） | 560px / 28px 内边距 / 底部右对齐 / 编辑态删除入口 / 遮罩 `rgba(22,32,42,.45)` | 弹窗规格与内表单密度 |
| 06/07 推进页 | 220px 左栏 + 图片头 Card + antd/x 组件（`pages/chat`） | 280 左栏（leftbar-b）/ 60px mid-head / 自定义消息面板 / composer 白卡 + 30px 渐变发送钮 / 320px 右栏含米色结论卡 | 左栏宽度与结构、图片头移除、气泡/回执/引用标签形态、右栏结论卡 |
| 08 笔记库 | 单栏横向图片卡列表，含 alipay 占位图（`pages/note`） | 280 导航筛选栏 / 中列表面板 / 右 300（标签 + 统计 + 最近编辑） | 整页三栏重构；移除外链占位图 |
| 09 笔记编辑 | 无左列表的单栏编辑（`pages/note/edit`） | 260 笔记列表 / 44px 格式条 + 编辑区 / 右 300（属性 + 标签 + 大纲） | 整页三栏重构（格式条仅视觉） |
| 10 设置 | 单栏 Card 堆叠（`pages/setting`） | 280 setnav（分组 + 选中左指示条）+ 主区表单 | 左侧设置导航缺失 |
| 11 模型配置 | Drawer 抽屉 CRUD（`components/model-list`） | 「我的模型」页面：表格 + 默认模型提示条 | Drawer → 页面化 |
| 12–14 管理 | antd Table 默认形态（`pages/admin/*`） | 统一「标题 + 筛选栏 + 表格 + 分页」骨架；13 权限矩阵面板（tree-check + 权限码 + 内置锁标）；14 树形缩进 + 类型徽标 | 表格形态、13/14 专属面板 |
| 15 状态规范 | 未成体系 | 胶囊 / 按钮三态 / 输入三态 / 空态 / 骨架 / Toast / 校验 / 二次确认全套 | 作为 D5 收口规范 |

## 4. 分阶段计划

严格串行，每阶段一个提交，配套 `docs/design-alignment-dN-acceptance.md` 验收记录。
截图存档：`docs/design-alignment/screenshots/dN/`（实现页与原型页成对保存）。

```
D0 设计基座 ──▶ G-D0 ──▶ D1 外壳重构 ──▶ G-D1 ──▶ D2 方案A入口层 ──▶ D3 方案B主体验 ──▶ D4 设置与管理 ──▶ D5 状态规范收口
```

| 门槛 | 准出标准 |
| --- | --- |
| **G-D0** | `pnpm build` + lint 绿；现有页面全局主题可见生效（主色/圆角/字体/密度）；tokens 变量在 Tailwind 与 CSS 双侧可用 |
| **G-D1** | 全部路由在新外壳下可导航、无死链；RBAC 模块可见性正确（member 不见系统管理）；登录态刷新与退出迁移完整；无 console 报错 |
| **G-D2~D4** | 对应屏 1440×900 并排比对通过（结构、色值、字号、间距、状态）；交互回归不破坏 F2 已验收功能 |
| **G-D5** | 15 号屏比对通过；全路由交互状态走查清单勾销；收口文档落盘 |

> 进度：**D0 已完成**（[d0 验收](./design-alignment-d0-acceptance.md)）、**D1 已完成**（[d1 验收](./design-alignment-d1-acceptance.md)）、**D2 已完成**（[d2 验收](./design-alignment-d2-acceptance.md)，截图存档 `screenshots/d2/`）、**D3 已完成**（[d3 验收](./design-alignment-d3-acceptance.md)，截图存档 `screenshots/d3/`）、**D4 已完成**（[d4 验收](./design-alignment-d4-acceptance.md)，截图存档 `screenshots/d4/`）；下一步 D5 收口。

### D0 设计基座（约 1.5 天）

| 任务 | 落点 |
| --- | --- |
| tokens 映射 Tailwind | `interface/src/assets/styles/index.css`：`@theme` 写入原型全套变量（主色阶 / 状态色 / ink / canvas / surface / line / rail；radius、阴影以 CSS 变量挂 `:root`）；移除 `#1890ff` 与 moon/ashen 旧值（同步清理引用处） |
| 移植样式基座 | `design/prototype/_src/app.css` → `interface/src/assets/styles/aura.css`（`@layer components`），剔除原型专用（`.screen` `.stage` `.zoom-hint` `.annotation`）；通用类名 `.btn/.pill/.table/.input` 与 antd `.ant-*` 前缀无冲突，与 Tailwind utilities 共存需验证层序 |
| antd 全局主题 | `interface/src/root.tsx` ConfigProvider：colorPrimary `#2266D1`、borderRadius 8、controlHeight 34、fontSize 13、colorBgLayout `#F5F7F9`、colorBorder `#C6CFD8`、colorBorderSecondary `#E4EAF0`、colorSuccess/warning/error 映射状态色、colorText `#16202A`、fontFamily Inter 栈 |
| Inter 字体 | `pnpm --filter aura-interface add @fontsource-variable/inter`，样式入口 import（离线打包，不走 CDN） |
| ui 原语 | 新建 `interface/src/components/ui/`：`Pill`（项目 3 态 + 会话 3 态，同色描边）、`StatCard`（84px 左色条）、`FilterPill`（30px，选中墨底白字）、`EmptyState`（虚线描边卡）、`SkeletonCard`；主按钮渐变皮肤（`.ant-btn-primary` 渐变 + 内高光 + 投影 CSS 覆盖）与输入 focus ring |

### D1 外壳重构（约 2 天）

| 任务 | 落点 |
| --- | --- |
| 拆全局 Sider | `components/layout/index.tsx` 退役：认证守卫（未登录跳 `/login`）、profile 静默刷新、退出登录逻辑迁入新外壳公用 hook |
| 方案 A 外壳 | 新建 `components/shell/rail-a/`：72px 深色 Rail（32px 渐变 logo、44px 模块图标、选中 `--rail-active`、底部头像）+ 260px 项目侧栏（34px 新建钮、搜索、项目列表选中浅蓝底蓝边框、计数胶囊） |
| 方案 B 外壳 | 新建 `components/shell/leftbar-b/`：280px 左栏（品牌行 28px logo + 「自主体验」标签、**横排** modnav、divider、项目列表、user-bar）；笔记/设置页复用竖排 modnav / setnav 变体 |
| 路由挂载 | `routes.tsx`：`/workspace` 挂 rail-a；`/chat` `/note` `/setting` `/admin/*` 挂 leftbar-b；`/login` 独立无外壳 |
| RBAC 可见性 | rail/modnav 四模块（工作台/笔记/设置/系统管理）沿用 store 中 menus/permissions 过滤；admin 组无权限则整组隐藏 |

### D2 方案 A 入口层（约 2.5 天）

| 任务 | 落点 |
| --- | --- |
| 01/02 登录注册 | `pages/login/index.tsx`：520px 深色品牌区（165° 渐变、logo、headline、mini 预览、caption）+ 405px 认证卡（输入 38px/圆角 8/focus ring）；双态切换沿用 `?type=register`；现有校验与 clientAction 不动 |
| 03/04 工作台主区 | `pages/workspace/index.tsx`：4 枚 84px 统计卡（左 3px 状态色条、22px tabular-nums）；30px 筛选胶囊组 + 搜索/排序控件对齐密度；340px 项目卡（状态点、goal、desc、meta、actions 分隔线、归档变体）；空态 04 居中虚线卡 + 主按钮 |
| 05/05b 弹窗 | `components/workspace-modal/index.tsx`：560px / 28px 内边距 / 底部右对齐 / 编辑态删除入口；遮罩与 sh-pop 对齐；表单字段密度按 `field`/`input` 规范 |

### D3 方案 B 主体验（约 4 天）

| 任务 | 落点 |
| --- | --- |
| 06/07 推进页 | `pages/chat/index.tsx`：左栏换 leftbar-b（280px）；中栏 60px mid-head（**移除 `chat-header-bg.jpg` 图片头**，标题 16px + sub + 30px model-chip + 会话状态 pill）；消息流按原型 class 体系（用户气泡 12/12/4/12 主色浅底、AI 面板 4/12/12/12 白卡、tool-status 虚线条、ref-tag、save-receipt、typing 三点、11px actions）；mid-foot composer 白卡 + 30px 渐变发送钮——@ant-design/x 的 Bubble/Sender/Attachments 保留行为，外层容器与 CSS 重皮 |
| 右栏 | `components/project-context/index.tsx`：320px side-card 项目卡、关联笔记 note-item、米色结论卡（无数据源时按占位规范）、side-foot 按钮组 |
| 08 笔记库 | `pages/note/index.tsx` 整页重构：280 左栏（品牌 + 竖排 modnav + 筛选 + 所属项目）/ 中列表面板（note-item 卡）/ 右 300（标签云 + 统计 + 最近编辑）；**移除 alipay 外链占位图**（无 cover 不渲染图） |
| 09 笔记编辑 | `pages/note/edit.tsx` 整页重构：260 笔记列表 / 44px 格式条（视觉占位）+ 编辑区 / 右 300（属性 + 标签 + 大纲占位） |

### D4 设置与管理（约 3 天）

| 任务 | 落点 |
| --- | --- |
| 10 设置首页 | `pages/setting/index.tsx`：280 setnav（「设置」分组：账户/偏好；「系统管理」分组：用户/角色/菜单——按权限过滤）+ 主区表单（12px label、38px 输入、Switch 对齐原型形态） |
| 11 我的模型 | `components/model-list/index.tsx` 由 Drawer 改页面化：标题「我的模型」+ 副标题（每用户独立 API Key）、模型表格 + 默认模型提示条；`pages/setting/model-config.tsx` 直接渲染 |
| 12–14 管理 | `pages/admin/*` 三屏统一骨架：22px 页头 + 34px 筛选控件 + 表格（antd Table 重皮：表头 44px 浅底、行高 60px、hover、30px 方形分页钮）；users 的 260px cell-user 头像列；roles 权限矩阵面板（tree-row/tree-check/perm-code/内置角色锁标）；menus 树形缩进 + 目录/菜单/按钮类型徽标 + 权限码列 + 显示/隐藏态 |

### D5 状态规范收口（约 1.5 天）

- 15 号屏规范全局落地：Toast 浅底同色描边（antd message 主题映射）、二次确认弹窗 sh-pop、输入三态（默认/focus ring/error ring/disabled）、按钮加载态、骨架统一 `#E6EBF0`、空态虚线卡。
- 全量回归：17 屏路由走查 + 交互状态矩阵（hover/active/disabled/loading/empty/error）勾销；F2 已验收功能（状态流转、存为笔记、模型切换等）不回退。
- 收口文档 `docs/design-alignment-close-out.md`。

## 5. 验收流程（逐屏并排比对）

1. 本地起 `pnpm dev:ui`，浏览器视口固定 **1440×900**。
2. 同窗口并排打开 `design/prototype/NN-*.html` 与对应实现路由，逐项核对：结构（栏宽/层级）、色值（取色器比对 token）、字号字重、间距内边距、圆角阴影、状态形态。
3. 截图成对存档 `docs/design-alignment/screenshots/dN/NN-impl.png / NN-proto.png`。
4. 偏差项当场修或登记进「已知不对齐项」（§6），验收文档记录结论。
5. 每阶段附带 `pnpm build` + lint 通过、无新增 console 报错。

## 6. 已知不对齐项登记（持续维护）

> 原 README 引用的《原型调整建议-不建议对齐项.md》不在仓库，本节即其替代登记处。

| 项 | 类型 | 说明 |
| --- | --- | --- |
| 右栏「会话分组」 | 数据模型 | 项目 = 单会话（多会话拆分为远期），渲染为占位样式 |
| 09 格式条 B/I/U 等富文本操作 | 功能远期 | 仅视觉渲染，编辑保持纯文本 |
| 右栏结论/待办/记忆卡 | 数据模型 | 无后端字段，按占位规范渲染 |
| 原型 `auth__code` 验证码样式 | 原型残留 | 原型 HTML 无实际控件，不实现 |
| 审计日志 | 已移除 | 原型 14 已标注远期 |
| 管理端目标态路由/权限码 | 沿用现状 | 以 `/admin/*` 现状做视觉对齐 |
| 窄屏断点 | 约定 | 仅 ≥1440 严格对齐，以下自然回流 |

## 7. 风险与应对

| 风险 | 应对 |
| --- | --- |
| Tailwind 4 preflight / `@layer` 与移植 CSS、antd 样式三方层序冲突 | D0 集中验证；通用类名加作用域或 `@layer components` 约束；发现冲突优先改自研侧 |
| @ant-design/x（Bubble/Sender）深度定制受限 | 外层容器 + CSS 覆盖为主；确实无法覆盖的差异登记进 §6，不硬改库 |
| antd Table/Form 主题化到不了原型密度（行高、cell 结构） | 用 components 覆盖 + 自定义 render 补足；仍不足的列（cell-user/树形）自定义单元格组件 |
| 拆全局 Sider 引发路由/守卫回归 | D1 独立成阶段 + G-D1 全路由走查门；守卫逻辑只迁移不改写 |
| 原型 HTML 与 tokens 数值不一致 | 以 HTML 实测为准（README 约定），差异回写登记 |
| 视觉重皮破坏 F2 已验收功能 | 每阶段交互回归清单；只动表现层不动数据流与 API 调用 |

## 8. 里程碑与总量

| 里程碑 | 内容 | 累计 |
| --- | --- | --- |
| M-D0 | G-D0：令牌与主题基座 | ~1.5 人日 |
| M-D1 | G-D1：双外壳 + 路由重构 | ~3.5 人日 |
| M-D2 | 01–05b 六屏对齐 | ~6 人日 |
| M-D3 | 06–09 四屏对齐 | ~10 人日 |
| M-D4 | 10–14 五屏对齐 | ~13 人日 |
| M-D5 | 15 规范收口 + 全量回归 | ~14.5 人日 |

按既有节奏（每天 2~3 小时）折算约 **6~8 周**；D3/D4 内部可按屏拆分提交。
